---
name: PhotoFit canvas approach
description: How the photo calibration page renders image + overlay without flickering
---

The PhotoFit page uses two layered elements inside a `position:relative` container:
1. `<img>` shows the photo (userSelect:none, no pointer events needed)
2. `<canvas>` overlays it with `position:absolute top:0 left:0` — draws only the overlay (dots, stickman, badges), NOT the image

**Why:** Drawing the image onto canvas on every state change (drag) causes flicker. The img renders natively and stays stable; only the canvas redraws.

**How to apply:** Canvas width/height attribute = CSS width/height = dispSize (no DPI scaling for simplicity). `touchAction:'none'` on canvas stops browser scroll during drag. `setPointerCapture` on pointerdown ensures pointermove fires even if finger leaves the element.

Stickman scale: `pxPerMm = dist(rearAxle, frontAxle) / 977` (Mamba S wheelbase). All body measurements in cm → multiply ×10 for mm → multiply by pxPerMm for pixels.

LocalStorage save: resize photo to max 800px JPEG 0.75 before saving; store dispSize alongside pts so coordinates can be scaled on reload.
