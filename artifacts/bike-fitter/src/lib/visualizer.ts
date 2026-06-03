import { BikeProfile, BodyMeasurements, VisualizerParams } from "./types";

interface Vec2 { x: number; y: number }

// ── SVG layout constants (all in mm — the viewBox is in real mm) ────────────
export const WHEEL_RADIUS_SVG = 336;  // 700c + 25mm tire ≈ 672mm diameter / 2
const WHEEL_RADIUS_MM = WHEEL_RADIUS_SVG;
const H_PAD      = 150;  // horizontal padding beyond wheel edges (mm)
const ABOVE_AXL  = 1400; // viewBox mm above the axle/ground level
const BELOW_AXL  = WHEEL_RADIUS_MM + H_PAD;  // below axle (wheel + clearance)

// ── Body segment constants (bike-fit-vis reference, validated analytically) ──
const LEG_SCALE              = 1.09;   // hip-to-ankle / inseam at LeMond saddle height
const THIGH_RATIO            = 0.53;   // thigh / total leg
const SHIN_RATIO             = 0.47;   // shin / total leg
const FOOT_TO_HEIGHT_RATIO   = 0.152;  // foot length / height
const FOOT_CONTACT_PROPORTION= 0.65;   // ankle position along foot (ball→heel)
const FOOT_ANGLE_6_DEG       = 15;     // foot angle at 6-o'clock (toe slightly down)
const FOOT_ANGLE_12_DEG      = 5;      // foot nearly horizontal at 12-o'clock
const HIP_FORWARD_MM         = 25;     // hip joint is 25mm forward of saddle center
const UPPER_ARM_RATIO        = 0.558;  // shoulder→elbow / total arm
const FORE_ARM_RATIO         = 0.442;  // elbow→wrist / total arm
const ARM_REACH_RATIO        = 0.87;   // effective shoulder→wrist reach

const DEG = Math.PI / 180;

// ── Vector helpers ───────────────────────────────────────────────────────────
function v(x: number, y: number): Vec2 { return { x, y }; }
function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function len(a: Vec2): number { return Math.sqrt(a.x * a.x + a.y * a.y); }
function nrm(a: Vec2): Vec2 { const l = len(a); return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 }; }
function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }

function angleDeg(v1: Vec2, v2: Vec2): number {
  return (Math.acos(Math.max(-1, Math.min(1, dot(nrm(v1), nrm(v2))))) * 180) / Math.PI;
}

function interiorAngle(a: Vec2, b: Vec2, c: Vec2): number {
  return angleDeg(sub(a, b), sub(c, b));
}

// Two-circle intersection — find the joint at dA from a and dB from b.
// Clamps gracefully when circles barely intersect (over/under-extended limbs).
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

// ── Interfaces ────────────────────────────────────────────────────────────────
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
  ankle6: Vec2;
  footTip6: Vec2;
  knee6: Vec2;
  hip: Vec2;
  shoulder: Vec2;
  elbow: Vec2;
  wrist: Vec2;
  headCenter: Vec2;
  pedal12: Vec2;
  ankle12: Vec2;
  knee12: Vec2;
}

export interface VisualizerDrawData {
  bike: BikePositionsSVG;
  rider: RiderPositionsSVG;
  kneeAngle6:  number;
  torsoAngle:  number;
  hipAngle:    number;
  elbowAngle:  number;
  viewBox:  { width: number; height: number };
  groundY:  number;  // SVG y-coordinate of the ground contact line
}

// ── Default geometry (Mamba FCM-2159 S size) ─────────────────────────────────
export const DEFAULT_GEOMETRY: BikeProfile["geometry"] = {
  seatTube:   460,
  stack:      502,
  reach:      385,
  headTube:    95,
  seatAngle:   75,
  bbDrop:      70,
  forkRake:    43,
  headAngle:   71.5,
  rearCenter:  408,
  wheelbase:   977,
};

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
  // Geometry with fallbacks for optional fields (default to Mamba S size)
  const headAngle  = geometry.headAngle  ?? 71.5;
  const rearCenter = geometry.rearCenter ?? 408;
  const wheelbase  = geometry.wheelbase  ?? 977;

  const seatAngleRad = geometry.seatAngle * DEG;
  const headAngleRad = headAngle * DEG;

  // SVG layout: rear axle at (originX, originY) in viewBox mm coords
  const originX = WHEEL_RADIUS_MM + H_PAD;  // = 486 mm
  const originY = ABOVE_AXL;                // = 1400 mm (axle level SVG y)

  // Bike-space to SVG transform (X=forward→right, Y=up→negative SVG-y)
  const toSVG = (pt: Vec2): Vec2 => ({
    x: originX + pt.x,
    y: originY - pt.y,
  });

  // ── Frame geometry (bike-space: mm, origin=rear axle, X=fwd, Y=up) ─────────

  // BB: rearCenter is the chord from rear axle to BB; bbDrop is vertical drop below axle
  const bbX = Math.sqrt(Math.max(0, rearCenter * rearCenter - geometry.bbDrop * geometry.bbDrop));
  const bb: Vec2 = v(bbX, -geometry.bbDrop);

  // Front axle: wheelbase is the horizontal distance between axles
  const frontAxle: Vec2 = v(wheelbase, 0);
  const rearAxle:  Vec2 = v(0, 0);

  // Seat tube top: from BB backward and upward along seat angle
  const seatTubeTop: Vec2 = v(
    bb.x - geometry.seatTube * Math.cos(seatAngleRad),
    bb.y + geometry.seatTube * Math.sin(seatAngleRad)
  );

  // Head tube top: from BB by stack (up) and reach (forward)
  const headTubeTop: Vec2 = v(
    bb.x + geometry.reach,
    bb.y + geometry.stack
  );

  // Head tube bottom: from headTubeTop along head angle (forward+down)
  // headAngle from horizontal → moving from top to bottom: (+cos, -sin) in bike-space
  const headTubeBottom: Vec2 = v(
    headTubeTop.x + geometry.headTube * Math.cos(headAngleRad),
    headTubeTop.y - geometry.headTube * Math.sin(headAngleRad)
  );

  // Saddle: behind BB by saddleOffset, above BB by saddleHeight
  const saddle: Vec2 = v(
    bb.x - params.saddleOffset,
    bb.y + params.saddleHeight
  );

  // Stem: steerer above headTubeTop (vertical), then horizontal stem
  const stemStart: Vec2 = v(headTubeTop.x, bb.y + params.stemHeight);
  const handlebar: Vec2 = v(stemStart.x + params.stemLength, stemStart.y);

  // ── Body segment lengths (in mm) ──────────────────────────────────────────
  const thighMm       = measurements.inseam     * 10 * LEG_SCALE * THIGH_RATIO;
  const shinMm        = measurements.inseam     * 10 * LEG_SCALE * SHIN_RATIO;
  const torsoMm       = measurements.torsoLength * 10;
  const armMm         = measurements.armLength   * 10;
  const neckMm        = measurements.height      * 10 * 0.13;
  const footLengthMm  = measurements.height      * 10 * FOOT_TO_HEIGHT_RATIO;
  const footLever     = FOOT_CONTACT_PROPORTION  * footLengthMm;

  const upperArmMm = armMm * UPPER_ARM_RATIO;
  const foreArmMm  = armMm * FORE_ARM_RATIO;
  const armReach   = armMm * ARM_REACH_RATIO;

  // ── Hip ───────────────────────────────────────────────────────────────────
  const hip: Vec2 = v(saddle.x + HIP_FORWARD_MM, saddle.y);

  // ── Leg kinematics — 6-o'clock (primary, bright) ─────────────────────────
  const pedal6: Vec2 = v(bb.x, bb.y - params.crankLength);

  const foot6Rad = FOOT_ANGLE_6_DEG * DEG;
  const ankle6: Vec2 = v(
    pedal6.x - footLever * Math.cos(foot6Rad),
    pedal6.y + footLever * Math.sin(foot6Rad)
  );
  const footFwd  = footLengthMm * (1 - FOOT_CONTACT_PROPORTION);
  const footTip6: Vec2 = v(
    pedal6.x + footFwd * Math.cos(foot6Rad),
    pedal6.y - footFwd * Math.sin(foot6Rad)
  );
  const knee6 = findJoint(hip, ankle6, thighMm, shinMm, v(1, 0));

  // ── Leg kinematics — 12-o'clock (secondary, dim) ─────────────────────────
  const pedal12: Vec2 = v(bb.x, bb.y + params.crankLength);
  const foot12Rad = FOOT_ANGLE_12_DEG * DEG;
  const ankle12: Vec2 = v(
    pedal12.x - footLever * Math.cos(foot12Rad),
    pedal12.y + footLever * Math.sin(foot12Rad)
  );
  const knee12 = findJoint(hip, ankle12, thighMm, shinMm, v(1, 0));

  // ── Upper body ────────────────────────────────────────────────────────────
  // Shoulder: two-circle intersection — torso from hip, arm-reach from handlebar
  // Prefer upward solution (shoulder above hip in a forward-leaning cyclist)
  const shoulder = findJoint(hip, handlebar, torsoMm, armReach, v(0, 1));

  // Elbow: prefer downward (natural arm bend below shoulder→handlebar line)
  const elbow = findJoint(shoulder, handlebar, upperArmMm, foreArmMm, v(0, -1));

  const wrist = handlebar;
  const headCenter: Vec2 = add(shoulder, v(neckMm * 0.2, neckMm));

  // ── Angle calculations ────────────────────────────────────────────────────
  // Knee bend: 180° − interior(hip, knee, ankle). Target 25–35°.
  const kneeAngle6  = Math.round(180 - interiorAngle(hip, knee6, ankle6));
  // Torso from vertical: angle(shoulder−hip, vertical). Target 35–55° road.
  const torsoAngle  = Math.round(angleDeg(sub(shoulder, hip), v(0, 1)));
  // Hip angle: interior at hip between shoulder and knee. Target 45–65°.
  const hipAngle    = Math.round(interiorAngle(shoulder, hip, knee6));
  // Elbow angle: interior at elbow. Target 150–165°.
  const elbowAngle  = Math.round(interiorAngle(shoulder, elbow, wrist));

  // ── ViewBox ───────────────────────────────────────────────────────────────
  const vbWidth  = wheelbase + 2 * (WHEEL_RADIUS_MM + H_PAD);
  const vbHeight = ABOVE_AXL + BELOW_AXL;
  const groundY  = ABOVE_AXL + WHEEL_RADIUS_MM;  // bottom of wheel = actual ground

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
    viewBox:  { width: vbWidth, height: vbHeight },
    groundY,
  };
}
