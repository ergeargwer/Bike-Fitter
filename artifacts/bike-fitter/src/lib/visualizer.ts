import { BikeProfile, BodyMeasurements, VisualizerParams } from "./types";

interface Vec2 { x: number; y: number }

// SVG constants (viewBox "0 0 400 300")
const SCALE = 0.15;              // SVG units per mm
const WHEEL_RADIUS_MM = 340;
const CHAIN_STAY_MM = 420;       // rear axle to BB horizontal
const HEAD_ANGLE_DEG = 73;
const FORK_LENGTH_MM = 385;

export const WHEEL_RADIUS_SVG = WHEEL_RADIUS_MM * SCALE;
export const GROUND_SVG_Y = 285;
const SVG_ORIGIN: Vec2 = { x: 50, y: GROUND_SVG_Y - WHEEL_RADIUS_SVG };

// ── Body segment constants (from bike-fit-vis reference data) ──────────────
// Leg: hip-joint to ankle is ~109% of inseam when ankle offset is included.
// This produces ~27-30° knee bend at LeMond saddle height (verified analytically).
const LEG_SCALE = 1.09;
// Thigh (hip→knee) is 53% of total leg; shin (knee→ankle) is 47%.
// (bike-fit-vis rider data: hip2KneeLength=500, knee2AnkleLength=440 ⟹ 500/940=0.532)
const THIGH_RATIO = 0.53;
const SHIN_RATIO  = 0.47;

// Foot model (bike-fit-vis: footLength=210, footContactProportion=0.65)
const FOOT_TO_HEIGHT_RATIO    = 0.152; // foot length = 15.2% of height
const FOOT_CONTACT_PROPORTION = 0.65;  // ankle is 65% along foot from ball toward heel
const FOOT_ANGLE_6_DEG        = 15;    // foot angle at 6-o'clock: toe-slightly-down (positive = heel up)
const FOOT_ANGLE_12_DEG       = 5;     // foot nearly horizontal at 12-o'clock

// Hip offset from saddle surface (bike-fit-vis: seatRiderOffsetX=25, no vertical in our coord system)
const HIP_FORWARD_MM = 25; // hip joint is 25mm forward of saddle center

// Arm segment ratios (bike-fit-vis: shoulder2Elbow=290, elbow2Wrist=230, total=520)
const UPPER_ARM_RATIO = 0.558; // 290/520
const FORE_ARM_RATIO  = 0.442; // 230/520
const ARM_REACH_RATIO = 0.87;  // effective shoulder-to-wrist reach vs full arm length

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
function nrm(a: Vec2): Vec2 { const l = len(a); return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 }; }
function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }

// Interior angle (degrees) at vertex formed by vectors v1 and v2 from same origin
function angleDeg(v1: Vec2, v2: Vec2): number {
  return (Math.acos(Math.max(-1, Math.min(1, dot(nrm(v1), nrm(v2))))) * 180) / Math.PI;
}

// Interior angle (degrees) at joint B, formed by A→B and C→B rays
// Matches analyze.ts calculateInteriorAngle convention
function interiorAngle(a: Vec2, b: Vec2, c: Vec2): number {
  return angleDeg(sub(a, b), sub(c, b));
}

// Find the joint point at distance dA from a and dB from b.
// Clamps gracefully when circles don't intersect (e.g., over-extended leg).
// preferDir: pick the intersection solution on this side of the a→b midpoint.
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

// Bike-space (mm, origin=rear axle, X=forward, Y=up) → SVG space
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
  // Primary leg (6-o'clock): pedal → ankle → knee → hip
  pedal6: Vec2;
  ankle6: Vec2;
  footTip6: Vec2;
  knee6: Vec2;
  hip: Vec2;
  // Upper body
  shoulder: Vec2;
  elbow: Vec2;
  wrist: Vec2;
  headCenter: Vec2;
  // Secondary leg (12-o'clock, dim)
  pedal12: Vec2;
  ankle12: Vec2;
  knee12: Vec2;
}

export interface VisualizerDrawData {
  bike: BikePositionsSVG;
  rider: RiderPositionsSVG;
  // Angles — same conventions as analyze.ts:
  kneeAngle6: number;  // bend from straight: 180° - interior(hip,knee,ankle) → target 25-35°
  torsoAngle: number;  // from vertical: angle(shoulder-hip vs vertical) → target 35-55° road
  hipAngle: number;    // interior(shoulder,hip,knee) → target 45-65°
  elbowAngle: number;  // interior(shoulder,elbow,wrist) → target 150-165°
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

  // ── Bike frame (bike-space, mm) ──────────────────────────────────────────
  const rearAxle = v(0, 0);
  const bb = v(CHAIN_STAY_MM, -geometry.bbDrop);

  // Seat tube top: along seat angle from BB
  const seatTubeTop = v(
    bb.x - geometry.seatTube * Math.cos(seatAngleRad),
    bb.y + geometry.seatTube * Math.sin(seatAngleRad)
  );

  // Head tube: positioned by stack (height) and reach (forward) from BB
  const headTubeTop    = v(bb.x + geometry.reach, bb.y + geometry.stack);
  const headTubeBottom = v(headTubeTop.x, headTubeTop.y - geometry.headTube);

  // Front axle: fork from head tube bottom along head angle
  const frontAxle = v(
    headTubeBottom.x + FORK_LENGTH_MM * Math.sin(forkFromVert) + geometry.forkRake * Math.cos(forkFromVert),
    headTubeBottom.y - FORK_LENGTH_MM * Math.cos(forkFromVert)
  );

  // Saddle: behind BB by saddleOffset, above BB by saddleHeight
  const saddle = v(bb.x - params.saddleOffset, bb.y + params.saddleHeight);

  // Handlebar: horizontal stem from steerer; height = BB + stemHeight
  const stemStart  = v(headTubeTop.x, bb.y + params.stemHeight);
  const handlebar  = v(headTubeTop.x + params.stemLength, bb.y + params.stemHeight);

  // ── Body segment lengths ─────────────────────────────────────────────────
  // From bike-fit-vis reference: thigh > shin (corrected ratio), scaled so
  // hip-to-ankle chain produces ~28° knee bend at LeMond saddle height.
  const thighMm      = measurements.inseam * 10 * LEG_SCALE * THIGH_RATIO;
  const shinMm       = measurements.inseam * 10 * LEG_SCALE * SHIN_RATIO;
  const torsoMm      = measurements.torsoLength * 10;
  const armMm        = measurements.armLength * 10;
  const neckMm       = measurements.height * 10 * 0.13;
  const footLengthMm = measurements.height * 10 * FOOT_TO_HEIGHT_RATIO;
  const footLever    = FOOT_CONTACT_PROPORTION * footLengthMm; // ankle offset from ball-of-foot

  const upperArmMm = armMm * UPPER_ARM_RATIO;
  const foreArmMm  = armMm * FORE_ARM_RATIO;
  const armReach   = armMm * ARM_REACH_RATIO; // effective shoulder→wrist reach constraint

  // ── Hip position ─────────────────────────────────────────────────────────
  // Hip joint is 25mm forward of saddle center (bike-fit-vis: seatRiderOffsetX=+25).
  // Vertical: hip is at saddle height (LeMond formula calibrated to this reference).
  const hip = v(saddle.x + HIP_FORWARD_MM, saddle.y);

  // ── Leg kinematics (6-o'clock primary leg) ───────────────────────────────
  // Pedal at bottom: directly below BB
  const pedal6 = v(bb.x, bb.y - params.crankLength);

  // Ankle: offset from pedal center by foot lever.
  // Positive foot angle = toe-down (heel up). At 6-o'clock the foot is toe-slightly-down.
  // ankle is behind pedal (−x) and slightly above (+y because sin(15°)>0).
  const foot6Rad = (FOOT_ANGLE_6_DEG * Math.PI) / 180;
  const ankle6 = v(
    pedal6.x - footLever * Math.cos(foot6Rad),
    pedal6.y + footLever * Math.sin(foot6Rad)
  );

  // Foot tip (toe-end, forward of pedal)
  const footFwd = footLengthMm * (1 - FOOT_CONTACT_PROPORTION);
  const footTip6 = v(
    pedal6.x + footFwd * Math.cos(foot6Rad),
    pedal6.y - footFwd * Math.sin(foot6Rad)
  );

  // Knee: findJoint from hip and ankle, prefer forward (x+)
  const knee6 = findJoint(hip, ankle6, thighMm, shinMm, v(1, 0));

  // ── Leg kinematics (12-o'clock secondary leg) ────────────────────────────
  const pedal12 = v(bb.x, bb.y + params.crankLength);
  const foot12Rad = (FOOT_ANGLE_12_DEG * Math.PI) / 180;
  const ankle12 = v(
    pedal12.x - footLever * Math.cos(foot12Rad),
    pedal12.y + footLever * Math.sin(foot12Rad)
  );
  const knee12 = findJoint(hip, ankle12, thighMm, shinMm, v(1, 0));

  // ── Upper body ────────────────────────────────────────────────────────────
  // Shoulder: two-circle intersection (hip=torsoMm, handlebar=armReach).
  // Prefer upward solution — in our coordinate system this places shoulder
  // above and forward of hip, consistent with a forward-leaning cyclist.
  const shoulder = findJoint(hip, handlebar, torsoMm, armReach, v(0, 1));

  // Elbow: findJoint from shoulder and handlebar using upper/forearm lengths.
  // Prefer downward (elbow drops below shoulder→handlebar line = natural arm bend).
  const elbow = findJoint(shoulder, handlebar, upperArmMm, foreArmMm, v(0, -1));

  // Wrist at handlebar
  const wrist = handlebar;

  // Head: above shoulder, slight forward offset from neck angle
  const headCenter = add(shoulder, v(neckMm * 0.2, neckMm));

  // ── Angle calculations (matching analyze.ts conventions) ─────────────────
  // Knee bend: 180° − interior(hip, knee, ankle). Target 25-35° at 6-o'clock.
  const kneeAngle6 = Math.round(180 - interiorAngle(hip, knee6, ankle6));

  // Torso angle from vertical: angle between (shoulder-hip) and vertical (0,1).
  // Target 35-55° (road), 25-40° (triathlon).
  const torsoAngle = Math.round(angleDeg(sub(shoulder, hip), v(0, 1)));

  // Hip angle: interior angle at hip between shoulder and knee6.
  // Matches analyze.ts: calculateInteriorAngle(shoulder, hip, knee). Target 45-65°.
  const hipAngle = Math.round(interiorAngle(shoulder, hip, knee6));

  // Elbow angle: interior angle at elbow. Target 150-165°.
  const elbowAngle = Math.round(interiorAngle(shoulder, elbow, wrist));

  return {
    bike: {
      rearAxle:      toSVG(rearAxle),
      frontAxle:     toSVG(frontAxle),
      bb:            toSVG(bb),
      seatTubeTop:   toSVG(seatTubeTop),
      headTubeTop:   toSVG(headTubeTop),
      headTubeBottom: toSVG(headTubeBottom),
      stemStart:     toSVG(stemStart),
      saddle:        toSVG(saddle),
      handlebar:     toSVG(handlebar),
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
  };
}
