---
name: Visualizer measurement units
description: home.tsx stores body measurements in cm; visualizer.ts must multiply by 10 for mm geometry
---

# Visualizer Measurement Units

home.tsx labels say "(cm)" and placeholders are 175/82/60/65 — these are centimetre values.

The BikeVisualizer saddleHeight default uses `Math.round(inseam_cm * 8.83)` which is the LeMond formula (inseam in cm → saddle height in mm). This is correct and must NOT be changed to 0.883.

visualizer.ts must multiply all measurements by 10 before using them in mm geometry:
```ts
const thighMm = measurements.inseam * 10 * THIGH_RATIO;
const torsoMm = measurements.torsoLength * 10;
// etc.
```

**Why:** An earlier session wrongly removed *10 believing inputs were mm. The UI labels, placeholders, and LeMond formula all confirm cm storage.

**How to apply:** Any time body segment lengths look 10× too small in the visualizer, check whether *10 was accidentally removed from visualizer.ts lines ~215–223.
