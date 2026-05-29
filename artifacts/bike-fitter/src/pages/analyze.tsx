import { useState, useRef, useEffect, useCallback } from "react";
import { useAppContext } from "@/lib/context";
import {
  extractAnglesFromLandmarks,
  validateSideView,
  drawSkeleton,
  drawAngleAnnotations,
  LANDMARK_INDICES,
} from "@/lib/analyze";
import { PoseAngles } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pose, POSE_CONNECTIONS, Results as PoseResults } from "@mediapipe/pose";
import {
  Camera,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

type CaptureMode = "camera" | "video";
type PedalPosition = "6oclock" | "3oclock";

interface CaptureState {
  angles: PoseAngles;
  label: string;
}

const POSITION_LABELS: Record<PedalPosition, string> = {
  "6oclock": "6 點鐘（踏板最低點）",
  "3oclock": "3 點鐘（踏板向前）",
};

const POSITION_HINTS: Record<PedalPosition, string> = {
  "6oclock": "踏板踩至最低點，膝蓋自然伸展",
  "3oclock": "踏板推至水平向前，用於 KOPS 膝蓋對齊分析",
};

export function Analyze() {
  const { measurements, setSixOClockAngles, setThreeOClockAngles, setActiveTab } =
    useAppContext();

  const [mode, setMode] = useState<CaptureMode>("camera");
  const [pedalPos, setPedalPos] = useState<PedalPosition>("6oclock");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("請側面面對鏡頭，完整入鏡後擷取姿態");
  const [error, setError] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Partial<Record<PedalPosition, CaptureState>>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose | null>(null);
  const animFrameRef = useRef<number | undefined>(undefined);
  const streamRef = useRef<MediaStream | null>(null);
  const latestLandmarksRef = useRef<any[] | null>(null);

  // --- MediaPipe setup ---
  const initPose = useCallback(() => {
    const pose = new Pose({
      locateFile: (file: string) =>
        "https://cdn.jsdelivr.net/npm/@mediapipe/pose/" + file,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results: PoseResults) => {
      if (!canvasRef.current || !videoRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        latestLandmarksRef.current = results.poseLandmarks;

        drawSkeleton(ctx, canvas, results.poseLandmarks, POSE_CONNECTIONS as [number, number][]);

        // Live angle annotations
        const validation = validateSideView(results.poseLandmarks);
        if (validation.isValid) {
          setValidationWarning(null);
          try {
            const angles = extractAnglesFromLandmarks(results.poseLandmarks, pedalPos);
            drawAngleAnnotations(ctx, canvas, results.poseLandmarks, angles);
          } catch {}
        } else {
          setValidationWarning(validation.message);
        }
      } else {
        latestLandmarksRef.current = null;
        setValidationWarning("未偵測到人體姿態，請調整位置");
      }
    });

    poseRef.current = pose;
    return pose;
  }, [pedalPos]);

  // --- Camera control ---
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    cancelAnimationFrame(animFrameRef.current!);
  }, []);

  const startDetectionLoop = useCallback(() => {
    const loop = async () => {
      if (videoRef.current && poseRef.current && videoRef.current.readyState >= 2) {
        await poseRef.current.send({ image: videoRef.current });
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setStatus("正在開啟後鏡頭...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startDetectionLoop();
      setStatus("請側面面對鏡頭，完整入鏡後擷取姿態");
    } catch {
      setError("無法存取相機，請確認已授予鏡頭權限");
    }
  }, [startDetectionLoop]);

  // Reinit pose when pedalPos changes (to update angle ranges for annotations)
  useEffect(() => {
    const pose = initPose();
    return () => {
      pose.close();
      cancelAnimationFrame(animFrameRef.current!);
    };
  }, [initPose]);

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      if (mode === "camera") stopCamera();
    };
  }, [mode, startCamera, stopCamera]);

  // --- Video upload ---
  const handleVideoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !videoRef.current) return;
      const url = URL.createObjectURL(file);
      videoRef.current.src = url;
      videoRef.current.loop = true;
      videoRef.current.play();
      startDetectionLoop();
      setStatus("影片播放中，偵測關節點中...");
      setError(null);
    },
    [startDetectionLoop]
  );

  // --- Capture ---
  const doCapture = useCallback(() => {
    if (!latestLandmarksRef.current) {
      setError("尚未偵測到姿態，請調整位置後重試");
      return;
    }

    const validation = validateSideView(latestLandmarksRef.current);
    if (!validation.isValid) {
      setError(validation.message);
      return;
    }

    try {
      const angles = extractAnglesFromLandmarks(latestLandmarksRef.current, pedalPos);

      setCaptures((prev) => ({
        ...prev,
        [pedalPos]: { angles, label: POSITION_LABELS[pedalPos] },
      }));

      if (pedalPos === "6oclock") {
        setSixOClockAngles(angles);
        setStatus("6 點鐘位置擷取成功！可繼續擷取 3 點鐘（選填）或直接查看結果");
        // Auto-switch to 3oclock for convenience
        setPedalPos("3oclock");
      } else {
        setThreeOClockAngles(angles);
        setStatus("3 點鐘位置擷取成功！");
      }
      setError(null);
      setValidationWarning(null);
    } catch (err: any) {
      setError(err.message || "角度計算失敗，請確保側面完整入鏡");
    }
  }, [pedalPos, setSixOClockAngles, setThreeOClockAngles]);

  const clearCapture = (pos: PedalPosition) => {
    setCaptures((prev) => {
      const next = { ...prev };
      delete next[pos];
      return next;
    });
    if (pos === "6oclock") setSixOClockAngles(null);
    else setThreeOClockAngles(null);
  };

  if (!measurements) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">請先於首頁填寫基本數據</p>
        <Button onClick={() => setActiveTab("home")} variant="outline" data-testid="button-go-home">
          回首頁
        </Button>
      </div>
    );
  }

  const can6 = !!captures["6oclock"];
  const can3 = !!captures["3oclock"];

  return (
    <div className="p-4 space-y-4 pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">姿勢分析</h1>
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>

      {/* Mode selector */}
      <div className="flex bg-muted rounded-lg p-1 gap-1">
        {(["camera", "video"] as CaptureMode[]).map((m) => (
          <button
            key={m}
            data-testid={`mode-${m}`}
            onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "camera" ? (
              <Camera className="w-4 h-4" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {m === "camera" ? "即時相機" : "影片上傳"}
          </button>
        ))}
      </div>

      {/* Pedal position selector */}
      <Card className="p-3 bg-card/50 border-border/60">
        <p className="text-xs text-muted-foreground mb-2 font-medium">踏板位置</p>
        <div className="flex gap-2">
          {(["6oclock", "3oclock"] as PedalPosition[]).map((pos) => {
            const captured = !!captures[pos];
            return (
              <button
                key={pos}
                data-testid={`position-${pos}`}
                onClick={() => setPedalPos(pos)}
                className={`flex-1 flex items-center justify-between px-3 py-2 rounded-md text-sm border transition-colors ${
                  pedalPos === pos
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                <span className="font-medium">
                  {pos === "6oclock" ? "6 點鐘" : "3 點鐘"}
                </span>
                {captured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : pos === "6oclock" ? (
                  <span className="text-[10px] text-destructive font-medium">必填</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">選填</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{POSITION_HINTS[pedalPos]}</p>
      </Card>

      {/* Errors / Warnings */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {validationWarning && !error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {validationWarning}
        </div>
      )}

      {/* Camera/Video viewport */}
      <div className="relative rounded-xl overflow-hidden bg-black border border-border/50 aspect-[3/4]">
        {mode === "video" && (
          <label
            htmlFor="video-upload"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/90 cursor-pointer hover:bg-card/70 transition-colors"
            id="video-upload-area"
          >
            <div className="p-4 rounded-full bg-primary/15 text-primary">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">點擊選擇側面騎乘影片</p>
            <input
              id="video-upload"
              data-testid="input-video-upload"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoUpload}
            />
          </label>
        )}

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          muted
          loop={mode === "video"}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
        />

        {/* Live position label */}
        <div className="absolute top-3 left-3 z-30 px-2 py-1 bg-black/60 rounded text-xs text-white font-medium backdrop-blur-sm">
          {POSITION_LABELS[pedalPos]}
        </div>
      </div>

      {/* Capture button */}
      <Button
        className="w-full h-14 text-base font-semibold shadow-lg shadow-primary/20"
        size="lg"
        onClick={doCapture}
        disabled={isLoading}
        data-testid="button-capture"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <>
            擷取{pedalPos === "6oclock" ? " 6 點鐘" : " 3 點鐘"}姿態
          </>
        )}
      </Button>

      {/* Capture summaries */}
      {(can6 || can3) && (
        <Card className="p-4 space-y-3 border-border/50 bg-card/40">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            已擷取
          </p>
          {(["6oclock", "3oclock"] as PedalPosition[]).map((pos) => {
            const cap = captures[pos];
            if (!cap) return null;
            const a = cap.angles;
            return (
              <div
                key={pos}
                className="flex items-center justify-between bg-background/60 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{cap.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      膝 {a.kneeAngle}° · 軀幹 {a.torsoAngle}° · 肘 {a.elbowAngle}°
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => clearCapture(pos)}
                  className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded"
                >
                  清除
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Proceed button */}
      {can6 && (
        <Button
          variant="outline"
          className="w-full h-12 font-semibold border-primary/50 text-primary hover:bg-primary/10"
          onClick={() => {
            stopCamera();
            setActiveTab("results");
          }}
          data-testid="button-go-results"
        >
          查看分析結果
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
