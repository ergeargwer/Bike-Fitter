import { useState, useMemo } from "react";
import { useAppContext } from "@/lib/context";
import { loadVisualizerParams, saveVisualizerParams } from "@/lib/storage";
import { calculateLeMond } from "@/lib/lemond";
import {
  calculateVisualizerData,
  getDefaultCrankLength,
  DEFAULT_GEOMETRY,
  WHEEL_RADIUS_SVG,
  GROUND_SVG_Y,
  type BikePositionsSVG,
  type RiderPositionsSVG,
} from "@/lib/visualizer";
import type { VisualizerParams } from "@/lib/types";
import { Button } from "@/components/ui/button";

const FRAME_COLOR = "#4A9EFF";
const WHEEL_COLOR = "#888888";
const RIDER_COLOR = "#E8E8E8";
const RIDER_DIM = "#555555";
const JOINT_COLOR = "#FFFFFF";
const HEAD_R = 11;
const JOINT_R = 3;

function p(pt: { x: number; y: number }) {
  return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
}

function Dot({ pt, r = JOINT_R, fill = JOINT_COLOR }: { pt: { x: number; y: number }; r?: number; fill?: string }) {
  return <circle cx={pt.x} cy={pt.y} r={r} fill={fill} />;
}

function BikeFrameSVG({ bike }: { bike: BikePositionsSVG }) {
  const {
    rearAxle, frontAxle, bb, seatTubeTop,
    headTubeTop, headTubeBottom, stemStart,
    saddle, handlebar,
  } = bike;

  return (
    <g>
      {/* Wheels */}
      <circle cx={rearAxle.x} cy={rearAxle.y} r={WHEEL_RADIUS_SVG} fill="none" stroke={WHEEL_COLOR} strokeWidth="2" />
      <circle cx={frontAxle.x} cy={frontAxle.y} r={WHEEL_RADIUS_SVG} fill="none" stroke={WHEEL_COLOR} strokeWidth="2" />
      <Dot pt={rearAxle} r={3.5} fill={WHEEL_COLOR} />
      <Dot pt={frontAxle} r={3.5} fill={WHEEL_COLOR} />

      {/* Chain stay */}
      <line x1={rearAxle.x} y1={rearAxle.y} x2={bb.x} y2={bb.y} stroke={FRAME_COLOR} strokeWidth="2.5" strokeLinecap="round" />
      {/* Seat stay */}
      <line x1={rearAxle.x} y1={rearAxle.y} x2={seatTubeTop.x} y2={seatTubeTop.y} stroke={FRAME_COLOR} strokeWidth="2" strokeLinecap="round" />
      {/* Seat tube */}
      <line x1={bb.x} y1={bb.y} x2={seatTubeTop.x} y2={seatTubeTop.y} stroke={FRAME_COLOR} strokeWidth="2.5" strokeLinecap="round" />
      {/* Top tube */}
      <line x1={seatTubeTop.x} y1={seatTubeTop.y} x2={headTubeTop.x} y2={headTubeTop.y} stroke={FRAME_COLOR} strokeWidth="2" strokeLinecap="round" />
      {/* Down tube */}
      <line x1={bb.x} y1={bb.y} x2={headTubeBottom.x} y2={headTubeBottom.y} stroke={FRAME_COLOR} strokeWidth="2.5" strokeLinecap="round" />
      {/* Head tube */}
      <line x1={headTubeTop.x} y1={headTubeTop.y} x2={headTubeBottom.x} y2={headTubeBottom.y} stroke={FRAME_COLOR} strokeWidth="3.5" strokeLinecap="round" />
      {/* Fork */}
      <line x1={headTubeBottom.x} y1={headTubeBottom.y} x2={frontAxle.x} y2={frontAxle.y} stroke={FRAME_COLOR} strokeWidth="2" strokeLinecap="round" />

      {/* BB */}
      <Dot pt={bb} r={4} fill={FRAME_COLOR} />

      {/* Saddle: horizontal line with seatpost stub */}
      <line x1={saddle.x - 18} y1={saddle.y} x2={saddle.x + 18} y2={saddle.y} stroke={FRAME_COLOR} strokeWidth="3" strokeLinecap="round" />
      <line x1={saddle.x} y1={saddle.y} x2={seatTubeTop.x} y2={seatTubeTop.y} stroke={FRAME_COLOR} strokeWidth="1.5" strokeDasharray="3 2" />

      {/* Steerer extension above head tube to stem */}
      <line x1={headTubeTop.x} y1={headTubeTop.y} x2={stemStart.x} y2={stemStart.y} stroke={FRAME_COLOR} strokeWidth="2" strokeLinecap="round" />
      {/* Stem (horizontal) */}
      <line x1={stemStart.x} y1={stemStart.y} x2={handlebar.x} y2={handlebar.y} stroke={FRAME_COLOR} strokeWidth="2" strokeLinecap="round" />
      {/* Handlebar (vertical line) */}
      <line x1={handlebar.x} y1={handlebar.y - 9} x2={handlebar.x} y2={handlebar.y + 9} stroke={FRAME_COLOR} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function StickmanSVG({ rider }: { rider: RiderPositionsSVG }) {
  const {
    pedal6, knee6, hip, shoulder, elbow, wrist, headCenter,
    pedal12, knee12,
  } = rider;

  return (
    <g>
      {/* Secondary leg (12 o'clock, dim) */}
      <polyline points={`${p(hip)} ${p(knee12)} ${p(pedal12)}`} fill="none" stroke={RIDER_DIM} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Dot pt={knee12} fill={RIDER_DIM} />
      <Dot pt={pedal12} fill={RIDER_DIM} />

      {/* Primary leg (6 o'clock) */}
      <polyline points={`${p(hip)} ${p(knee6)} ${p(pedal6)}`} fill="none" stroke={RIDER_COLOR} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Torso */}
      <line x1={hip.x} y1={hip.y} x2={shoulder.x} y2={shoulder.y} stroke={RIDER_COLOR} strokeWidth="3.5" strokeLinecap="round" />

      {/* Arm */}
      <polyline points={`${p(shoulder)} ${p(elbow)} ${p(wrist)}`} fill="none" stroke={RIDER_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Head */}
      <circle cx={headCenter.x} cy={headCenter.y} r={HEAD_R} fill="none" stroke={RIDER_COLOR} strokeWidth="2.5" />

      {/* Joints */}
      <Dot pt={hip} />
      <Dot pt={knee6} />
      <Dot pt={pedal6} />
      <Dot pt={shoulder} />
      <Dot pt={elbow} />
      <Dot pt={wrist} />
    </g>
  );
}

function AnnotationsSVG({ kneeAngle6, torsoAngle, knee6SVG, shoulderSVG }: {
  kneeAngle6: number;
  torsoAngle: number;
  knee6SVG: { x: number; y: number };
  shoulderSVG: { x: number; y: number };
}) {
  const ax = 310;
  return (
    <g fill="#888888" fontSize="9" fontFamily="monospace">
      <text x={ax} y={Math.max(40, Math.min(shoulderSVG.y, 120))}>
        軀幹 {torsoAngle}°
      </text>
      <text x={ax} y={Math.max(80, Math.min(knee6SVG.y + 10, 230))}>
        膝蓋 {kneeAngle6}°
      </text>
    </g>
  );
}

function buildDefaultParams(
  measurements: { height: number; inseam: number } | null,
  stack: number
): VisualizerParams {
  const inseam = measurements?.inseam ?? 82;
  const height = measurements?.height ?? 175;
  return {
    bikeProfileId: "",
    saddleHeight: Math.round(inseam * 8.83),
    saddleOffset: 30,
    stemHeight: stack + 20,
    stemLength: 100,
    crankLength: getDefaultCrankLength(height),
  };
}

interface ParamRowProps {
  label: string;
  value: number;
  hint: string;
  step?: number;
  onChange: (v: number) => void;
}

function ParamRow({ label, value, hint, step = 1, onChange }: ParamRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(v);
            }}
            className="w-24 h-8 rounded-md bg-card border border-border px-2 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground w-6">mm</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function BikeVisualizer() {
  const { measurements, bikeProfiles } = useAppContext();

  const defaultStack = 560;

  const [draftParams, setDraftParams] = useState<VisualizerParams>(() => {
    const saved = loadVisualizerParams();
    if (saved) return saved;
    const profile = bikeProfiles[0] ?? null;
    return buildDefaultParams(
      measurements,
      profile?.geometry.stack ?? defaultStack
    );
  });

  const [liveParams, setLiveParams] = useState<VisualizerParams>(draftParams);

  const profile =
    bikeProfiles.find((p) => p.id === liveParams.bikeProfileId) ??
    bikeProfiles[0] ??
    null;
  const geometry = profile?.geometry ?? DEFAULT_GEOMETRY;

  const vizData = useMemo(() => {
    if (!measurements) return null;
    return calculateVisualizerData(geometry, liveParams, measurements);
  }, [geometry, liveParams, measurements]);

  const lemond = measurements ? calculateLeMond(measurements) : null;

  const lemondHint = lemond
    ? `LeMond 建議 ${Math.round(lemond.saddleHeightMin * 10)}–${Math.round(lemond.saddleHeightMax * 10)} mm`
    : "LeMond 建議值";

  const stemHint = profile
    ? `Stack ${profile.geometry.stack} mm + 墊片（建議 ${profile.geometry.stack + 10}–${profile.geometry.stack + 40} mm）`
    : "建議 Stack + 10–40 mm 墊片";

  function set(key: keyof VisualizerParams, val: number) {
    setDraftParams((p) => ({ ...p, [key]: val }));
  }

  function handleUpdate() {
    setLiveParams(draftParams);
    saveVisualizerParams(draftParams);
  }

  if (!measurements) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          請先在「首頁」輸入身體數據，模擬功能才能計算關節位置。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-1">
        <h1 className="text-xl font-bold tracking-tight">騎乘姿勢模擬</h1>
        {profile ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            {profile.name} · {profile.type === "road" ? "公路車" : "三鐵車"} · {profile.sizeLabel}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">使用預設幾何（未選擇車型）</p>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="w-full bg-card/20 border-y border-border/30">
        <svg
          viewBox="0 0 400 300"
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block" }}
        >
          {/* Ground */}
          <line
            x1="0" y1={GROUND_SVG_Y}
            x2="400" y2={GROUND_SVG_Y}
            stroke="#333" strokeWidth="1.5"
          />

          {vizData ? (
            <>
              <BikeFrameSVG bike={vizData.bike} />
              <StickmanSVG rider={vizData.rider} />
              <AnnotationsSVG
                kneeAngle6={vizData.kneeAngle6}
                torsoAngle={vizData.torsoAngle}
                knee6SVG={vizData.rider.knee6}
                shoulderSVG={vizData.rider.shoulder}
              />
            </>
          ) : (
            <text x="200" y="150" textAnchor="middle" fill="#666" fontSize="12">
              請輸入身體數據以顯示模擬
            </text>
          )}
        </svg>
      </div>

      {/* Angle badges */}
      {vizData && (
        <div className="flex gap-3 px-4 py-2">
          <div className="flex items-center gap-1.5 text-xs bg-card border border-border/50 rounded-md px-2.5 py-1">
            <span className="text-muted-foreground">膝蓋</span>
            <span className="font-mono font-bold">{vizData.kneeAngle6}°</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs bg-card border border-border/50 rounded-md px-2.5 py-1">
            <span className="text-muted-foreground">軀幹</span>
            <span className="font-mono font-bold">{vizData.torsoAngle}°</span>
          </div>
        </div>
      )}

      {/* Params */}
      <div className="px-4 pb-4 space-y-4">
        <div className="h-px bg-border/40" />

        <ParamRow
          label="座高"
          value={draftParams.saddleHeight}
          hint={lemondHint}
          step={5}
          onChange={(v) => set("saddleHeight", v)}
        />
        <ParamRow
          label="座墊前後"
          value={draftParams.saddleOffset}
          hint="正值 = 後移。KOPS 建議 0–40 mm 後移"
          step={5}
          onChange={(v) => set("saddleOffset", v)}
        />
        <ParamRow
          label="龍頭高度"
          value={draftParams.stemHeight}
          hint={stemHint}
          step={5}
          onChange={(v) => set("stemHeight", v)}
        />
        <ParamRow
          label="龍頭長度"
          value={draftParams.stemLength}
          hint="建議 80–130 mm"
          step={5}
          onChange={(v) => set("stemLength", v)}
        />
        <ParamRow
          label="曲柄長度"
          value={draftParams.crankLength}
          hint={`依身高建議 ${getDefaultCrankLength(measurements.height)} mm`}
          step={2.5}
          onChange={(v) => set("crankLength", v)}
        />

        <Button
          className="w-full h-12 text-sm font-semibold mt-2"
          onClick={handleUpdate}
        >
          更新畫面
        </Button>
      </div>
    </div>
  );
}
