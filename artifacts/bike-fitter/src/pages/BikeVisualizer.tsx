import { useState, useMemo } from "react";
import { useAppContext } from "@/lib/context";
import { loadVisualizerParams, saveVisualizerParams } from "@/lib/storage";
import { calculateLeMond } from "@/lib/lemond";
import {
  calculateVisualizerData,
  getDefaultCrankLength,
  WHEEL_RADIUS_SVG,
  type BikePositionsSVG,
  type RiderPositionsSVG,
  type VisualizerDrawData,
} from "@/lib/visualizer";
import { MAMBA_GEOMETRY, MAMBA_SIZES, type MambaSize } from "@/lib/bikeOutline";
import type { VisualizerParams } from "@/lib/types";
import { Button } from "@/components/ui/button";

// ── Colour constants ─────────────────────────────────────────────────────────
const FRAME_COLOR = "#4A9EFF";
const RIDER_COLOR = "#E8E8E8";
const RIDER_DIM   = "#484848";
const JOINT_COLOR = "#FFFFFF";
const FOOT_COLOR  = "#BBBBBB";
const HEAD_R      = 18;   // px (non-scaling)
const JOINT_R     = 5;    // px (non-scaling)

// Format SVG coordinate pair
function p(pt: { x: number; y: number }) {
  return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
}

function Dot({
  pt, r = JOINT_R, fill = JOINT_COLOR,
}: { pt: { x: number; y: number }; r?: number; fill?: string }) {
  return (
    <circle
      cx={pt.x} cy={pt.y}
      r={r}
      fill={fill}
      vectorEffect="non-scaling-stroke"
    />
  );
}

// ── Bike frame SVG ────────────────────────────────────────────────────────────
function BikeFrameSVG({ bike }: { bike: BikePositionsSVG }) {
  const {
    rearAxle, frontAxle, bb, seatTubeTop,
    headTubeTop, headTubeBottom, stemStart,
    saddle, handlebar,
  } = bike;

  const r    = WHEEL_RADIUS_SVG;
  const rRim = WHEEL_RADIUS_SVG - 25;  // rim inset (approx. tire thickness)

  return (
    <g>
      {/* ── Wheels ──────────────────────────────────────────────────────── */}
      {/* Tire (thick stroke) */}
      <circle cx={rearAxle.x}  cy={rearAxle.y}  r={r} fill="none" stroke="#555555" strokeWidth="24" vectorEffect="non-scaling-stroke" />
      <circle cx={frontAxle.x} cy={frontAxle.y} r={r} fill="none" stroke="#555555" strokeWidth="24" vectorEffect="non-scaling-stroke" />
      {/* Rim */}
      <circle cx={rearAxle.x}  cy={rearAxle.y}  r={rRim} fill="none" stroke="#888888" strokeWidth="4" vectorEffect="non-scaling-stroke" />
      <circle cx={frontAxle.x} cy={frontAxle.y} r={rRim} fill="none" stroke="#888888" strokeWidth="4" vectorEffect="non-scaling-stroke" />
      {/* Hub dots */}
      <circle cx={rearAxle.x}  cy={rearAxle.y}  r={8} fill="#888888" vectorEffect="non-scaling-stroke" />
      <circle cx={frontAxle.x} cy={frontAxle.y} r={8} fill="#888888" vectorEffect="non-scaling-stroke" />

      {/* ── Frame tubes ─────────────────────────────────────────────────── */}
      {/* Chain stay: rear axle → BB */}
      <line x1={rearAxle.x} y1={rearAxle.y} x2={bb.x} y2={bb.y}
        stroke={FRAME_COLOR} strokeWidth="8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Seat stay: rear axle → seat tube top */}
      <line x1={rearAxle.x} y1={rearAxle.y} x2={seatTubeTop.x} y2={seatTubeTop.y}
        stroke={FRAME_COLOR} strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Seat tube: BB → seat tube top */}
      <line x1={bb.x} y1={bb.y} x2={seatTubeTop.x} y2={seatTubeTop.y}
        stroke={FRAME_COLOR} strokeWidth="8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Top tube: seat tube top → head tube top */}
      <line x1={seatTubeTop.x} y1={seatTubeTop.y} x2={headTubeTop.x} y2={headTubeTop.y}
        stroke={FRAME_COLOR} strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Down tube: BB → head tube bottom */}
      <line x1={bb.x} y1={bb.y} x2={headTubeBottom.x} y2={headTubeBottom.y}
        stroke={FRAME_COLOR} strokeWidth="8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Head tube */}
      <line x1={headTubeTop.x} y1={headTubeTop.y} x2={headTubeBottom.x} y2={headTubeBottom.y}
        stroke={FRAME_COLOR} strokeWidth="10" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Fork: head tube bottom → front axle */}
      <line x1={headTubeBottom.x} y1={headTubeBottom.y} x2={frontAxle.x} y2={frontAxle.y}
        stroke={FRAME_COLOR} strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinecap="round" />

      {/* BB shell */}
      <circle cx={bb.x} cy={bb.y} r={10} fill={FRAME_COLOR} vectorEffect="non-scaling-stroke" />

      {/* ── Saddle ───────────────────────────────────────────────────────── */}
      {/* Seatpost stub (dashed): seat tube top → saddle */}
      <line x1={saddle.x} y1={saddle.y} x2={seatTubeTop.x} y2={seatTubeTop.y}
        stroke={FRAME_COLOR} strokeWidth="4" vectorEffect="non-scaling-stroke"
        strokeDasharray="8 6" />
      {/* Saddle rail (260mm wide) */}
      <line x1={saddle.x - 130} y1={saddle.y} x2={saddle.x + 130} y2={saddle.y}
        stroke={FRAME_COLOR} strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />

      {/* ── Steerer + stem + drop bar ─────────────────────────────────────── */}
      {/* Steerer: head tube top → stem start */}
      <line x1={headTubeTop.x} y1={headTubeTop.y} x2={stemStart.x} y2={stemStart.y}
        stroke={FRAME_COLOR} strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Stem: stem start → handlebar */}
      <line x1={stemStart.x} y1={stemStart.y} x2={handlebar.x} y2={handlebar.y}
        stroke={FRAME_COLOR} strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Handlebar: drop bar side view */}
      {/* Top section (hood area, going slightly back/up from stem end) */}
      <line x1={handlebar.x} y1={handlebar.y}
            x2={handlebar.x - 20} y2={handlebar.y - 28}
        stroke="#AAAAAA" strokeWidth="5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* Drop: curves forward and downward (road bike drop) */}
      <path
        d={`M ${handlebar.x.toFixed(1)} ${handlebar.y.toFixed(1)} Q ${(handlebar.x + 22).toFixed(1)} ${handlebar.y.toFixed(1)} ${(handlebar.x + 28).toFixed(1)} ${(handlebar.y + 55).toFixed(1)}`}
        fill="none" stroke="#AAAAAA" strokeWidth="5" vectorEffect="non-scaling-stroke" strokeLinecap="round"
      />
    </g>
  );
}

// ── Rider stickman ────────────────────────────────────────────────────────────
function StickmanSVG({ rider }: { rider: RiderPositionsSVG }) {
  const {
    pedal6, ankle6, footTip6, knee6,
    hip, shoulder, elbow, wrist, headCenter,
    pedal12, ankle12, knee12,
  } = rider;

  return (
    <g>
      {/* ── Secondary leg (12 o'clock, dim) ─────────────────────────── */}
      <polyline
        points={`${p(hip)} ${p(knee12)} ${p(ankle12)} ${p(pedal12)}`}
        fill="none" stroke={RIDER_DIM} strokeWidth="3"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <Dot pt={knee12}  fill={RIDER_DIM} />
      <Dot pt={ankle12} fill={RIDER_DIM} />
      <Dot pt={pedal12} fill={RIDER_DIM} />

      {/* ── Primary leg (6 o'clock) ──────────────────────────────────── */}
      {/* Foot: toe tip → ankle → pedal */}
      <polyline
        points={`${p(footTip6)} ${p(ankle6)} ${p(pedal6)}`}
        fill="none" stroke={FOOT_COLOR} strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Thigh + shin */}
      <polyline
        points={`${p(hip)} ${p(knee6)} ${p(ankle6)}`}
        fill="none" stroke={RIDER_COLOR} strokeWidth="3.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* ── Torso ────────────────────────────────────────────────────── */}
      <line x1={hip.x} y1={hip.y} x2={shoulder.x} y2={shoulder.y}
        stroke={RIDER_COLOR} strokeWidth="3.5"
        vectorEffect="non-scaling-stroke" strokeLinecap="round"
      />

      {/* ── Arm ──────────────────────────────────────────────────────── */}
      <polyline
        points={`${p(shoulder)} ${p(elbow)} ${p(wrist)}`}
        fill="none" stroke={RIDER_COLOR} strokeWidth="3"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* ── Head ─────────────────────────────────────────────────────── */}
      <circle
        cx={headCenter.x} cy={headCenter.y}
        r={HEAD_R}
        fill="none" stroke={RIDER_COLOR} strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />

      {/* ── Joint dots ───────────────────────────────────────────────── */}
      <Dot pt={hip}      />
      <Dot pt={knee6}    />
      <Dot pt={ankle6}   />
      <Dot pt={pedal6}   />
      <Dot pt={shoulder} />
      <Dot pt={elbow}    />
      <Dot pt={wrist}    />
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BikeVisualizer() {
  const { measurements, bikeProfiles } = useAppContext();

  // Determine active Mamba size (persisted in params)
  const [draftParams, setDraftParams] = useState<VisualizerParams>(() => {
    const saved = loadVisualizerParams();
    const size: MambaSize = (saved?.mambaSize as MambaSize | undefined) ?? "S";
    if (saved) return { mambaSize: size, ...saved };
    const profile = bikeProfiles[0] ?? null;
    return buildDefaultParams(measurements, profile?.geometry.stack ?? MAMBA_GEOMETRY[size].stack, size);
  });

  const [liveParams, setLiveParams] = useState<VisualizerParams>(draftParams);

  const mambaSize: MambaSize = (liveParams.mambaSize as MambaSize | undefined) ?? "S";
  const mambaGeo = MAMBA_GEOMETRY[mambaSize];

  // Merge: Mamba provides headAngle/rearCenter/wheelbase; profile overrides other fields if present
  const profile = bikeProfiles.find((bp) => bp.id === liveParams.bikeProfileId) ?? bikeProfiles[0] ?? null;
  const geometry = profile
    ? { ...mambaGeo, ...profile.geometry }
    : mambaGeo;

  const vizData = useMemo(() => {
    if (!measurements) return null;
    return calculateVisualizerData(geometry, liveParams, measurements);
  }, [geometry, liveParams, measurements]);

  const lemond = measurements ? calculateLeMond(measurements) : null;
  const lemondHint = lemond
    ? `LeMond 建議 ${Math.round(lemond.saddleHeightMin * 10)}–${Math.round(lemond.saddleHeightMax * 10)} mm`
    : "LeMond 建議值";

  function set(key: keyof VisualizerParams, val: number) {
    setDraftParams((prev) => ({ ...prev, [key]: val }));
  }

  function handleUpdate() {
    setLiveParams(draftParams);
    saveVisualizerParams(draftParams);
  }

  function handleSizeChange(size: MambaSize) {
    const geo = MAMBA_GEOMETRY[size];
    const updated: VisualizerParams = {
      ...draftParams,
      mambaSize: size,
      stemHeight: geo.stack + 20,
    };
    setDraftParams(updated);
    setLiveParams(updated);
    saveVisualizerParams(updated);
  }

  if (!measurements) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          請先在「首頁」輸入身體數據，模擬功能才能計算關節位置。
        </p>
      </div>
    );
  }

  // Default viewBox for empty state — Mamba S size
  const defaultVb = { width: 1949, height: 1886 };
  const defaultGroundY = 1736;  // ABOVE_AXL(1400) + WHEEL_RADIUS(336)
  const vb = vizData?.viewBox ?? defaultVb;
  const groundY = vizData?.groundY ?? defaultGroundY;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold tracking-tight">騎乘姿勢模擬</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Mamba FCM-2159 · {mambaSize} size
          {profile ? ` · ${profile.name}` : ""}
        </p>
      </div>

      {/* Mamba size selector */}
      <div className="px-4 pb-3">
        <p className="text-[11px] text-muted-foreground mb-1.5">車架尺寸</p>
        <div className="flex gap-1">
          {MAMBA_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => handleSizeChange(size)}
              className={[
                "flex-1 h-8 text-xs font-semibold rounded transition-colors",
                mambaSize === size
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
              ].join(" ")}
            >
              {size}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          座管 {mambaGeo.seatTube} mm · Stack {mambaGeo.stack} mm · Reach {mambaGeo.reach} mm · 軸距 {mambaGeo.wheelbase} mm
        </p>
      </div>

      {/* SVG Canvas */}
      <div className="w-full bg-card/20 border-y border-border/30">
        <svg
          viewBox={`0 0 ${vb.width.toFixed(0)} ${vb.height.toFixed(0)}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block" }}
        >
          {/* Ground line */}
          <line
            x1="0" y1={groundY} x2={vb.width} y2={groundY}
            stroke="#333333" strokeWidth="2" vectorEffect="non-scaling-stroke"
          />

          {vizData ? (
            <>
              <BikeFrameSVG bike={vizData.bike} />
              <StickmanSVG rider={vizData.rider} />
            </>
          ) : (
            <text
              x={vb.width / 2} y={vb.height / 2}
              textAnchor="middle" fill="#666" fontSize="60"
            >
              請輸入身體數據以顯示模擬
            </text>
          )}
        </svg>
      </div>

      {/* Angle badges */}
      {vizData && <AngleBadges vizData={vizData} bikeType={profile?.type ?? "road"} />}

      {/* Parameters */}
      <div className="px-4 pb-4 space-y-4">
        <div className="h-px bg-border/40" />

        <ParamRow
          label="座高"
          value={draftParams.saddleHeight}
          hint={lemondHint}
          step={5}
          onChange={(v) => set("saddleHeight", v)}
        />
        <ParamRow
          label="座墊前後"
          value={draftParams.saddleOffset}
          hint="正值 = 後移。KOPS 建議 0–40 mm 後移"
          step={5}
          onChange={(v) => set("saddleOffset", v)}
        />
        <ParamRow
          label="龍頭高度"
          value={draftParams.stemHeight}
          hint={`Stack ${mambaGeo.stack} mm + 墊片（建議 ${mambaGeo.stack + 10}–${mambaGeo.stack + 40} mm）`}
          step={5}
          onChange={(v) => set("stemHeight", v)}
        />
        <ParamRow
          label="龍頭長度"
          value={draftParams.stemLength}
          hint="建議 80–130 mm"
          step={5}
          onChange={(v) => set("stemLength", v)}
        />
        <ParamRow
          label="曲柄長度"
          value={draftParams.crankLength}
          hint={`依身高建議 ${getDefaultCrankLength(measurements.height)} mm`}
          step={2.5}
          onChange={(v) => set("crankLength", v)}
        />

        <Button
          className="w-full h-12 text-sm font-semibold mt-2"
          onClick={handleUpdate}
        >
          更新畫面
        </Button>
      </div>
    </div>
  );
}

// ── AngleBadges ───────────────────────────────────────────────────────────────
interface AngleSpec {
  label: string;
  value: number;
  minGood: number;
  maxGood: number;
  unit?: string;
}

function AngleBadges({
  vizData,
  bikeType,
}: {
  vizData: VisualizerDrawData;
  bikeType: "road" | "tri";
}) {
  const torsoMin = bikeType === "tri" ? 25 : 35;
  const torsoMax = bikeType === "tri" ? 40 : 55;

  const angles: AngleSpec[] = [
    { label: "膝蓋彎曲", value: vizData.kneeAngle6, minGood: 25, maxGood: 35, unit: "°" },
    { label: "軀幹前傾", value: vizData.torsoAngle, minGood: torsoMin, maxGood: torsoMax, unit: "°" },
    { label: "髖關節角", value: vizData.hipAngle,   minGood: 45, maxGood: 65, unit: "°" },
    { label: "手肘角度", value: vizData.elbowAngle, minGood: 150, maxGood: 165, unit: "°" },
  ];

  return (
    <div className="px-4 py-3 grid grid-cols-2 gap-2">
      {angles.map((a) => {
        const ok  = a.value >= a.minGood && a.value <= a.maxGood;
        const low = a.value < a.minGood;
        const statusColor = ok ? "text-emerald-400" : low ? "text-sky-400" : "text-amber-400";
        const statusLabel = ok ? "符合" : low ? "偏小" : "偏大";
        return (
          <div
            key={a.label}
            className="flex items-center justify-between bg-card border border-border/50 rounded-lg px-3 py-2"
          >
            <div>
              <p className="text-xs text-muted-foreground">{a.label}</p>
              <p className="text-[10px] text-muted-foreground/60">
                建議 {a.minGood}–{a.maxGood}{a.unit}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-base leading-tight">
                {a.value}{a.unit}
              </p>
              <p className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── buildDefaultParams ────────────────────────────────────────────────────────
function buildDefaultParams(
  measurements: { height: number; inseam: number } | null,
  stack: number,
  mambaSize: MambaSize = "S"
): VisualizerParams {
  const inseam = measurements?.inseam ?? 82;
  const height = measurements?.height ?? 175;
  return {
    bikeProfileId: "",
    mambaSize,
    saddleHeight:  Math.round(inseam * 8.83),
    saddleOffset:  30,
    stemHeight:    stack + 20,
    stemLength:    100,
    crankLength:   getDefaultCrankLength(height),
  };
}

// ── ParamRow ──────────────────────────────────────────────────────────────────
interface ParamRowProps {
  label: string;
  value: number;
  hint: string;
  step?: number;
  onChange: (v: number) => void;
}

function ParamRow({ label, value, hint, step = 1, onChange }: ParamRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(v);
            }}
            className="w-24 h-8 rounded-md bg-card border border-border px-2 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground w-6">mm</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
