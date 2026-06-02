---
name: BikeVisualizer geometry approach
description: Key decisions for SVG bike+stickman rendering in BikeVisualizer page
---

## Shoulder placement
Use 2-circle intersection (`findJoint`), NOT the hip→handlebar direction:
- Circle 1: centred at hip, radius = torsoLength
- Circle 2: centred at handlebar (wrist), radius = armLength * 0.92
- preferDir = (0, 1) [upward in bike space] → picks the high solution

**Why:** Hip→handlebar vector points downward (handlebar is below hip on road bikes). Using it as the torso direction put the shoulder below the hip, which is anatomically wrong. The 2-circle intersection correctly places the shoulder above and forward of the hip.

## Knee / secondary joint
`findJoint(hip, pedal, thigh, shin, preferDir=(1,0))` — prefer forward direction.
Clamps gracefully when leg is over-extended (LeMond saddle height + crank > thigh+shin).

## Coordinate system
- Bike space: origin = rear axle, X forward, Y up (mm)
- SVG space: svgX = 50 + bikeX * 0.15, svgY = 234 - bikeY * 0.15
- SCALE = 0.15, WHEEL_RADIUS_MM = 340, CHAIN_STAY_MM = 420 (estimated)
- GROUND_SVG_Y = 285, rear axle SVG = {x:50, y:234}

## How to apply
Any future changes to stickman joint positions must use `findJoint` (not linear interpolation or simple direction vectors) to maintain anatomically plausible results across the full range of user-adjustable parameters.
