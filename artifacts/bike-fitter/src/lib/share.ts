import type { AngleAnalysis, BodyMeasurements, FittingRecord, KOPSAnalysis, LeMondResult } from "./types";

interface ShareData {
  measurements: BodyMeasurements;
  lemond: LeMondResult;
  analyses: AngleAnalysis[];
  fitScore: number;
  kops?: KOPSAnalysis | null;
  date?: string;
}

export function buildShareText(data: ShareData): string {
  const { measurements, lemond, analyses, fitScore, kops, date } = data;
  const bikeLabel = measurements.bikeType === "road" ? "公路車" : "三鐵車";
  const scoreLabel = fitScore >= 80 ? "優秀" : fitScore >= 55 ? "尚可" : "需調整";
  const dateStr = date
    ? new Date(date).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });

  const lines: string[] = [
    `單車 Fitting 分析報告`,
    `${dateStr} · ${bikeLabel}`,
    ``,
    `整體評分：${fitScore} / 100（${scoreLabel}）`,
    ``,
    `身體測量`,
    `  身高：${measurements.height} cm`,
    `  跨高：${measurements.inseam} cm`,
    `  手臂長：${measurements.armLength} cm`,
    `  軀幹長：${measurements.torsoLength} cm`,
    ``,
    `LeMond 建議座高`,
    `  建議：${lemond.saddleHeight} cm（範圍 ${lemond.saddleHeightMin}–${lemond.saddleHeightMax} cm）`,
  ];

  if (lemond.saddleSetback) lines.push(`  ${lemond.saddleSetback}`);
  if (lemond.handlebarDrop) lines.push(`  ${lemond.handlebarDrop}`);
  if (lemond.saddleForward) lines.push(`  ${lemond.saddleForward}`);
  if (lemond.aerobarsHeight) lines.push(`  ${lemond.aerobarsHeight}`);

  lines.push(``);
  lines.push(`姿態角度分析`);

  for (const a of analyses) {
    const range = `${a.recommendedMin}–${a.recommendedMax}${a.unit}`;
    lines.push(`  ${a.name}：${a.detected}${a.unit}（建議 ${range}）${a.status}`);
    if (a.status !== "符合") {
      lines.push(`    ${a.suggestion}`);
    }
  }

  if (kops) {
    lines.push(``);
    lines.push(`KOPS 膝蓋對齊：${kops.isOptimal ? "對齊良好" : "需要調整"}`);
    lines.push(`  ${kops.suggestion}`);
  }

  lines.push(``);
  lines.push(`— 由 Bike Fitter PWA 生成`);

  return lines.join("\n");
}

export function buildShareTextFromRecord(record: FittingRecord): string {
  return buildShareText({
    measurements: record.measurements,
    lemond: record.lemond,
    analyses: record.analyses,
    fitScore: record.fitScore,
    kops: record.kops,
    date: record.date,
  });
}

const BG = "#0f1117";
const CARD_BG = "#1a1d27";
const BORDER = "#2a2d3a";
const PRIMARY = "#6366f1";
const MUTED = "#6b7280";
const TEXT = "#f1f5f9";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";

function statusColor(status: "符合" | "偏高" | "偏低"): string {
  return status === "符合" ? EMERALD : status === "偏高" ? AMBER : RED;
}

function scoreColor(score: number): string {
  return score >= 80 ? EMERALD : score >= 55 ? AMBER : RED;
}

export async function generateShareImage(data: ShareData): Promise<Blob> {
  const { measurements, lemond, analyses, fitScore, kops, date } = data;

  const W = 800;
  const PADDING = 32;
  const COL = W - PADDING * 2;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const bikeLabel = measurements.bikeType === "road" ? "公路車" : "三鐵車";
  const scoreLabel = fitScore >= 80 ? "優秀" : fitScore >= 55 ? "尚可" : "需調整";
  const dateStr = date
    ? new Date(date).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });

  const sColor = scoreColor(fitScore);

  const ROW_H = 40;
  const SECTION_GAP = 16;
  const CARD_PAD = 20;

  const anglesCount = analyses.length + (kops ? 1 : 0);
  const estimatedH =
    80 + 
    16 + 96 + SECTION_GAP +
    16 + (24 + CARD_PAD * 2 + 12 + ROW_H * 2) + SECTION_GAP +
    16 + (24 + CARD_PAD * 2 + 12 + ROW_H * anglesCount) + SECTION_GAP +
    48;

  canvas.width = W;
  canvas.height = estimatedH;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, estimatedH);

  let y = 0;

  function roundRect(
    x: number, ry: number, w: number, h: number,
    radius: number, fill: string, stroke?: string
  ) {
    ctx.beginPath();
    ctx.roundRect(x, ry, w, h, radius);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) ctx.stroke();
  }

  function text(
    str: string, x: number, ty: number,
    size: number, color: string, align: CanvasTextAlign = "left", weight = "400"
  ) {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, ty);
  }

  function sectionLabel(label: string, ty: number) {
    ctx.fillStyle = BORDER;
    ctx.fillRect(PADDING, ty + 8, COL, 1);
    const labelW = ctx.measureText(label).width + 16;
    const labelX = (W - labelW) / 2;
    ctx.fillStyle = BG;
    ctx.fillRect(labelX, ty, labelW, 18);
    ctx.font = `600 11px Inter, system-ui, sans-serif`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.fillText(label, W / 2, ty + 13);
  }

  y += PADDING;

  ctx.font = `700 28px Inter, system-ui, sans-serif`;
  ctx.fillStyle = TEXT;
  ctx.textAlign = "left";
  ctx.fillText("單車 Fitting 分析報告", PADDING, y + 28);
  y += 40;

  ctx.font = `400 14px Inter, system-ui, sans-serif`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.fillText(`${dateStr} · ${bikeLabel}`, PADDING, y + 16);
  y += 32;

  y += SECTION_GAP;

  const scoreCardH = 80;
  roundRect(PADDING, y, COL, scoreCardH, 12, CARD_BG, BORDER);

  const cx = PADDING + scoreCardH / 2;
  const cy = y + scoreCardH / 2;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (fitScore / 100) * circ;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = BG;
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (fill / circ) * Math.PI * 2);
  ctx.strokeStyle = sColor;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineCap = "butt";

  text(String(fitScore), cx, cy - 6, 20, sColor, "center", "700");
  text("/ 100", cx, cy + 12, 10, MUTED, "center");

  text("整體評分", PADDING + scoreCardH + 16, y + 24, 13, MUTED);
  text(String(fitScore), PADDING + scoreCardH + 16, y + 52, 32, sColor, "left", "700");
  text(scoreLabel, PADDING + scoreCardH + 90, y + 52, 14, sColor, "left", "600");

  const bodyX = W / 2 + 32;
  text(`身高 ${measurements.height} cm`, bodyX, y + 24, 13, MUTED);
  text(`跨高 ${measurements.inseam} cm`, bodyX + 110, y + 24, 13, MUTED);
  text(`手臂 ${measurements.armLength} cm`, bodyX, y + 52, 13, MUTED);
  text(`軀幹 ${measurements.torsoLength} cm`, bodyX + 110, y + 52, 13, MUTED);

  y += scoreCardH + SECTION_GAP;

  sectionLabel("LeMond 建議座高", y);
  y += 24;

  const lemondH = 48 + CARD_PAD * 2;
  roundRect(PADDING, y, COL, lemondH, 12, CARD_BG, BORDER);

  text("建議座高", PADDING + CARD_PAD, y + CARD_PAD + 14, 12, MUTED);
  text(`${lemond.saddleHeight} cm`, PADDING + CARD_PAD, y + CARD_PAD + 42, 30, PRIMARY, "left", "700");

  text("容許範圍", W / 2, y + CARD_PAD + 14, 12, MUTED);
  text(`${lemond.saddleHeightMin} – ${lemond.saddleHeightMax} cm`, W / 2, y + CARD_PAD + 42, 18, TEXT, "left", "600");

  y += lemondH + SECTION_GAP;

  sectionLabel("姿態角度分析", y);
  y += 24;

  const angleCardH = CARD_PAD * 2 + 12 + ROW_H * (analyses.length + (kops ? 1 : 0));
  roundRect(PADDING, y, COL, angleCardH, 12, CARD_BG, BORDER);

  let ry = y + CARD_PAD;

  for (const a of analyses) {
    const sc = statusColor(a.status);
    ctx.fillStyle = sc;
    ctx.fillRect(PADDING, ry, 3, ROW_H - 8);

    text(a.name, PADDING + 16, ry + 14, 13, TEXT, "left", "600");
    text(a.description, PADDING + 16, ry + 30, 11, MUTED);

    text(`${a.detected}${a.unit}`, W / 2, ry + 20, 20, sc, "right", "700");

    text(`建議 ${a.recommendedMin}–${a.recommendedMax}${a.unit}`, W / 2 + 12, ry + 14, 11, MUTED);
    text(a.status, W / 2 + 12, ry + 30, 13, sc, "left", "700");

    if (a.status !== "符合") {
      text(a.suggestion, PADDING + COL - 16, ry + 22, 11, MUTED, "right");
    }

    ry += ROW_H;

    if (ry < y + angleCardH - CARD_PAD) {
      ctx.fillStyle = BORDER;
      ctx.fillRect(PADDING + 16, ry, COL - 16, 1);
    }
  }

  if (kops) {
    const kopsColor = kops.isOptimal ? EMERALD : AMBER;
    ctx.fillStyle = kopsColor;
    ctx.fillRect(PADDING, ry, 3, ROW_H - 8);

    text("KOPS 膝蓋對齊", PADDING + 16, ry + 14, 13, TEXT, "left", "600");
    text("膝蓋過踏板軸心", PADDING + 16, ry + 30, 11, MUTED);
    text(kops.isOptimal ? "對齊良好" : "需要調整", W / 2 + 12, ry + 22, 13, kopsColor, "left", "700");
  }

  y += angleCardH + SECTION_GAP;

  text("— 由 Bike Fitter PWA 生成", PADDING, y + 20, 11, MUTED);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("無法生成圖片"));
      },
      "image/png"
    );
  });
}

export async function shareResults(data: ShareData): Promise<"shared" | "copied" | "downloaded"> {
  const text = buildShareText(data);

  if (navigator.share) {
    try {
      const blob = await generateShareImage(data);
      const file = new File([blob], "bike-fitting.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "單車 Fitting 分析報告",
          text: text.slice(0, 200),
          files: [file],
        });
        return "shared";
      }

      await navigator.share({ title: "單車 Fitting 分析報告", text });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "shared";
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "downloaded";
  }
}

export async function exportResultsImage(data: ShareData): Promise<void> {
  const blob = await generateShareImage(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bike-fitting-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
