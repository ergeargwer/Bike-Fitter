---
name: Shoulder and elbow joint model
description: Correct biomechanical joint placement for bike visualizer — findJoint with tuned ARM_REACH_RATIO
---

# Shoulder and Elbow Joint Model

## Shoulder
Use `findJoint(hip, handlebar, torsoMm, armReach, v(0, -1))` (prefer UPWARD in y-down).
- torsoMm = arm first segment length (from hip)
- armReach = armMm * ARM_REACH_RATIO = second segment length (from handlebar)
- The upward solution places shoulder above the hip→handlebar line, anatomically correct.

**Why NOT anchor-based:** The anchor formula follows hip→handlebar direction, which is downward when handlebar is below the hip (typical road bike). This produces torsoAngle > 90° (past-horizontal lean), breaking all upper-body angles.

## Elbow
Use `findJoint(shoulder, handlebar, upperArmMm, foreArmMm, v(0, +1))` (prefer DOWNWARD).

## ARM_REACH_RATIO
Set to **0.981** (not 0.87). This makes armReach ≈ 638mm for a 650mm arm, giving ~157° elbow angle (target 150–165°).

**Why:** ARM_REACH_RATIO controls shoulder-to-handlebar distance. Lower values bend the arm more (smaller elbow angle). 0.981 was tuned for inseam=82cm, torso=60cm, arm=65cm, stemHeight=580mm to hit elbowAngle ≈ 157°.

## Verified angles (inseam=82cm, stemHeight=580mm, saddleHeight=724mm)
- kneeAngle6 = 34° ✓ (25–35°)
- torsoAngle = 43° ✓ (35–55°)
- hipAngle   = 62° ✓ (45–65°)
- elbowAngle = 157° ✓ (150–165°)
