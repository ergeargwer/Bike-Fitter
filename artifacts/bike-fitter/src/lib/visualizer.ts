/**
 * visualizer.ts — Bike Fitting Pose Simulator
 *
 * Coordinate system (y-down SVG native):
 *   - Origin (0, 0) = rear axle centre
 *   - x increases forward (rightward)
 *   - y increases downward  ← SVG native; BB is BELOW axle → bb.y = +bbDrop
 *   - All values in mm; SVG elements placed at raw mm coords (no pre-scaling)
 *   - viewBox is computed to enclose the bike + rider; SVG width="100%" handles
 *     the zoom to the container width automatically
 *
 * Previous bug: bb was placed at y = -bbDrop (wrong sign), making BB appear
 * ABOVE the wheel axle and inverting the entire frame geometry.
 */

import type { BikeProfile, BodyMeasurements, VisualizerParams } from "./types";

// ── Wheel ─────────────────────────────────────────────────────────────────────
const WHEEL_RADIUS_MM = 336; // 700c, mm

/** Exported so BikeVisualizer.tsx can compute rim radius (r - 25). */
export const WHEEL_RADIUS_SVG = WHEEL_RADIUS_MM;

// ── SVG canvas layout constants (mm) ─────────────────────────────────────────
// toSVG adds these to bike-space coords so the bike is centred in the viewBox.
// ABOVE_AXLE_MM must be large enough for the rider's shoulder (~1100-1200 mm
// above the axle for a 175-180 cm rider). 1400 mm gives safe headroom and
// matches the BikeVisualizer.tsx defaultGroundY fallback (1400 + 336 = 1736).
const LEFT_MM         = 436; // clearance left of rear axle (rear wheel r + margin)
const ABOVE_AXLE_MM   = 1400; // headroom above axle — must fit rider head/shoulder
const RIGHT_MM        = 536; // clearance right of front axle (wheel + bar overhang)
const BELOW_GROUND_MM = 150; // margin below ground line

const RAD = Math.PI / 180;

// ── Default geometry (Mamba FCM-2159 S size) ──────────────────────────────────
export const DEFAULT_GEOMETRY: BikeProfile["geometry"] = {
  seatTube: 460, stack: 502, reach: 385, headTube: 95,
  seatAngle: 75.0, bbDrop: 70, forkRake: 43,
  headAngle: 71.5, rearCenter: 408, wheelbase: 977,
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number }

export interface BikePositionsSVG {
  rearAxle:       Vec2;
  frontAxle:      Vec2;
  bb:             Vec2;
  seatTubeTop:    Vec2; // top of seat tube (seat cluster)
  headTubeTop:    Vec2;
  headTubeBottom: Vec2;
  stemStart:      Vec2; // top of steerer / stem clamp point
  saddle:         Vec2;
  handlebar:      Vec2;
}

export interface RiderPositionsSVG {
  hip:        Vec2;
  knee6:      Vec2;
  ankle6:     Vec2;
  knee12:     Vec2;
  ankle12:    Vec2;
  shoulder:   Vec2;
  elbow:      Vec2;
  wrist:      Vec2;   // = handlebar position
  headCenter: Vec2;
}

export interface VisualizerDrawData {
  bike:       BikePositionsSVG;
  rider:      RiderPositionsSVG;
  kneeAngle6: number; // bend from straight: 180° − interior(hip,knee,ankle)  → 25-35°
  torsoAngle: number; // degrees from vertical                                 → 35-55° road
  hipAngle:   number; // interior angle at hip: shoulder-hip-knee              → 45-65°
  elbowAngle: number; // interior angle at elbow                               → 150-165°
  viewBox:    { width: number; height: number };
  groundY:    number; // SVG y of the ground line
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function v(x: number, y: number): Vec2 { return { x, y }; }
function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function len(a: Vec2): number { return Math.sqrt(a.x * a.x + a.y * a.y); }
function nrm(a: Vec2): Vec2 { const l = len(a); return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 }; }
function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }

/** Interior angle (°) between rays BA and BC. */
function interiorAngle(a: Vec2, b: Vec2, c: Vec2): number {
  return (Math.acos(Math.max(-1, Math.min(1,
    dot(nrm(sub(a, b)), nrm(sub(c, b)))
  ))) * 180) / Math.PI;
}

/** Angle (°) between two direction vectors. */
function angleDeg(va: Vec2, vb: Vec2): number {
  return (Math.acos(Math.max(-1, Math.min(1, dot(nrm(va), nrm(vb))))) * 180) / Math.PI;
}


/**
 * Convert bike-space (mm, y-down, rear axle = 0,0) to SVG canvas coordinates.
 * Adds the left/above margin so the rear axle appears at (LEFT_MM, ABOVE_AXLE_MM).
 */
function toSVG(bike: Vec2): Vec2 {
  return { x: bike.x + LEFT_MM, y: bike.y + ABOVE_AXLE_MM };
}

// ── Public helpers ────────────────────────────────────────────────────────────
export function getDefaultCrankLength(heightCm: number): number {
  if (heightCm < 160) return 160;
  if (heightCm < 170) return 165;
  if (heightCm < 175) return 170;
  if (heightCm < 180) return 172.5;
  return 175;
}

// ── Main calculation ──────────────────────────────────────────────────────────
export function calculateVisualizerData(
  geometry: BikeProfile["geometry"],
  params: VisualizerParams,
  measurements: BodyMeasurements
): VisualizerDrawData {
  // ── Geometry defaults ──────────────────────────────────────────────────────
  const headAngle  = geometry.headAngle  ?? 72;    // deg from horizontal
  const rearCenter = geometry.rearCenter ?? 408;   // mm, rear axle → BB horizontal
  const wheelbase  = geometry.wheelbase  ?? 977;   // mm, axle-to-axle

  const seatAngleRad = geometry.seatAngle * RAD;
  const headAngleRad = headAngle * RAD;

  // ── Frame anchor points (bike-space: y-down, rear axle = 0,0) ─────────────

  // Axles — rear axle IS the origin; front axle at wheelbase
  const rearAxle  = v(0, 0);
  const frontAxle = v(wheelbase, 0);

  // BB: rearCenter forward, bbDrop below the axle line (positive y = below)
  const bb = v(rearCenter, geometry.bbDrop);

  // Seat tube cluster: BB + seatTube length along seat angle, going UP-backward
  //   x: −cos(seatAngle) because tube leans backward
  //   y: −sin(seatAngle) because tube goes UP (smaller y in y-down system)
  const seatCluster = v(
    bb.x - geometry.seatTube * Math.cos(seatAngleRad),
    bb.y - geometry.seatTube * Math.sin(seatAngleRad)
  );

  // Head tube top: defined by stack (vertical) and reach (horizontal) from BB
  //   stack goes UP  → headTubeTop.y = bb.y − stack
  //   reach goes FWD → headTubeTop.x = bb.x + reach
  const headTubeTop = v(
    bb.x + geometry.reach,
    bb.y - geometry.stack
  );

  // Head tube bottom: from top, move DOWN-forward along head angle
  //   In y-down: sin(headAngle) is the vertical component (downward = positive y)
  //              cos(headAngle) is the horizontal component (forward = positive x)
  const headTubeBottom = v(
    headTubeTop.x + geometry.headTube * Math.cos(headAngleRad),
    headTubeTop.y + geometry.headTube * Math.sin(headAngleRad)
  );

  // Saddle: extend seatpost above seatCluster, then apply horizontal setback
  //   seatpostExposure = how much seatpost sticks out above the frame's seat cluster
  const seatpostExposure = Math.max(0, params.saddleHeight - geometry.seatTube);
  const saddle = v(
    seatCluster.x - seatpostExposure * Math.cos(seatAngleRad) - params.saddleOffset,
    seatCluster.y - seatpostExposure * Math.sin(seatAngleRad)
  );

  // Stem + handlebar
  //   stemHeight is the vertical distance from BB to the handlebar/stem clamp.
  //   stemStart: same x as headTubeTop (steerer is vertical), y = handlebar height
  const stemStart = v(headTubeTop.x, bb.y - params.stemHeight);
  const handlebar = v(stemStart.x + params.stemLength, stemStart.y);

  // ── Rider joint positions (anchor-based inline formulas) ─────────────────
  // All coordinates are in raw mm (same y-down system as bike-space).
  // toSVG() is applied at the return statement.

  // Hip: directly above saddle by 30 mm
  const hip = v(saddle.x, saddle.y - 30);

  // Leg segments (spec ratios: thigh = 53%, shin = 54% of inseam in mm)
  const thighMm = measurements.inseam * 10 * 0.53;
  const shinMm  = measurements.inseam * 10 * 0.54;

  // Primary leg — crank at 6-o'clock: ankle directly below BB
  const ankle6 = v(bb.x, bb.y + params.crankLength);
  const legDx6   = ankle6.x - hip.x;
  const legDy6   = ankle6.y - hip.y;
  const legDist6 = Math.sqrt(legDx6 * legDx6 + legDy6 * legDy6);
  const safe6    = Math.min(legDist6, thighMm + shinMm - 0.1);
  const cosA6    = (thighMm * thighMm + safe6 * safe6 - shinMm * shinMm) / (2 * thighMm * safe6);
  const angleA   = Math.acos(Math.max(-1, Math.min(1, cosA6)));
  const base6    = Math.atan2(legDy6, legDx6);
  // Subtract angle → knee goes forward (clockwise on-screen = toward front wheel)
  const knee6 = v(
    hip.x + thighMm * Math.cos(base6 - angleA),
    hip.y + thighMm * Math.sin(base6 - angleA),
  );

  // Secondary leg — crank at 12-o'clock: ankle directly above BB
  const ankle12 = v(bb.x, bb.y - params.crankLength);
  // Add angle → knee goes backward (opposite side of hip-ankle baseline)
  const knee12 = v(
    hip.x + thighMm * Math.cos(base6 + angleA),
    hip.y + thighMm * Math.sin(base6 + angleA),
  );

  // Shoulder: hip + torsoLength in direction of hip → handlebar
  const torsoMm  = measurements.torsoLength * 10;
  const hbDx     = handlebar.x - hip.x;
  const hbDy     = handlebar.y - hip.y;
  const torsoDir = Math.atan2(hbDy, hbDx);
  const shoulder = v(
    hip.x + torsoMm * Math.cos(torsoDir),
    hip.y + torsoMm * Math.sin(torsoDir),
  );

  // Wrist reaches to handlebar; elbow is mid-point drooped 30 mm downward
  const wrist = handlebar;
  const elbow = v(
    (shoulder.x + wrist.x) / 2,
    (shoulder.y + wrist.y) / 2 + 30,
  );

  // Head: directly above shoulder by 120 mm (neck length)
  const headCenter = v(shoulder.x, shoulder.y - 120);

  // ── Angle calculations (matching analyze.ts conventions) ──────────────────
  // Knee bend = 180° − interior angle. Target 25-35° at 6-o'clock.
  const kneeAngle6 = Math.round(180 - interiorAngle(hip, knee6, ankle6));

  // Torso angle from vertical.
  // In y-down: "upward" reference = v(0, -1). Target 35-55° road.
  const torsoAngle = Math.round(
    angleDeg(sub(shoulder, hip), v(0, -1))
  );

  // Hip angle: interior(shoulder, hip, knee6). Target 45-65°.
  const hipAngle = Math.round(interiorAngle(shoulder, hip, knee6));

  // Elbow angle: interior(shoulder, elbow, wrist). Target 150-165°.
  const elbowAngle = Math.round(interiorAngle(shoulder, elbow, wrist));

  // ── ViewBox ───────────────────────────────────────────────────────────────
  const vbWidth  = wheelbase + LEFT_MM + RIGHT_MM;
  const vbHeight = ABOVE_AXLE_MM + WHEEL_RADIUS_MM + BELOW_GROUND_MM;
  const groundY  = ABOVE_AXLE_MM + WHEEL_RADIUS_MM;

  return {
    bike: {
      rearAxle:       toSVG(rearAxle),
      frontAxle:      toSVG(frontAxle),
      bb:             toSVG(bb),
      seatTubeTop:    toSVG(seatCluster),
      headTubeTop:    toSVG(headTubeTop),
      headTubeBottom: toSVG(headTubeBottom),
      stemStart:      toSVG(stemStart),
      saddle:         toSVG(saddle),
      handlebar:      toSVG(handlebar),
    },
    rider: {
      hip:        toSVG(hip),
      knee6:      toSVG(knee6),
      ankle6:     toSVG(ankle6),
      knee12:     toSVG(knee12),
      ankle12:    toSVG(ankle12),
      shoulder:   toSVG(shoulder),
      elbow:      toSVG(elbow),
      wrist:      toSVG(wrist),
      headCenter: toSVG(headCenter),
    },
    kneeAngle6,
    torsoAngle,
    hipAngle,
    elbowAngle,
    viewBox:  { width: vbWidth, height: vbHeight },
    groundY,
  };
}
