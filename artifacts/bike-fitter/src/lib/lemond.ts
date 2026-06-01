import { BikeProfile, BodyMeasurements, GeometryFeedback, LeMondResult } from "./types";

export function calculateLeMond(m: BodyMeasurements): LeMondResult {
  const sh = m.inseam * 0.883;
  const result: LeMondResult = {
    saddleHeight: Math.round(sh * 10) / 10,
    saddleHeightMin: Math.round((sh - 0.5) * 10) / 10,
    saddleHeightMax: Math.round((sh + 0.5) * 10) / 10,
  };

  if (m.bikeType === "road") {
    result.saddleSetback = "KOPS 中立或後移 0–2cm";
    result.handlebarDrop = m.height < 170 ? "把手落差 0–2cm" : "把手落差 2–6cm";
  } else {
    result.saddleForward = "坐墊前移 1–3cm（相對公路車位置）";
    result.aerobarsHeight = "手把墊低於坐墊高 5–8cm（攻擊姿勢）";
  }

  return result;
}

export function analyzeGeometryFit(
  profile: BikeProfile,
  inseam: number
): GeometryFeedback {
  const shMm = inseam * 8.83;
  const shMin = Math.round(shMm - 5);
  const shMax = Math.round(shMm + 5);

  const stackLow = profile.type === "road" ? 0.535 : 0.500;
  const stackHigh = profile.type === "road" ? 0.610 : 0.575;
  let stackAssessment: GeometryFeedback["stackAssessment"];
  if (profile.geometry.stack < shMm * stackLow) {
    stackAssessment = "偏低";
  } else if (profile.geometry.stack > shMm * stackHigh) {
    stackAssessment = "偏高";
  } else {
    stackAssessment = "符合";
  }

  const reachLow = profile.type === "road" ? inseam * 4.5 : inseam * 4.8;
  const reachHigh = profile.type === "road" ? inseam * 5.1 : inseam * 5.4;
  let reachAssessment: GeometryFeedback["reachAssessment"];
  if (profile.geometry.reach < reachLow) {
    reachAssessment = "偏短";
  } else if (profile.geometry.reach > reachHigh) {
    reachAssessment = "偏長";
  } else {
    reachAssessment = "符合";
  }

  const ht = profile.geometry.headTube;
  let headTubeNote: string;
  if (ht < 90) {
    headTubeNote = `Head tube ${ht}mm 較短，把手位置偏低，需較多 spacer 提升把手高度，適合進階騎手`;
  } else if (ht > 150) {
    headTubeNote = `Head tube ${ht}mm 較長，把手調整空間充裕，適合舒適騎姿或長途騎乘`;
  } else {
    headTubeNote = `Head tube ${ht}mm 長度適中，提供良好的把手高度調整彈性`;
  }

  const sa = profile.geometry.seatAngle;
  let seatAngleNote: string;
  if (profile.type === "tri" || sa >= 76) {
    seatAngleNote = `座管角度 ${sa}° 較陡，利於坐墊前移以優化踩踏效率，三鐵車典型設計，搭配 KOPS 分析確認膝蓋對齊`;
  } else if (sa < 72) {
    seatAngleNote = `座管角度 ${sa}° 較緩，坐墊有後移傾向，請搭配 KOPS 分析確認膝蓋位置是否符合`;
  } else {
    seatAngleNote = `座管角度 ${sa}° 為標準公路車設計，搭配 KOPS 分析可精確確認最佳坐墊前後位置`;
  }

  return {
    recommendedSaddleHeight: { min: shMin, max: shMax },
    stackAssessment,
    reachAssessment,
    headTubeNote,
    seatAngleNote,
  };
}
