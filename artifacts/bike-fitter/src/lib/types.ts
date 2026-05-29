export interface BodyMeasurements {
  height: number;      // cm
  inseam: number;      // cm (floor to crotch)
  armLength: number;   // cm
  torsoLength: number; // cm
  bikeType: "road" | "triathlon";
}

export interface PoseAngles {
  kneeAngle: number;    // hip-knee-ankle degrees
  hipAngle: number;     // shoulder-hip-knee degrees
  torsoAngle: number;   // shoulder vs horizontal degrees
  elbowAngle: number;   // shoulder-elbow-wrist degrees
}

export interface LeMondResult {
  saddleHeight: number;
  saddleHeightMin: number;
  saddleHeightMax: number;
  saddleSetback?: string;
  handlebarDrop?: string;
  saddleForward?: string;
  aerobarsHeight?: string;
}

export interface AngleAnalysis {
  name: string;
  detected: number;
  recommendedMin: number;
  recommendedMax: number;
  status: "符合" | "偏高" | "偏低";
  suggestion: string;
}

export interface FittingRecord {
  id: string;
  date: string;
  measurements: BodyMeasurements;
  angles: PoseAngles;
  lemond: LeMondResult;
  analyses: AngleAnalysis[];
}
