---
name: Bike Visualizer Kinematics
description: Key decisions and corrections for visualizer.ts leg/body kinematic model (based on bike-fit-vis reference)
---

## Rules

**Thigh > Shin**: thigh = 53% of total leg, shin = 47%. The old code had these SWAPPED.
**Why:** bike-fit-vis rider data: hip2KneeLength=500, knee2AnkleLength=440 (500/940=0.532 thigh).

**LEG_SCALE = 1.09**: anatomical leg (hip→ankle) = 109% of inseam when ankle offset is included.
**Why:** Without scale + ankle offset, LeMond saddle height produces extreme knee over-extension; 1.09 gives ~28° knee bend at target saddle height.

**Ankle ≠ Pedal center**: foot model places ankle behind/above pedal using footLever = 0.65×footLength.
- 6-o'clock: footAngle=15° (toe-slightly-down), 12-o'clock: footAngle=5°
- footLength = height × 0.152 (in same units)

**Knee angle = BEND**: report 180°−interior(hip,knee,ankle). NOT the interior angle.
**Why:** matches analyze.ts calculateKneeBend convention; target range is 25–35°.

**Hip forward offset**: hip.x = saddle.x + 25mm (from bike-fit-vis seatRiderOffsetX=25). No vertical offset — adding vertical breaks LeMond formula geometry.

**Elbow via findJoint**: upper arm = 55.8%, forearm = 44.2% of arm length (from bike-fit-vis 290/520, 230/520). Prefer downward direction.

**Arm reach ratio = 0.87**: effective shoulder→wrist constraint = 87% of arm length (520/600).

**Four angles displayed**: knee bend (25–35°), torso from vertical (35–55° road, 25–40° tri), hip interior (45–65°), elbow interior (150–165°). All match analyze.ts conventions.
