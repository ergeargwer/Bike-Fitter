import { useState, useRef, useEffect, useCallback } from "react";
import { useAppContext } from "@/lib/context";
import { calcAngle } from "@/lib/analyze";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Pose, POSE_CONNECTIONS, Results as PoseResults } from "@mediapipe/pose";
import { Camera, Upload, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Analyze() {
  const { measurements, setAngles, setActiveTab } = useAppContext();
  const [mode, setMode] = useState<"video" | "camera">("camera");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("請面對鏡頭側拍騎姿");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose | null>(null);
  const animationRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera when unmounting or switching mode
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  useEffect(() => {
    const pose = new Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    
    pose.onResults(onPoseResults);
    poseRef.current = pose;

    return () => {
      stopCamera();
      pose.close();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  }, [mode, stopCamera]);

  const startCamera = async () => {
    try {
      setError(null);
      setProgress("正在開啟相機...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        startDetectionLoop();
      }
      setProgress("請面對鏡頭側拍騎姿");
    } catch (err) {
      setError("無法存取相機，請確認權限設定");
    }
  };

  const startDetectionLoop = () => {
    const detect = async () => {
      if (videoRef.current && poseRef.current && videoRef.current.readyState >= 2) {
        await poseRef.current.send({ image: videoRef.current });
      }
      animationRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.play();
      startDetectionLoop();
      setProgress("播放影片中進行分析...");
    }
  };

  const onPoseResults = (results: PoseResults) => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas size to video
    if (canvas.width !== videoRef.current.videoWidth) {
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw landmarks if found
    if (results.poseLandmarks) {
      const lms = results.poseLandmarks;
      
      // Draw connections
      ctx.strokeStyle = "#2b7fff"; // Primary color
      ctx.lineWidth = 4;
      POSE_CONNECTIONS.forEach(([i, j]) => {
        const pt1 = lms[i];
        const pt2 = lms[j];
        if (pt1.visibility && pt1.visibility > 0.5 && pt2.visibility && pt2.visibility > 0.5) {
          ctx.beginPath();
          ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
          ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw points
      ctx.fillStyle = "#ffffff";
      lms.forEach((pt) => {
        if (pt.visibility && pt.visibility > 0.5) {
          ctx.beginPath();
          ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 6, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }
    ctx.restore();
  };

  const captureAngles = () => {
    // Need a single frame to extract
    if (!videoRef.current || !poseRef.current) return;
    setIsAnalyzing(true);
    setProgress("計算角度中...");
    
    // Simple extraction from current pose (assuming we have it stored or just send a sync frame)
    poseRef.current.send({ image: videoRef.current }).then(() => {
      setIsAnalyzing(false);
      // We need to wait for onResults to actually fire...
      // Hack: we will extract from the last known good frame in onResults, but we don't have access here easily without state.
      // Better: let's just do it directly.
    });
    
    // Actually, onPoseResults is async, so let's just set a flag to grab it next frame.
    // To keep it simple and robust, let's just mock the extraction for a moment if we don't have it,
    // wait, we can just grab from the pose landmarks if we save them.
  };

  // We need to store latest landmarks to capture
  const latestLandmarksRef = useRef<any>(null);
  
  useEffect(() => {
    if (poseRef.current) {
      const originalOnResults = poseRef.current.onResults;
      poseRef.current.onResults = (results: PoseResults) => {
        latestLandmarksRef.current = results.poseLandmarks;
        onPoseResults(results); // Call the drawing one
      };
    }
  }, []);

  const doCapture = () => {
    if (!latestLandmarksRef.current) {
      setError("未偵測到完整身體節點，請調整位置");
      return;
    }
    
    const lms = latestLandmarksRef.current;
    // Indices: LEFT_SHOULDER=11, LEFT_ELBOW=13, LEFT_WRIST=15, LEFT_HIP=23, LEFT_KNEE=25, LEFT_ANKLE=27
    
    // Helper to get point in pixel coords for angle calc
    const getPt = (idx: number) => ({ x: lms[idx].x, y: lms[idx].y });
    
    try {
      const shoulder = getPt(11);
      const elbow = getPt(13);
      const wrist = getPt(15);
      const hip = getPt(23);
      const knee = getPt(25);
      const ankle = getPt(27);
      
      const kneeAngle = calcAngle(hip, knee, ankle);
      const hipAngle = calcAngle(shoulder, hip, knee);
      const elbowAngle = calcAngle(shoulder, elbow, wrist);
      
      // Torso vs horizontal: calc angle between shoulder-hip line and horizontal
      const dx = shoulder.x - hip.x;
      const dy = shoulder.y - hip.y; // note y increases downwards
      let torsoAngle = Math.round(Math.abs(Math.atan2(dy, dx) * 180 / Math.PI));
      if (torsoAngle > 90) torsoAngle = 180 - torsoAngle;
      
      setAngles({
        kneeAngle,
        hipAngle,
        torsoAngle,
        elbowAngle
      });
      
      stopCamera();
      setActiveTab("results");
    } catch (e) {
      setError("無法計算角度，請確保側面入鏡");
    }
  };

  if (!measurements) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">請先於首頁填寫基本數據</p>
        <Button onClick={() => setActiveTab("home")} variant="outline">回首頁</Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">姿勢分析</h1>
        <p className="text-sm text-muted-foreground">{progress}</p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-background border border-border">
          <TabsTrigger value="camera" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Camera className="w-4 h-4 mr-2" />
            即時相機
          </TabsTrigger>
          <TabsTrigger value="video" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Upload className="w-4 h-4 mr-2" />
            影片上傳
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>錯誤</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="relative overflow-hidden bg-black aspect-[3/4] border-primary/30 flex items-center justify-center">
        {mode === "video" && !videoRef.current?.src && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 space-y-4 bg-card/80">
            <div className="p-4 rounded-full bg-primary/20 text-primary">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">請選擇側面騎乘影片</p>
            <Label htmlFor="video-upload" className="cursor-pointer">
              <div className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 font-medium">
                選擇檔案
              </div>
              <Input 
                id="video-upload" 
                type="file" 
                accept="video/*" 
                className="hidden" 
                onChange={handleVideoUpload}
              />
            </Label>
          </div>
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
      </Card>

      <Button 
        className="w-full h-14 text-lg font-medium shadow-lg shadow-primary/20" 
        size="lg"
        onClick={doCapture}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : "擷取當前角度"}
      </Button>
    </div>
  );
}
