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

// ── Body segment constants (from bike-fit-vis reference) ──────────────────────
const LEG_SCALE             = 1.09;   // anatomical leg (hip→ankle) = 109% inseam
const THIGH_RATIO           = 0.53;   // thigh is 53% of total leg
const SHIN_RATIO            = 0.47;   // shin is 47% of total leg
const FOOT_TO_HEIGHT_RATIO  = 0.152;  // footLength = 15.2% of height
const FOOT_CONTACT_PROP     = 0.65;   // ankle is 65% from ball toward heel
const FOOT_ANGLE_6_DEG      = 15;     // foot angle at 6-o'clock (toe slightly down)
const FOOT_ANGLE_12_DEG     =  5;     // foot angle at 12-o'clock (nearly flat)
const HIP_FORWARD_MM        = 25;     // hip joint is ~25 mm forward of saddle
const UPPER_ARM_RATIO       = 0.558;  // upperArm = 55.8% of arm length
const FORE_ARM_RATIO        = 0.442;  // foreArm  = 44.2% of arm length
const ARM_REACH_RATIO       = 0.87;   // effective shoulder→wrist reach
const RAD                   = Math.PI / 180;

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
  pedal6:     Vec2;
  ankle6:     Vec2;
  footTip6:   Vec2;
  knee6:      Vec2;
  hip:        Vec2;
  shoulder:   Vec2;
  elbow:      Vec2;
  wrist:      Vec2;
  headCenter: Vec2;
  pedal12:    Vec2;
  ankle12:    Vec2;
  knee12:     Vec2;
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
 * Two-circle intersection: find a point that is dA from `a` and dB from `b`.
 * Returns the solution on the `preferDir` side of the a→b line.
 * Gracefully clamps when the circles don't intersect (over-extended limb).
 */
function findJoint(a: Vec2, b: Vec2, dA: number, dB: number, preferDir: Vec2): Vec2 {
  const d  = len(sub(b, a));
  const lo = Math.abs(dA - dB) + 0.01;
  const hi = dA + dB - 0.01;
  const cd = Math.max(lo, Math.min(hi, d > 0 ? d : lo));
  const pa = (dA * dA - dB * dB + cd * cd) / (2 * cd);
  const h  = Math.sqrt(Math.max(0, dA * dA - pa * pa));
  const dir  = nrm(sub(b, a));
  const mid: Vec2 = { x: a.x + pa * dir.x, y: a.y + pa * dir.y };
  const perp: Vec2 = { x: -dir.y, y: dir.x };
  const p1: Vec2 = { x: mid.x + h * perp.x, y: mid.y + h * perp.y };
  const p2: Vec2 = { x: mid.x - h * perp.x, y: mid.y - h * perp.y };
  return dot(perp, preferDir) >= 0 ? p1 : p2;
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

  // ── Body segment lengths (mm) ─────────────────────────────────────────────
  const thighMm      = measurements.inseam      * 10 * LEG_SCALE * THIGH_RATIO;
  const shinMm       = measurements.inseam      * 10 * LEG_SCALE * SHIN_RATIO;
  const torsoMm      = measurements.torsoLength * 10;
  const armMm        = measurements.armLength   * 10;
  const neckMm       = measurements.height      * 10 * 0.13;
  const footLengthMm = measurements.height      * 10 * FOOT_TO_HEIGHT_RATIO;
  const footLever    = FOOT_CONTACT_PROP * footLengthMm;
  const footFwd      = footLengthMm * (1 - FOOT_CONTACT_PROP);

  const upperArmMm = armMm * UPPER_ARM_RATIO;
  const foreArmMm  = armMm * FORE_ARM_RATIO;
  const armReach   = armMm * ARM_REACH_RATIO;

  // ── Hip ──────────────────────────────────────────────────────────────────
  // Hip joint: forward of and above saddle surface.
  // y-down: "above" = smaller y.
  const hip = v(saddle.x + HIP_FORWARD_MM, saddle.y - 20);

  // ── Primary leg: 6-o'clock (pedal at bottom) ─────────────────────────────
  // Pedal directly below BB (y-down: below = larger y)
  const pedal6 = v(bb.x, bb.y + params.crankLength);

  // Foot model (bike-fit-vis):
  //   At 6-o'clock, foot is toe-slightly-down (15° below horizontal).
  //   Heel is UP and BEHIND the ball of foot.
  //   In y-down: ankle is at SMALLER y (higher) than pedal, and behind (-x).
  const foot6Rad = FOOT_ANGLE_6_DEG * RAD;
  const ankle6 = v(
    pedal6.x - footLever * Math.cos(foot6Rad),
    pedal6.y - footLever * Math.sin(foot6Rad)  // y-down: heel is UP = smaller y
  );
  // Toe tip: forward and slightly DOWN from pedal (toe-down at 15°)
  const footTip6 = v(
    pedal6.x + footFwd * Math.cos(foot6Rad),
    pedal6.y + footFwd * Math.sin(foot6Rad)    // y-down: toe is DOWN = larger y
  );

  // Knee: findJoint from hip and ankle; prefer forward (+x) to place knee in front
  const knee6 = findJoint(hip, ankle6, thighMm, shinMm, v(1, 0));

  // ── Secondary leg: 12-o'clock (pedal at top, dim) ────────────────────────
  const pedal12 = v(bb.x, bb.y - params.crankLength);
  const foot12Rad = FOOT_ANGLE_12_DEG * RAD;
  const ankle12 = v(
    pedal12.x - footLever * Math.cos(foot12Rad),
    pedal12.y - footLever * Math.sin(foot12Rad)
  );
  const knee12 = findJoint(hip, ankle12, thighMm, shinMm, v(1, 0));

  // ── Upper body ────────────────────────────────────────────────────────────
  // Shoulder: two-circle intersection with hip (torso length) and handlebar (arm reach).
  //   Prefer UPWARD: in y-down, up = v(0, -1) (smaller y = higher)
  const shoulder = findJoint(hip, handlebar, torsoMm, armReach, v(0, -1));

  // Elbow: prefer DOWNWARD (arm droops below shoulder→handlebar line)
  //   In y-down, down = v(0, +1)
  const elbow = findJoint(shoulder, handlebar, upperArmMm, foreArmMm, v(0, 1));

  const wrist = handlebar;

  // Head: above shoulder, slight forward lean
  //   y-down: above = smaller y → neckMm subtracted from y
  const headCenter = v(shoulder.x + neckMm * 0.2, shoulder.y - neckMm);

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
      pedal6:     toSVG(pedal6),
      ankle6:     toSVG(ankle6),
      footTip6:   toSVG(footTip6),
      knee6:      toSVG(knee6),
      hip:        toSVG(hip),
      shoulder:   toSVG(shoulder),
      elbow:      toSVG(elbow),
      wrist:      toSVG(wrist),
      headCenter: toSVG(headCenter),
      pedal12:    toSVG(pedal12),
      ankle12:    toSVG(ankle12),
      knee12:     toSVG(knee12),
    },
    kneeAngle6,
    torsoAngle,
    hipAngle,
    elbowAngle,
    viewBox:  { width: vbWidth, height: vbHeight },
    groundY,
  };
}
