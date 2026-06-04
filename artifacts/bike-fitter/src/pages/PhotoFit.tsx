import { useRef, useState, useEffect, useCallback } from "react";
import { Camera, ChevronRight, RotateCcw, Check, ArrowLeft } from "lucide-react";
import { useAppContext } from "@/lib/context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pt { x: number; y: number }
interface MarkedPoints {
  rearAxle: Pt | null; frontAxle: Pt | null; bb: Pt | null;
  saddle: Pt | null; handlebar: Pt | null; hip: Pt | null; shoulder: Pt | null;
}
type PKey = keyof MarkedPoints;
type AngStatus = "符合" | "偏高" | "偏低";
interface Angles { knee: number; torso: number; hip: number; elbow: number }
interface StickmanResult {
  pedal: Pt; ankle: Pt; knee: Pt; hip: Pt;
  shoulder: Pt; elbow: Pt; wrist: Pt;
  headCenter: Pt; headR: number;
  angles: Angles;
}

// ─── Point definitions ────────────────────────────────────────────────────────
const PDEFS = [
  { key: "rearAxle"  as PKey, label: "後輪軸心", color: "#888888", prompt: "請點擊後輪軸心位置",                          skip: false },
  { key: "frontAxle" as PKey, label: "前輪軸心", color: "#888888", prompt: "請點擊前輪軸心位置",                          skip: false },
  { key: "bb"        as PKey, label: "BB 中心",  color: "#4A9EFF", prompt: "請點擊曲柄中心（BB）位置",                    skip: false },
  { key: "saddle"    as PKey, label: "座墊頂端", color: "#4A9EFF", prompt: "請點擊座墊最高點",                            skip: false },
  { key: "handlebar" as PKey, label: "把手中心", color: "#4A9EFF", prompt: "請點擊把手位置",                              skip: false },
  { key: "hip"       as PKey, label: "髖關節",   color: "#FF4444", prompt: "請點擊騎士髖部位置（若有人在車上）",          skip: true  },
  { key: "shoulder"  as PKey, label: "肩關節",   color: "#FF4444", prompt: "請點擊騎士肩膀位置（若有人在車上）",          skip: true  },
] as const;

const EMPTY: MarkedPoints = {
  rearAxle: null, frontAxle: null, bb: null,
  saddle: null, handlebar: null, hip: null, shoulder: null,
};
const PF_KEY = "photoFitData";

// ─── Math helpers ─────────────────────────────────────────────────────────────
const sub  = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const pdist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const norm  = (v: Pt): Pt => { const d = Math.hypot(v.x, v.y); return d < 1e-6 ? { x: 0, y: -1 } : { x: v.x / d, y: v.y / d }; };

function findJoint(a: Pt, b: Pt, r1: number, r2: number, pref: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d < 0.01) return { x: a.x, y: a.y - r1 };
  if (d > r1 + r2) { const t = r1 / (r1 + r2); return { x: a.x + dx * t, y: a.y + dy * t }; }
  const A = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - A * A));
  const mx = a.x + (A / d) * dx, my = a.y + (A / d) * dy;
  const p1: Pt = { x: mx + (h / d) * dy, y: my - (h / d) * dx };
  const p2: Pt = { x: mx - (h / d) * dy, y: my + (h / d) * dx };
  const mid: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const s1 = (p1.x - mid.x) * pref.x + (p1.y - mid.y) * pref.y;
  const s2 = (p2.x - mid.x) * pref.x + (p2.y - mid.y) * pref.y;
  return s1 >= s2 ? p1 : p2;
}

function intAng(a: Pt, b: Pt, c: Pt): number {
  const r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let ang = Math.abs(r * 180 / Math.PI);
  if (ang > 180) ang = 360 - ang;
  return ang;
}

const angStatus = (v: number, mn: number, mx: number): AngStatus =>
  v < mn ? "偏低" : v > mx ? "偏高" : "符合";

// ─── Stickman computation ─────────────────────────────────────────────────────
function computeStickman(
  pts: MarkedPoints,
  m: { height: number; inseam: number; armLength: number; torsoLength: number },
): StickmanResult | null {
  const { rearAxle, frontAxle, bb, saddle, handlebar } = pts;
  if (!rearAxle || !frontAxle || !bb || !saddle || !handlebar) return null;

  const ppm = pdist(rearAxle, frontAxle) / 977; // pixels per mm
  const fwd = norm(sub(frontAxle, rearAxle));    // forward direction in image

  // Pedal at 6 o'clock: directly below BB in image coordinates (y-down)
  const crankPx = 172.5 * ppm;
  const pedal: Pt = { x: bb.x, y: bb.y + crankPx };

  // Ankle joint: slightly behind and above pedal (shoe + anatomy)
  const ankle: Pt = {
    x: pedal.x - fwd.x * 15 * ppm,
    y: pedal.y - 65 * ppm,
  };

  // Hip: use marked point or estimate from saddle
  const hip: Pt = pts.hip ?? {
    x: saddle.x + fwd.x * 25 * ppm,
    y: saddle.y - 20 * ppm,
  };

  // Knee via findJoint
  const thighPx = m.inseam * 10 * 0.53 * ppm;
  const shinPx  = m.inseam * 10 * 0.54 * ppm;
  const knee = findJoint(hip, ankle, thighPx, shinPx, fwd);

  // Shoulder: use marked point or compute from hip + handlebar geometry
  const torsoPx    = m.torsoLength * 10 * ppm;
  const armPx      = m.armLength * 10 * ppm;
  const armReachPx = armPx * 0.981;
  const shoulder: Pt = pts.shoulder ?? findJoint(hip, handlebar, torsoPx, armReachPx, { x: 0, y: -1 });

  // Elbow
  const elbow = findJoint(shoulder, handlebar, armPx * 0.558, armPx * 0.442, { x: 0, y: 1 });

  // Head (neck length ≈ 13% of height, head radius ≈ half that)
  const neckPx = m.height * 10 * 0.13 * ppm;
  const headR  = neckPx * 0.55;
  const headCenter: Pt = {
    x: shoulder.x + fwd.x * neckPx * 0.2,
    y: shoulder.y - neckPx,
  };

  // Angles
  const kneeAngle  = Math.round(180 - intAng(hip, knee, ankle));
  const torsoAngle = Math.round(intAng({ x: hip.x, y: hip.y - 100 }, hip, shoulder));
  const hipAngle   = Math.round(180 - intAng(shoulder, hip, knee));
  const elbowAngle = Math.round(intAng(shoulder, elbow, handlebar));

  return {
    pedal, ankle, knee, hip, shoulder,
    elbow, wrist: handlebar, headCenter, headR,
    angles: { knee: kneeAngle, torso: torsoAngle, hip: hipAngle, elbow: elbowAngle },
  };
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);      ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function seg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawMarkPoints(
  ctx: CanvasRenderingContext2D,
  pts: MarkedPoints,
  activeIdx: number,
  step: number,
) {
  PDEFS.forEach((def, i) => {
    const pt = pts[def.key];
    if (!pt) return;
    const isActive = i === activeIdx;
    const fillAlpha  = step === 4 ? "66" : "BB";
    const strokeAlpha = step === 4 ? "88" : "CC";

    if (isActive) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = def.color + "77";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
    ctx.fillStyle   = def.color + fillAlpha;
    ctx.strokeStyle = "#FFFFFF" + strokeAlpha;
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();

    if (step < 4) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font      = "11px -apple-system,system-ui,sans-serif";
      ctx.fillText(def.label, pt.x + 12, pt.y + 4);
    }
  });
}

function drawStickman(ctx: CanvasRenderingContext2D, sm: StickmanResult) {
  ctx.lineCap  = "round";
  ctx.lineJoin = "round";

  // Secondary leg (same joints, lower opacity — impression of depth)
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(sm.hip.x,  sm.hip.y);
  ctx.lineTo(sm.knee.x, sm.knee.y);
  ctx.lineTo(sm.ankle.x, sm.ankle.y);
  ctx.stroke();

  // Primary body
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth   = 3;

  // Leg: hip → knee → ankle
  ctx.beginPath();
  ctx.moveTo(sm.hip.x,   sm.hip.y);
  ctx.lineTo(sm.knee.x,  sm.knee.y);
  ctx.lineTo(sm.ankle.x, sm.ankle.y);
  ctx.stroke();

  // Pedal platform
  ctx.strokeStyle = "rgba(200,200,200,0.80)";
  ctx.lineWidth   = 2.5;
  seg(ctx, { x: sm.pedal.x - 12, y: sm.pedal.y }, { x: sm.pedal.x + 12, y: sm.pedal.y });

  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth   = 3;

  // Torso
  seg(ctx, sm.hip, sm.shoulder);

  // Arm
  ctx.beginPath();
  ctx.moveTo(sm.shoulder.x, sm.shoulder.y);
  ctx.lineTo(sm.elbow.x,    sm.elbow.y);
  ctx.lineTo(sm.wrist.x,    sm.wrist.y);
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(sm.headCenter.x, sm.headCenter.y, sm.headR, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Joint dots
  ctx.fillStyle = "#FFFFFF";
  [sm.hip, sm.knee, sm.ankle, sm.shoulder, sm.elbow].forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawAngleBadges(ctx: CanvasRenderingContext2D, ang: Angles) {
  const rows = [
    { label: "膝蓋彎曲", val: ang.knee,  mn: 25,  mx: 35  },
    { label: "軀幹前傾", val: ang.torso, mn: 35,  mx: 55  },
    { label: "髖部角度", val: ang.hip,   mn: 45,  mx: 65  },
    { label: "手肘角度", val: ang.elbow, mn: 150, mx: 165 },
  ];
  const bw = 130, padX = 9, padY = 8, rowH = 22;
  const bh = rows.length * rowH + padY * 2;
  const x0 = ctx.canvas.width - bw - 8;
  const y0 = 8;

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  rrect(ctx, x0 - padX / 2, y0 - padY / 2, bw + padX, bh, 8);
  ctx.fill();

  rows.forEach((r, i) => {
    const s  = angStatus(r.val, r.mn, r.mx);
    const sc = s === "符合" ? "#4ade80" : s === "偏高" ? "#f87171" : "#fb923c";
    const ty = y0 + padY + i * rowH + rowH - 6;

    ctx.fillStyle = "#d1d5db";
    ctx.font      = "11px -apple-system,system-ui,sans-serif";
    ctx.fillText(`${r.label} ${r.val}\u00b0`, x0, ty);

    ctx.fillStyle = sc;
    ctx.font      = "bold 11px -apple-system,system-ui,sans-serif";
    const sw = ctx.measureText(s).width;
    ctx.fillText(s, x0 + bw - sw - 5, ty);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PhotoFit() {
  const { measurements } = useAppContext();

  const [step,       setStep]       = useState<1 | 2 | 3 | 4>(1);
  const [imgUrl,     setImgUrl]     = useState<string | null>(null);
  const [imgEl,      setImgEl]      = useState<HTMLImageElement | null>(null);
  const [dispSize,   setDispSize]   = useState({ w: 390, h: 520 });
  const [pts,        setPts]        = useState<MarkedPoints>({ ...EMPTY });
  const [cidx,       setCidx]       = useState(0);
  const [dragKey,    setDragKey]    = useState<PKey | null>(null);
  const [stickman,   setStickman]   = useState<StickmanResult | null>(null);
  const [savedExists,setSavedExists]= useState(false);

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  // Check for saved session on mount
  useEffect(() => {
    setSavedExists(!!localStorage.getItem(PF_KEY));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getContainerW = () =>
    Math.min(containerRef.current?.offsetWidth ?? 390, 390);

  const loadImg = useCallback((url: string, targetStep: 2 | 3 = 2) => {
    const img = new Image();
    img.onload = () => {
      const cw = getContainerW();
      const ch = Math.round(img.naturalHeight * cw / img.naturalWidth);
      setDispSize({ w: cw, h: ch });
      setImgEl(img);
      setImgUrl(url);
      setStep(targetStep);
    };
    img.src = url;
  }, []);

  // ── File upload ────────────────────────────────────────────────────────────
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setPts({ ...EMPTY });
      setCidx(0);
      setStickman(null);
      loadImg(url, 2);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Load saved session ────────────────────────────────────────────────────
  const loadSaved = () => {
    try {
      const raw = localStorage.getItem(PF_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { imgUrl: string; pts: MarkedPoints; dispSize: { w: number; h: number } };
      const savedUrl = data.imgUrl;
      const savedPts = data.pts ?? { ...EMPTY };
      const savedDisp = data.dispSize ?? { w: 390, h: 520 };

      const img = new Image();
      img.onload = () => {
        const cw = getContainerW();
        const ch = Math.round(img.naturalHeight * cw / img.naturalWidth);
        setDispSize({ w: cw, h: ch });
        setImgEl(img);
        setImgUrl(savedUrl);

        // Scale saved points to current display size
        const sx = cw / savedDisp.w;
        const sy = ch / savedDisp.h;
        const scaled: MarkedPoints = { ...EMPTY };
        (Object.keys(savedPts) as PKey[]).forEach((k) => {
          const p = savedPts[k];
          scaled[k] = p ? { x: p.x * sx, y: p.y * sy } : null;
        });
        setPts(scaled);
        setCidx(PDEFS.length);
        setStickman(null);
        setStep(3);
      };
      img.src = savedUrl;
    } catch {}
  };

  // ── Persist session ────────────────────────────────────────────────────────
  const persist = useCallback(
    (url: string, points: MarkedPoints, el: HTMLImageElement, ds: { w: number; h: number }) => {
      try {
        // Resize to max 800px before saving to stay within localStorage limits
        const maxW = 800;
        const sc   = Math.min(1, maxW / el.naturalWidth);
        const sw   = Math.round(el.naturalWidth * sc);
        const sh   = Math.round(el.naturalHeight * sc);
        const c    = document.createElement("canvas");
        c.width = sw; c.height = sh;
        c.getContext("2d")?.drawImage(el, 0, 0, sw, sh);
        const small = c.toDataURL("image/jpeg", 0.75);
        localStorage.setItem(PF_KEY, JSON.stringify({ imgUrl: small, pts: points, dispSize: ds }));
        setSavedExists(true);
      } catch {}
    },
    [],
  );

  // ── Canvas redraw ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || step < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMarkPoints(ctx, pts, step === 2 ? cidx : -1, step);

    if (step === 4 && stickman) {
      drawStickman(ctx, stickman);
      drawAngleBadges(ctx, stickman.angles);
    }
  }, [step, pts, cidx, stickman, dispSize]);

  // ── Compute stickman when entering step 4 ─────────────────────────────────
  useEffect(() => {
    if (step !== 4 || !measurements) return;
    const result = computeStickman(pts, measurements);
    setStickman(result);
    if (imgUrl && imgEl) persist(imgUrl, pts, imgEl, dispSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Pointer event handlers ─────────────────────────────────────────────────
  const getCanvasPt = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const sx     = canvas.width  / rect.width;
    const sy     = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPt(e);
    if (step === 2) {
      if (cidx >= PDEFS.length) return;
      const key = PDEFS[cidx].key;
      setPts((prev) => ({ ...prev, [key]: pt }));
    } else if (step === 3) {
      let closest: PKey | null = null, closestD = 28;
      for (const def of PDEFS) {
        const p = pts[def.key];
        if (!p) continue;
        const d = pdist(p, pt);
        if (d < closestD) { closest = def.key; closestD = d; }
      }
      if (closest) {
        setDragKey(closest);
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (step === 3 && dragKey) {
      const pt = getCanvasPt(e);
      setPts((prev) => ({ ...prev, [dragKey]: pt }));
    }
  };

  const onPointerUp = () => setDragKey(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const currentDef   = cidx < PDEFS.length ? PDEFS[cidx] : null;
  const currentPlaced = currentDef ? pts[currentDef.key] !== null : false;
  const allDone      = cidx >= PDEFS.length;

  const advance = () => setCidx((c) => c + 1);
  const redo    = () => {
    if (!currentDef) return;
    setPts((prev) => ({ ...prev, [currentDef.key]: null }));
  };

  const resetAll = () => {
    setStep(1); setImgUrl(null); setImgEl(null);
    setPts({ ...EMPTY }); setCidx(0); setStickman(null);
  };

  // ── Render: step 1 (upload) ────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">照片標定模擬</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          上傳側面騎乘照片，手動標定關鍵點，疊加火柴人並計算姿態角度。
        </p>
      </div>

      {savedExists && (
        <button
          onClick={loadSaved}
          className="flex items-center gap-3 p-4 rounded-xl border border-primary/40 bg-primary/10 text-primary text-sm"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          載入上次標定結果
        </button>
      )}

      <button
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed border-border hover:border-primary/60 transition-colors"
      >
        <Camera className="w-10 h-10 text-muted-foreground" />
        <span className="text-base font-medium">點擊上傳照片</span>
        <span className="text-sm text-muted-foreground">支援 JPG、PNG</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFile}
      />

      <div className="p-4 rounded-xl bg-card border border-border">
        <p className="text-sm font-medium mb-2">拍攝建議</p>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>- 側面 90°，距離 2-3 公尺</li>
          <li>- 踏板在 6 點鐘（腿伸直）位置</li>
          <li>- 確保整台車含輪子完整入鏡</li>
        </ul>
      </div>
    </div>
  );

  // ── Render: top bar (steps 2–4) ────────────────────────────────────────────
  const renderTopBar = () => {
    const title = step === 2
      ? `標定關鍵點 ${Math.min(cidx + 1, PDEFS.length)} / ${PDEFS.length}`
      : step === 3 ? "微調標定點"
      : "火柴人模擬";
    const hint = step === 2 ? "點擊照片標定" : step === 3 ? "拖曳圓點微調" : "";
    const back = () => {
      if (step === 2) resetAll();
      else if (step === 3) { setStep(2); setCidx(0); }
      else setStep(3);
    };
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button onClick={back} className="text-muted-foreground p-1" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-medium flex-1">{title}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    );
  };

  // ── Render: canvas overlay (steps 2–4) ────────────────────────────────────
  const renderCanvas = () => (
    <div
      className="relative shrink-0 mx-auto"
      style={{ width: dispSize.w, height: dispSize.h, maxWidth: "100%" }}
    >
      {imgUrl && (
        <img
          src={imgUrl}
          alt="bike photo"
          draggable={false}
          style={{ width: dispSize.w, height: dispSize.h, display: "block", userSelect: "none" }}
        />
      )}
      <canvas
        ref={canvasRef}
        width={dispSize.w}
        height={dispSize.h}
        style={{
          position: "absolute", top: 0, left: 0,
          width: dispSize.w, height: dispSize.h,
          touchAction: "none",
          cursor:
            step === 3 ? (dragKey ? "grabbing" : "grab") :
            (step === 2 && !allDone ? "crosshair" : "default"),
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );

  // ── Render: step 2 bottom panel ────────────────────────────────────────────
  const renderStep2Controls = () => (
    <div className="flex flex-col gap-3 p-4">
      {!allDone ? (
        <>
          <p className="text-base font-medium text-center leading-snug py-1">
            {currentDef?.prompt}
          </p>
          <div className="flex gap-3">
            {currentPlaced && (
              <button
                onClick={redo}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm"
              >
                重新點選
              </button>
            )}
            {currentDef?.skip && !currentPlaced && (
              <button
                onClick={advance}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm"
              >
                跳過
              </button>
            )}
            {currentPlaced && (
              <button
                onClick={advance}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2"
              >
                下一個 <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Progress dots */}
          <div className="flex justify-center gap-2 pt-1">
            {PDEFS.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i < cidx ? "w-2 bg-primary" :
                  i === cidx ? "w-4 bg-primary/70" :
                  "w-2 bg-border"
                }`}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground text-center">所有關鍵點已標定完成</p>
          <button
            onClick={() => setStep(3)}
            className="py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2"
          >
            前往微調 <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );

  // ── Render: step 3 bottom panel ────────────────────────────────────────────
  const renderStep3Controls = () => (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm text-muted-foreground text-center">
        拖曳各圓點微調位置，確認無誤後開始模擬
      </p>
      {!measurements && (
        <p className="text-sm text-amber-400 text-center">
          請先至首頁輸入身體數據，才能進行火柴人模擬
        </p>
      )}
      <div className="flex gap-3 mt-1">
        <button
          onClick={() => { setStep(2); setCidx(0); }}
          className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm"
        >
          重新標定
        </button>
        <button
          onClick={() => setStep(4)}
          disabled={!measurements}
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
        >
          確認，開始模擬 <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ── Render: step 4 bottom panel ────────────────────────────────────────────
  const renderStep4Controls = () => {
    const ANGLE_DEFS = [
      { label: "膝蓋彎曲", key: "knee"  as const, mn: 25,  mx: 35,  unit: "°" },
      { label: "軀幹前傾", key: "torso" as const, mn: 35,  mx: 55,  unit: "°" },
      { label: "髖部角度", key: "hip"   as const, mn: 45,  mx: 65,  unit: "°" },
      { label: "手肘角度", key: "elbow" as const, mn: 150, mx: 165, unit: "°" },
    ];
    return (
      <div className="flex flex-col gap-3 p-4">
        {stickman ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {ANGLE_DEFS.map((a) => {
                const val = stickman.angles[a.key];
                const s   = angStatus(val, a.mn, a.mx);
                return (
                  <div key={a.key} className="p-3 rounded-xl bg-card border border-border">
                    <p className="text-xs text-muted-foreground">{a.label}</p>
                    <p className="text-lg font-semibold mt-0.5">{val}{a.unit}</p>
                    <p className={`text-xs font-medium mt-0.5 ${s === "符合" ? "text-green-400" : "text-red-400"}`}>
                      {s}（建議 {a.mn}–{a.mx}{a.unit}）
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm"
              >
                重新調整
              </button>
              <button
                onClick={resetAll}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm"
              >
                重新開始
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {measurements ? "計算中..." : "請先至首頁輸入身體數據"}
          </p>
        )}
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex flex-col min-h-[calc(100vh-4rem)]">
      {step === 1 && renderStep1()}
      {step >= 2 && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {renderTopBar()}
          <div className="overflow-y-auto flex-1">
            {renderCanvas()}
            {step === 2 && renderStep2Controls()}
            {step === 3 && renderStep3Controls()}
            {step === 4 && renderStep4Controls()}
          </div>
        </div>
      )}
    </div>
  );
}
