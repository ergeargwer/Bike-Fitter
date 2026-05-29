import { PoseAngles, AngleAnalysis, KOPSAnalysis, BodyMeasurements } from "./types";

// MediaPipe landmark indices — use RIGHT side (most natural for side-view photography)
export const LANDMARK_INDICES = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  RIGHT_ELBOW: 14,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  RIGHT_KNEE: 26,
  RIGHT_ANKLE: 28,
};

interface Point {
  x: number;
  y: number;
}

// atan2-based interior angle calculation (matches reference repo approach)
// Returns the interior angle at vertex B, formed by rays BA and BC
function calculateInteriorAngle(a: Point, b: Point, c: Point): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}

// Knee bend angle: degrees from a fully straight leg (0° = straight)
// Reference: 180° - interior(hip, knee, ankle)
function calculateKneeBend(hip: Point, knee: Point, ankle: Point): number {
  const interior = calculateInteriorAngle(hip, knee, ankle);
  return 180 - interior;
}

// Torso angle from vertical: interior(verticalAboveHip, hip, shoulder)
// 0° = upright, 90° = horizontal
function calculateTorsoAngleFromVertical(hip: Point, shoulder: Point): number {
  const verticalRef: Point = { x: hip.x, y: hip.y - 0.1 };
  return calculateInteriorAngle(verticalRef, hip, shoulder);
}

// Distance between two normalized landmarks
function landmarkDistance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Validate that the person is in a side-view profile
export function validateSideView(
  landmarks: { x: number; y: number; z?: number; visibility?: number }[]
): { isValid: boolean; message: string } {
  const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];

  if (!leftShoulder || !rightShoulder) {
    return { isValid: false, message: "無法偵測到雙肩，請確保上半身可見" };
  }

  const shoulderDist = landmarkDistance(leftShoulder, rightShoulder);
  if (shoulderDist > 0.15) {
    return {
      isValid: false,
      message: "請側面對鏡頭（90° 角），目前肩膀間距過大",
    };
  }

  const keyIndices = [
    LANDMARK_INDICES.RIGHT_SHOULDER,
    LANDMARK_INDICES.RIGHT_ELBOW,
    LANDMARK_INDICES.RIGHT_WRIST,
    LANDMARK_INDICES.RIGHT_HIP,
    LANDMARK_INDICES.RIGHT_KNEE,
    LANDMARK_INDICES.RIGHT_ANKLE,
  ];

  for (const idx of keyIndices) {
    const lm = landmarks[idx];
    if (!lm || (lm.visibility !== undefined && lm.visibility < 0.5)) {
      return {
        isValid: false,
        message: "身體關節點可見度不足，請確認光線充足且完整入鏡",
      };
    }
  }

  return { isValid: true, message: "" };
}

// Extract all angles from a pose landmark array
export function extractAnglesFromLandmarks(
  landmarks: { x: number; y: number; z?: number; visibility?: number }[],
  position: "6oclock" | "3oclock"
): PoseAngles {
  const shoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
  const elbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
  const wrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
  const hip = landmarks[LANDMARK_INDICES.RIGHT_HIP];
  const knee = landmarks[LANDMARK_INDICES.RIGHT_KNEE];
  const ankle = landmarks[LANDMARK_INDICES.RIGHT_ANKLE];

  if (!shoulder || !elbow || !wrist || !hip || !knee || !ankle) {
    throw new Error("無法偵測完整身體關節點，請確保全身側面入鏡");
  }

  const kneeAngle = Math.round(calculateKneeBend(hip, knee, ankle) * 10) / 10;
  const hipAngle =
    Math.round(calculateInteriorAngle(shoulder, hip, knee) * 10) / 10;
  const torsoAngle =
    Math.round(calculateTorsoAngleFromVertical(hip, shoulder) * 10) / 10;
  const elbowAngle =
    Math.round(calculateInteriorAngle(shoulder, elbow, wrist) * 10) / 10;

  let kopsOffset: number | undefined;
  if (position === "3oclock") {
    // Positive = knee is ahead of ankle (pedal spindle approximation)
    kopsOffset = Math.round((knee.x - ankle.x) * 1000) / 10;
  }

  return { kneeAngle, hipAngle, torsoAngle, elbowAngle, position, kopsOffset };
}

// Draw skeleton and angle annotations onto a canvas context
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  landmarks: { x: number; y: number; z?: number; visibility?: number }[],
  connections: [number, number][]
): void {
  // Draw connections
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 3;
  for (const [i, j] of connections) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (!a || !b) continue;
    if (
      (a.visibility ?? 1) < 0.5 ||
      (b.visibility ?? 1) < 0.5
    )
      continue;
    ctx.beginPath();
    ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
    ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
    ctx.stroke();
  }

  // Highlight key RIGHT-side landmarks with white outer + colored inner circles
  const keyIndices = [
    LANDMARK_INDICES.RIGHT_SHOULDER,
    LANDMARK_INDICES.RIGHT_ELBOW,
    LANDMARK_INDICES.RIGHT_WRIST,
    LANDMARK_INDICES.RIGHT_HIP,
    LANDMARK_INDICES.RIGHT_KNEE,
    LANDMARK_INDICES.RIGHT_ANKLE,
  ];

  for (const idx of keyIndices) {
    const lm = landmarks[idx];
    if (!lm || (lm.visibility ?? 1) < 0.4) continue;
    const x = lm.x * canvas.width;
    const y = lm.y * canvas.height;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw remaining visible landmarks smaller
  for (let idx = 0; idx < landmarks.length; idx++) {
    if (keyIndices.includes(idx)) continue;
    const lm = landmarks[idx];
    if (!lm || (lm.visibility ?? 1) < 0.5) continue;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draw angle arc + label at a joint
function drawAngleAnnotation(
  ctx: CanvasRenderingContext2D,
  jx: number,
  jy: number,
  value: number,
  label: string,
  color: string,
  offsetX: number,
  offsetY: number
): void {
  // Arc
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(jx, jy, 36, 0, Math.PI / 2);
  ctx.stroke();

  // Label box
  const bx = jx + offsetX;
  const by = jy + offsetY;
  const bw = 88;
  const bh = 34;

  ctx.fillStyle = "rgba(15,20,30,0.88)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "bold 14px Inter,system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${value.toFixed(1)}°`, bx + bw / 2, by + 12);

  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px Inter,system-ui,sans-serif";
  ctx.fillText(label, bx + bw / 2, by + 24);
}

export function drawAngleAnnotations(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  landmarks: { x: number; y: number; z?: number; visibility?: number }[],
  angles: PoseAngles
): void {
  const shoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
  const elbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
  const hip = landmarks[LANDMARK_INDICES.RIGHT_HIP];
  const knee = landmarks[LANDMARK_INDICES.RIGHT_KNEE];

  if (knee && hip) {
    drawAngleAnnotation(
      ctx,
      knee.x * canvas.width,
      knee.y * canvas.height,
      angles.kneeAngle,
      "膝蓋彎曲",
      "#10b981",
      -100,
      -48
    );
  }

  if (elbow && shoulder) {
    drawAngleAnnotation(
      ctx,
      elbow.x * canvas.width,
      elbow.y * canvas.height,
      angles.elbowAngle,
      "手肘角度",
      "#f59e0b",
      8,
      -8
    );
  }

  if (hip && shoulder) {
    drawAngleAnnotation(
      ctx,
      hip.x * canvas.width,
      hip.y * canvas.height,
      angles.torsoAngle,
      "軀幹傾角",
      "#8b5cf6",
      8,
      8
    );
  }
}

// --- Analysis logic ---

interface RangeCheck {
  name: string;
  unit: string;
  detected: number;
  min: number;
  max: number;
  description: string;
  lowSug: string;
  highSug: string;
  okSug: string;
  priority: "high" | "medium" | "low";
}

export function analyzeAngles(
  angles: PoseAngles,
  bikeType: BodyMeasurements["bikeType"]
): AngleAnalysis[] {
  const isTri = bikeType === "triathlon";
  const torsoRange = isTri ? { min: 25, max: 40 } : { min: 35, max: 55 };
  const is6 = angles.position !== "3oclock";
  const kneeRange = is6 ? { min: 25, max: 35 } : { min: 70, max: 90 };
  const kneePosition = is6 ? "6 點鐘" : "3 點鐘";

  const checks: RangeCheck[] = [
    {
      name: "膝蓋彎曲角度",
      unit: "°",
      detected: angles.kneeAngle,
      min: kneeRange.min,
      max: kneeRange.max,
      description: `${kneePosition}位置膝蓋彎曲度（從伸直算起）`,
      lowSug: is6
        ? "座高偏低，建議上調 5–10mm"
        : "3 點鐘位置膝蓋彎曲不足，建議後移坐墊",
      highSug: is6
        ? "座高偏高，建議下調 5–10mm"
        : "3 點鐘位置膝蓋過度彎曲，建議前移坐墊或降低座高",
      okSug: "膝蓋彎曲度在建議範圍內",
      priority: "high",
    },
    {
      name: "軀幹傾角",
      unit: "°",
      detected: angles.torsoAngle,
      min: torsoRange.min,
      max: torsoRange.max,
      description: isTri
        ? "軀幹與垂直線夾角（三鐵攻擊姿勢）"
        : "軀幹與垂直線夾角",
      lowSug: "軀幹過於直立，建議降低把手或縮短龍頭",
      highSug: "軀幹過於前傾，建議提高把手或加長龍頭",
      okSug: "軀幹傾角在建議範圍內",
      priority: "high",
    },
    {
      name: "手肘角度",
      unit: "°",
      detected: angles.elbowAngle,
      min: 150,
      max: 165,
      description: "肩-肘-腕夾角（上半身放鬆程度）",
      lowSug: "手肘過度彎曲，建議加長龍頭或降低把手",
      highSug: "手肘過度伸直，建議縮短龍頭或上移把手",
      okSug: "手肘角度在建議範圍內",
      priority: "medium",
    },
    {
      name: "髖部角度",
      unit: "°",
      detected: angles.hipAngle,
      min: 45,
      max: 65,
      description: "肩-髖-膝夾角（骨盆前傾程度）",
      lowSug: "髖部角度偏小，坐姿較為收合",
      highSug: "髖部角度過大，建議後移坐墊或提高把手",
      okSug: "髖部角度在建議範圍內",
      priority: "low",
    },
  ];

  return checks.map((c) => {
    let status: "符合" | "偏高" | "偏低";
    let suggestion: string;

    if (c.detected >= c.min && c.detected <= c.max) {
      status = "符合";
      suggestion = c.okSug;
    } else if (c.detected < c.min) {
      status = "偏低";
      suggestion = c.lowSug;
    } else {
      status = "偏高";
      suggestion = c.highSug;
    }

    return {
      name: c.name,
      detected: c.detected,
      unit: c.unit,
      recommendedMin: c.min,
      recommendedMax: c.max,
      status,
      suggestion,
      priority: c.priority,
      description: c.description,
    };
  });
}

export function analyzeKOPS(angles: PoseAngles): KOPSAnalysis | undefined {
  if (angles.position !== "3oclock" || angles.kopsOffset === undefined)
    return undefined;

  const offset = angles.kopsOffset;
  const isOptimal = Math.abs(offset) <= 2.0;
  let description: string;
  let suggestion: string;

  if (isOptimal) {
    description = "膝蓋對齊踏板垂直線（KOPS）";
    suggestion = "膝蓋對齊良好，坐墊前後位置適當";
  } else if (offset > 2.0) {
    description = `膝蓋超前踏板軸 ${offset.toFixed(1)} 單位`;
    suggestion = "膝蓋偏前，建議後移坐墊 3–5mm";
  } else {
    description = `膝蓋落後踏板軸 ${Math.abs(offset).toFixed(1)} 單位`;
    suggestion = "膝蓋偏後，建議前移坐墊 3–5mm";
  }

  return { offset, isOptimal, description, suggestion };
}

export function calculateFitScore(analyses: AngleAnalysis[]): number {
  const weights: Record<string, number> = {
    膝蓋彎曲角度: 0.4,
    軀幹傾角: 0.3,
    手肘角度: 0.2,
    髖部角度: 0.1,
  };

  let score = 0;
  for (const a of analyses) {
    const w = weights[a.name] ?? 0.1;
    if (a.status === "符合") {
      score += w * 100;
    } else {
      const range = a.recommendedMax - a.recommendedMin;
      const deviation = Math.min(
        Math.abs(a.detected - a.recommendedMin),
        Math.abs(a.detected - a.recommendedMax)
      );
      const partial = Math.max(0, 1 - deviation / range) * 0.5;
      score += w * partial * 100;
    }
  }

  return Math.round(score);
}
