# Bike Fitter

專業單車 Fitting 分析 PWA，使用 MediaPipe 姿勢偵測計算最佳騎乘位置，可安裝至 iPhone 主畫面離線使用。

## Run & Operate

- `pnpm --filter @workspace/bike-fitter run dev` — run the frontend (port varies)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4
- Pose detection: @mediapipe/pose (loaded from CDN at runtime)
- Storage: LocalStorage only — no backend needed
- PWA: manifest.json + service worker (public/sw.js)

## Where things live

- `artifacts/bike-fitter/` — main PWA frontend
- `artifacts/bike-fitter/src/pages/` — Home, Analyze, Results, History pages
- `artifacts/bike-fitter/src/lib/` — types.ts, context.tsx, lemond.ts, analyze.ts, storage.ts
- `artifacts/bike-fitter/src/components/layout.tsx` — bottom tab bar
- `artifacts/bike-fitter/public/manifest.json` — PWA manifest
- `artifacts/bike-fitter/public/sw.js` — service worker for offline support
- `artifacts/bike-fitter/index.html` — PWA meta tags + SW registration

## Architecture decisions

- Pure frontend PWA — no backend required; all data in LocalStorage
- Tab navigation via React state (not URL routing) for reliable PWA standalone mode on iOS
- MediaPipe loaded from CDN (cdn.jsdelivr.net) to avoid bundling 50MB+ of WASM
- Service worker caches MediaPipe CDN assets for offline use after first load
- Dark theme only — no light mode needed for this tool
- SVG-generated icons converted to PNG via ImageMagick for PWA icon compatibility

## Product

- Body measurements input (height, inseam, arm length, torso length, bike type)
- LeMond formula saddle height calculation with range output
- Pose analysis via MediaPipe: live camera (rear-facing) or video upload
- Joint angle detection: knee, hip, torso, elbow angles
- Results page: detected vs recommended angles with 符合/偏高/偏低 status
- History: LocalStorage-persisted fitting records with delete support

## User preferences

- Language: Traditional Chinese UI
- No emoji anywhere in the UI
- Minimum 16px font size
- Dark theme only

## Gotchas

- MediaPipe requires WASM loading from CDN — first load may be slow; cached after that
- iOS Safari requires `viewport-fit=cover` + `env(safe-area-inset-bottom)` for bottom tab bar
- Service worker path must match BASE_PATH exactly in manifest start_url
