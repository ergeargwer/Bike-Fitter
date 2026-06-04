---
name: Shoulder joint kinematics
description: Why findJoint with prefer=(0,-1) gives wrong shoulder placement in visualizer.ts, and the correct approach.
---

## Rule
Use anchor-based shoulder calculation (hip + torsoLength × direction(hip→handlebar)), NOT two-circle intersection with prefer=(0,-1).

**Why:** `findJoint(hip, handlebar, torso, armReach, v(0,-1))` places the shoulder at the perpendicular-upward intersection of the hip–handlebar circles. For a rider leaning forward to low bars, this creates an intersection point that is far ABOVE both hip and handlebar (~130cm from ground for a 175cm rider), making the stickman look bolt-upright even on a road bike.

The anchor-based formula (shoulder = hip + torsoLength × atan2(handlebar−hip)) places the shoulder along the hip→handlebar direction, naturally showing the forward lean. Result: shoulder at ~80-90cm from ground, which is correct for an aero road position.

**How to apply:** In `visualizer.ts calculateVisualizerData`, compute shoulder as:
```
const torsoDir = Math.atan2(handlebar.y - hip.y, handlebar.x - hip.x);
const shoulder = { x: hip.x + torsoMm * cos(torsoDir), y: hip.y + torsoMm * sin(torsoDir) };
```
Knee: use law-of-cosines with `base6 - angleA` for forward knee (6-o'clock), `base6 + angleA` for backward knee (12-o'clock).
