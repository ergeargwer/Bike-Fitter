import { BodyMeasurements, LeMondResult } from "@/context/AppContext";

export function calculateLeMond(m: BodyMeasurements): LeMondResult {
  const sh = m.inseam * 0.883;
  const result: LeMondResult = {
    saddleHeight: Math.round(sh * 10) / 10,
    saddleHeightMin: Math.round((sh - 0.5) * 10) / 10,
    saddleHeightMax: Math.round((sh + 0.5) * 10) / 10,
  };

  if (m.bikeType === "road") {
    result.saddleSetback = "KOPS 中立或後移 0-2cm";
    result.handlebarDrop = m.height < 170 ? "把手落差 0-2cm" : "把手落差 2-6cm";
  } else {
    result.saddleForward = "坐墊前移 1-3cm（相對公路車位置）";
    result.aerobarsHeight = "手把墊低於坐墊高 5-8cm（攻擊姿勢）";
  }

  return result;
}
