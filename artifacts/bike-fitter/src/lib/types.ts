export interface BodyMeasurements {
  height: number;
  inseam: number;
  armLength: number;
  torsoLength: number;
  bikeType: "road" | "triathlon";
}

export interface PoseAngles {
  kneeAngle: number;    // bend from straight (180° - interior): 6-oclock 25-35°, 3-oclock 70-90°
  hipAngle: number;     // shoulder-hip-knee interior angle: 45-60°
  torsoAngle: number;   // from vertical (interior of verticalRef-hip-shoulder): 35-55°
  elbowAngle: number;   // shoulder-elbow-wrist interior: 150-165°
  position: "6oclock" | "3oclock";
  kopsOffset?: number;  // normalized knee-over-ankle offset (3-oclock only, positive = knee ahead)
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
  unit: string;
  recommendedMin: number;
  recommendedMax: number;
  status: "符合" | "偏高" | "偏低";
  suggestion: string;
  priority: "high" | "medium" | "low";
  description: string;
}

export interface KOPSAnalysis {
  offset: number;
  isOptimal: boolean;
  description: string;
  suggestion: string;
}

export interface FittingRecord {
  id: string;
  date: string;
  measurements: BodyMeasurements;
  sixOClockAngles: PoseAngles;
  threeOClockAngles?: PoseAngles;
  lemond: LeMondResult;
  analyses: AngleAnalysis[];
  kops?: KOPSAnalysis;
  fitScore: number;
}
