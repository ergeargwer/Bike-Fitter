---
name: Visualizer coordinate system
description: SVG y-down coordinate system used in visualizer.ts — signs, scale, and viewBox layout
---

# Visualizer geometry conventions

## Coordinate system
- All coordinates in **mm**, no pre-scaling (1mm = 1 SVG unit)
- SVG native y-down: positive y = downward
- Rear axle = bike-space origin (0, 0)
- `toSVG(p)` adds `(LEFT_MM=380, ABOVE_AXLE_MM=900)` to place rear axle at SVG (380, 900)

## Key anchor signs (y-down)
- `bb.y = +bbDrop` (BB is BELOW axle → positive y) ← Previous bug was -bbDrop
- `seatCluster.y < 0` in bike-space (seat tube goes UP from BB → negative y)
- `headTubeTop = (bb.x + reach, bb.y - stack)` (stack goes UP → subtract)
- `headTubeBottom = headTubeTop + headTube × (cos headAngle, sin headAngle)` (HT goes down-forward)
- `frontAxle = (wheelbase, 0)` directly from geometry — no fork-length derivation needed
- pedal6 = `(bb.x, bb.y + crankLength)` (6-o'clock = below BB → +crankLength)
- pedal12 = `(bb.x, bb.y - crankLength)` (12-o'clock = above BB → -crankLength)

## Foot model (y-down signs)
- `ankle6.y = pedal6.y - footLever × sin(15°)` (heel UP = smaller y ✓)
- `footTip6.y = pedal6.y + footFwd × sin(15°)` (toe DOWN = larger y ✓)

## findJoint prefer directions (y-down)
- Knee: `v(1, 0)` prefer forward ✓ (same in both conventions)
- Shoulder: `v(0, -1)` prefer UP (smaller y = higher in y-down)
- Elbow: `v(0, +1)` prefer DOWN (drooping arm)

## Torso angle reference direction
- `angleDeg(sub(shoulder, hip), v(0, -1))` — v(0,-1) = "upward" in y-down

## viewBox & groundY
- `LEFT_MM=436, RIGHT_MM=536, ABOVE_AXLE_MM=1400, BELOW_GROUND_MM=150`
- `viewBox.width = wheelbase + 436 + 536` (for Mamba S: 1949)
- `viewBox.height = 1400 + 336 + 150 = 1886`
- `groundY = 1400 + 336 = 1736`
- These exactly match BikeVisualizer.tsx `defaultVb` and `defaultGroundY` fallback values.
- BikeVisualizer.tsx consumes `vizData.viewBox` and `vizData.groundY`

**Critical:** ABOVE_AXLE_MM=900 caused the shoulder (≈1100mm above axle for 175cm rider) to land at SVG y=-62, outside the viewBox — entire stickman disappeared. Use 1400 minimum.

**Why:** The old code used y-up bike-space converted via toSVG flip. New code uses y-down natively so there is no sign flip. Old y-up approach caused confusion about which sign to use for BB drop.
