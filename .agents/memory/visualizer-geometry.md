---
name: BikeVisualizer geometry
description: How frame key-points are computed in visualizer.ts; shoulder placement; findJoint clamping; SVG coordinate system.
---

## Frame key-point math (bike-space: X=forward, Y=up, origin=rear axle)

All geometry derived from real Mamba FCM-2159 data (`bikeOutline.ts`).

- **BB**: `bbX = sqrt(rearCenter² - bbDrop²)`, `bb = {x: bbX, y: -bbDrop}`
- **headTubeTop**: `{x: bb.x + reach, y: bb.y + stack}` (stack/reach measured from BB center)
- **headTubeBottom**: `headTubeTop + headTube * (cos(headAngle), -sin(headAngle))` — moves forward (+x) and down (-y) in bike-space
- **frontAxle**: `{x: wheelbase, y: 0}` — wheelbase is horizontal axle-to-axle distance
- **seatTubeTop**: `bb + seatTube * (-cos(seatAngle), +sin(seatAngle))` — backward and upward
- Fork: straight line from headTubeBottom to frontAxle (~377mm for S size, visually correct)

**Why:** Real bike geometry requires headAngle, rearCenter, wheelbase to place the frame accurately. Stack/reach/seatAngle alone get close but misplace the front axle.

## Shoulder placement

`shoulder = findJoint(hip, handlebar, torsoMm, armReach, v(0,1))`

Two-circle intersection: torso-length circle from hip, arm-reach circle from handlebar. Prefer upward (`v(0,1)`) to get forward-leaning posture. Anatomically correct for road/tri bikes.

**Why:** Hip→handlebar direction points downward on road bikes — using it as torso direction put shoulder below hip. 2-circle intersection correctly places shoulder above and forward of hip.

## Knee / other joints

`findJoint(hip, ankle, thigh, shin, v(1,0))` — prefer forward direction. Clamps gracefully when leg is over-extended at LeMond saddle height. Same approach for elbow.

## SVG coordinate system (updated — all mm)

- ViewBox in **real mm** — all positions are millimetres in the viewBox
- `toSVG(pt) = { x: originX + pt.x, y: originY - pt.y }` (Y flipped, computed inside `calculateVisualizerData`)
- `originX = WHEEL_RADIUS_MM + H_PAD = 486`; `originY = ABOVE_AXL = 1400`
- Strokes use `vectorEffect="non-scaling-stroke"` so strokeWidth is always screen px
- Ground line at `ABOVE_AXL + WHEEL_RADIUS_MM = 1736` (bottom of wheel, returned as `vizData.groundY`)
- ViewBox for S size: 1949 × 1886 mm, aspect ratio ~1:1

## BikeProfile.geometry optional fields

`headAngle`, `rearCenter`, `wheelbase` are optional on `BikeProfile.geometry`. When absent, visualizer defaults to Mamba S values (71.5°, 408mm, 977mm). Existing profiles with only the original 7 fields still work.

## How to apply

Any future changes to joint positions must use `findJoint` (not linear interpolation or direction vectors) to maintain plausible results across the full range of user-adjustable parameters.
