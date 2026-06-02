# Bike Fitter

專業單車 Fitting 分析 PWA，使用 MediaPipe 姿勢偵測計算最佳騎乘位置，可安裝至 iPhone 主畫面離線使用。

A professional bike fitting analysis PWA that uses MediaPipe pose detection to calculate optimal riding position. Installable to iPhone home screen for offline use.

## Features

- Body measurements input: height, inseam, arm length, torso length, bike type
- LeMond formula saddle height calculation with recommended range output
- Pose analysis via MediaPipe: live rear-facing camera or video upload
- Joint angle detection: knee, hip, torso, and elbow angles
- Results page showing detected vs. recommended angles with fit status (符合 / 偏高 / 偏低)
- Fitting history stored locally with delete support

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4
- Pose detection: @mediapipe/pose (loaded from CDN at runtime)
- Storage: LocalStorage — no backend required
- PWA: manifest.json + service worker for offline support

## Running Locally

```bash
# Install dependencies
pnpm install

# Run the frontend
pnpm --filter @workspace/bike-fitter run dev

# Typecheck all packages
pnpm run typecheck

# Build all packages
pnpm run build
```

## Project Structure

```
artifacts/bike-fitter/          # Main PWA frontend
  src/pages/                    # Home, Analyze, Results, History pages
  src/lib/                      # types, context, lemond formula, analysis, storage
  src/components/layout.tsx     # Bottom tab bar
  public/manifest.json          # PWA manifest
  public/sw.js                  # Service worker for offline support
  index.html                    # PWA meta tags + SW registration
```

## Architecture

- Pure frontend PWA — all data in LocalStorage, no backend needed
- Tab navigation via React state (not URL routing) for reliable PWA standalone mode on iOS
- MediaPipe loaded from CDN to avoid bundling 50 MB+ of WASM; cached by service worker after first load
- Dark theme only
