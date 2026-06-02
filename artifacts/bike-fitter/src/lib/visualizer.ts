import { BikeProfile, BodyMeasurements, VisualizerParams } from "./types";

interface Vec2 { x: number; y: number }

// SVG constants (viewBox "0 0 400 300")
const SCALE = 0.15;              // SVG units per mm
const WHEEL_RADIUS_MM = 340;
const CHAIN_STAY_MM = 420;       // rear axle to BB horizontal (estimated)
const HEAD_ANGLE_DEG = 73;
const FORK_LENGTH_MM = 385;

export const WHEEL_RADIUS_SVG = WHEEL_RADIUS_MM * SCALE;
export const GROUND_SVG_Y = 285;
const SVG_ORIGIN: Vec2 = { x: 50, y: GROUND_SVG_Y - WHEEL_RADIUS_SVG };

export const DEFAULT_GEOMETRY: BikeProfile["geometry"] = {
  seatTube: 520,
  stack: 560,
  reach: 380,
  headTube: 120,
  seatAngle: 73,
  bbDrop: 70,
  forkRake: 45,
};

function v(x: number, y: number): Vec2 { return { x, y }; }
function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function scl(a: Vec2, s: number): Vec2 { return { x: a.x * s, y: a.y * s }; }
function len(a: Vec2): number { return Math.sqrt(a.x * a.x + a.y * a.y); }
function nrm(a: Vec2): Vec2 { const l = len(a); return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 1 }; }
function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }

function angleDeg(v1: Vec2, v2: Vec2): number {
  return (Math.acos(Math.max(-1, Math.min(1, dot(nrm(v1), nrm(v2))))) * 180) / Math.PI;
}

// Find the joint point at dA from point a and dB from point b.
// When the circles don't intersect, clamp to the closest valid configuration.
// preferDir: pick the intersection solution in this direction (bike space: Y = up).
function findJoint(a: Vec2, b: Vec2, dA: number, dB: number, preferDir: Vec2): Vec2 {
  const d = len(sub(b, a));
  const minD = Math.abs(dA - dB);
  const maxD = dA + dB;
  const cd = Math.max(minD + 0.01, Math.min(maxD - 0.01, d > 0 ? d : 0.01));
  const pa = (dA * dA - dB * dB + cd * cd) / (2 * cd);
  const h = Math.sqrt(Math.max(0, dA * dA - pa * pa));
  const dir = nrm(sub(b, a));
  const mid: Vec2 = { x: a.x + pa * dir.x, y: a.y + pa * dir.y };
  const perp: Vec2 = { x: -dir.y, y: dir.x };
  const p1: Vec2 = { x: mid.x + h * perp.x, y: mid.y + h * perp.y };
  const p2: Vec2 = { x: mid.x - h * perp.x, y: mid.y - h * perp.y };
  return dot(perp, preferDir) >= 0 ? p1 : p2;
}

// Bike space (mm, origin = rear axle, X = forward, Y = up) → SVG space
export function toSVG(bike: Vec2): Vec2 {
  return {
    x: SVG_ORIGIN.x + bike.x * SCALE,
    y: SVG_ORIGIN.y - bike.y * SCALE,
  };
}

export interface BikePositionsSVG {
  rearAxle: Vec2;
  frontAxle: Vec2;
  bb: Vec2;
  seatTubeTop: Vec2;
  headTubeTop: Vec2;
  headTubeBottom: Vec2;
  stemStart: Vec2;
  saddle: Vec2;
  handlebar: Vec2;
}

export interface RiderPositionsSVG {
  pedal6: Vec2;
  knee6: Vec2;
  hip: Vec2;
  shoulder: Vec2;
  elbow: Vec2;
  wrist: Vec2;
  headCenter: Vec2;
  pedal12: Vec2;
  knee12: Vec2;
}

export interface VisualizerDrawData {
  bike: BikePositionsSVG;
  rider: RiderPositionsSVG;
  kneeAngle6: number;
  torsoAngle: number;
}

export function getDefaultCrankLength(heightCm: number): number {
  if (heightCm < 160) return 160;
  if (heightCm < 170) return 165;
  if (heightCm < 175) return 170;
  if (heightCm < 180) return 172.5;
  return 175;
}

export function calculateVisualizerData(
  geometry: BikeProfile["geometry"],
  params: VisualizerParams,
  measurements: BodyMeasurements
): VisualizerDrawData {
  const seatAngleRad = (geometry.seatAngle * Math.PI) / 180;
  const headAngleRad = (HEAD_ANGLE_DEG * Math.PI) / 180;
  const forkFromVert = Math.PI / 2 - headAngleRad;

  // --- Bike frame (bike-space, mm) ---
  const rearAxle = v(0, 0);
  const bb = v(CHAIN_STAY_MM, -geometry.bbDrop);

  const seatTubeTop = v(
    bb.x - geometry.seatTube * Math.cos(seatAngleRad),
    bb.y + geometry.seatTube * Math.sin(seatAngleRad)
  );
  const headTubeTop = v(bb.x + geometry.reach, bb.y + geometry.stack);
  const headTubeBottom = v(headTubeTop.x, headTubeTop.y - geometry.headTube);

  const frontAxle = v(
    headTubeBottom.x + FORK_LENGTH_MM * Math.sin(forkFromVert) + geometry.forkRake * Math.cos(forkFromVert),
    headTubeBottom.y - FORK_LENGTH_MM * Math.cos(forkFromVert)
  );

  // Saddle: backward by saddleOffset from BB, up by saddleHeight
  const saddle = v(bb.x - params.saddleOffset, bb.y + params.saddleHeight);

  // Handlebar: forward from head tube by stemLength; height = BB + stemHeight
  const handlebar = v(headTubeTop.x + params.stemLength, bb.y + params.stemHeight);

  // Stem attaches at steerer at handlebar.y
  const stemStart = v(headTubeTop.x, bb.y + params.stemHeight);

  // --- Rider positions (bike-space) ---
  const thighMm = measurements.inseam * 10 * 0.47;
  const shinMm = measurements.inseam * 10 * 0.53;
  const torsoMm = measurements.torsoLength * 10;
  const armMm = measurements.armLength * 10;
  const neckMm = measurements.height * 10 * 0.13;

  const hip = saddle;

  // 6-oclock: pedal directly below BB
  const pedal6 = v(bb.x, bb.y - params.crankLength);
  // Knee forward of hip-ankle axis
  const knee6 = findJoint(hip, pedal6, thighMm, shinMm, v(1, 0));

  // Shoulder: torsoMm from hip, armMm*0.92 from handlebar, prefer upward
  const armReach = armMm * 0.92;
  const shoulder = findJoint(hip, handlebar, torsoMm, armReach, v(0, 1));

  // Elbow: 0.55 * armMm from shoulder toward handlebar
  const elbow = add(shoulder, scl(nrm(sub(handlebar, shoulder)), armMm * 0.55));

  // Wrist = handlebar
  const wrist = handlebar;

  // Head: straight up from shoulder
  const headCenter = add(shoulder, v(0, neckMm));

  // 12-oclock: pedal directly above BB
  const pedal12 = v(bb.x, bb.y + params.crankLength);
  const knee12 = findJoint(hip, pedal12, thighMm, shinMm, v(1, 0));

  // --- Angles ---
  const kneeAngle6 = Math.round(angleDeg(sub(hip, knee6), sub(pedal6, knee6)));
  const torsoAngle = Math.round(angleDeg(sub(shoulder, hip), v(0, 1)));

  return {
    bike: {
      rearAxle: toSVG(rearAxle),
      frontAxle: toSVG(frontAxle),
      bb: toSVG(bb),
      seatTubeTop: toSVG(seatTubeTop),
      headTubeTop: toSVG(headTubeTop),
      headTubeBottom: toSVG(headTubeBottom),
      stemStart: toSVG(stemStart),
      saddle: toSVG(saddle),
      handlebar: toSVG(handlebar),
    },
    rider: {
      pedal6: toSVG(pedal6),
      knee6: toSVG(knee6),
      hip: toSVG(hip),
      shoulder: toSVG(shoulder),
      elbow: toSVG(elbow),
      wrist: toSVG(wrist),
      headCenter: toSVG(headCenter),
      pedal12: toSVG(pedal12),
      knee12: toSVG(knee12),
    },
    kneeAngle6,
    torsoAngle,
  };
}
