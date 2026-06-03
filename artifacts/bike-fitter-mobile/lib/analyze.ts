import {
  AngleAnalysis,
  BodyMeasurements,
  KOPSAnalysis,
  PoseAngles,
} from "@/context/AppContext";

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
        ? "座高偏低，建議上調 5-10mm"
        : "3 點鐘位置膝蓋彎曲不足，建議後移坐墊",
      highSug: is6
        ? "座高偏高，建議下調 5-10mm"
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
    suggestion = "膝蓋偏前，建議後移坐墊 3-5mm";
  } else {
    description = `膝蓋落後踏板軸 ${Math.abs(offset).toFixed(1)} 單位`;
    suggestion = "膝蓋偏後，建議前移坐墊 3-5mm";
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
