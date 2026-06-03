import { useState } from "react";
import { useAppContext } from "@/lib/context";
import { calculateLeMond, analyzeGeometryFit } from "@/lib/lemond";
import { analyzeAngles, analyzeKOPS, calculateFitScore } from "@/lib/analyze";
import { saveRecord, saveVisualizerParams } from "@/lib/storage";
import { shareResults, exportResultsImage } from "@/lib/share";
import { getDefaultCrankLength } from "@/lib/visualizer";
import type { VisualizerParams } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  Layers,
  Loader2,
  Minus,
  Save,
  Share2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color =
    score >= 80 ? "#10b981" : score >= 55 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="hsl(220 13% 18%)"
          strokeWidth="10"
        />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform="rotate(-90 52 52)"
        />
        <text
          x="52"
          y="48"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="22"
          fontWeight="700"
          fill={color}
          fontFamily="Inter,system-ui"
        >
          {score}
        </text>
        <text
          x="52"
          y="66"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fill="#6b7280"
          fontFamily="Inter,system-ui"
        >
          / 100
        </text>
      </svg>
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {score >= 80 ? "優秀" : score >= 55 ? "尚可" : "需調整"}
      </p>
    </div>
  );
}

function StatusIcon({ status }: { status: "符合" | "偏高" | "偏低" }) {
  if (status === "符合")
    return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
  if (status === "偏高")
    return <TrendingUp className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
  return <TrendingDown className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
}

function statusClass(status: "符合" | "偏高" | "偏低"): string {
  return status === "符合"
    ? "text-emerald-500"
    : status === "偏高"
    ? "text-amber-500"
    : "text-red-400";
}

function borderClass(status: "符合" | "偏高" | "偏低"): string {
  return status === "符合"
    ? "border-l-emerald-500"
    : status === "偏高"
    ? "border-l-amber-500"
    : "border-l-red-400";
}

function priorityLabel(p: "high" | "medium" | "low") {
  return p === "high" ? "高優先" : p === "medium" ? "中優先" : "低優先";
}
function priorityDot(p: "high" | "medium" | "low") {
  return p === "high"
    ? "bg-red-400"
    : p === "medium"
    ? "bg-amber-400"
    : "bg-emerald-400";
}

export function Results() {
  const { measurements, sixOClockAngles, threeOClockAngles, selectedBikeProfile, setActiveTab } =
    useAppContext();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!measurements || !sixOClockAngles) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">請先完成姿勢分析</p>
        <Button
          onClick={() => setActiveTab("analyze")}
          variant="outline"
          data-testid="button-go-analyze"
        >
          前往分析
        </Button>
      </div>
    );
  }

  const lemond = calculateLeMond(measurements);
  const geometryFeedback = selectedBikeProfile
    ? analyzeGeometryFit(selectedBikeProfile, measurements.inseam)
    : null;
  const analyses6 = analyzeAngles(sixOClockAngles, measurements.bikeType);
  const analyses3 = threeOClockAngles
    ? analyzeAngles(threeOClockAngles, measurements.bikeType)
    : null;
  const kops = threeOClockAngles ? analyzeKOPS(threeOClockAngles) : null;
  const fitScore = calculateFitScore(analyses6);

  const handleGoToVisualizer = () => {
    const params: VisualizerParams = {
      bikeProfileId: selectedBikeProfile?.id ?? "",
      saddleHeight: Math.round(lemond.saddleHeight * 10),
      saddleOffset: 30,
      stemHeight: selectedBikeProfile
        ? selectedBikeProfile.geometry.stack + 20
        : Math.round(measurements.height * 6.5),
      stemLength: 100,
      crankLength: getDefaultCrankLength(measurements.height),
    };
    saveVisualizerParams(params);
    setActiveTab("visualizer");
  };

  const handleSave = () => {
    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      measurements,
      sixOClockAngles,
      threeOClockAngles: threeOClockAngles ?? undefined,
      lemond,
      analyses: analyses6,
      kops: kops ?? undefined,
      fitScore,
    });
    toast({ title: "紀錄已儲存", description: "可在「紀錄」頁查看" });
    setActiveTab("history");
  };

  const shareData = {
    measurements,
    lemond,
    analyses: analyses6,
    fitScore,
    kops,
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const result = await shareResults(shareData);
      if (result === "shared") {
        toast({ title: "已分享", description: "分析報告已成功分享" });
      } else if (result === "copied") {
        toast({ title: "已複製", description: "分析報告已複製至剪貼簿" });
      }
    } catch {
      toast({ title: "分享失敗", description: "請稍後再試", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportResultsImage(shareData);
      toast({ title: "匯出成功", description: "圖片已下載至裝置" });
    } catch {
      toast({ title: "匯出失敗", description: "請稍後再試", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 space-y-5 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header + Score */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">分析結果</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {measurements.bikeType === "road" ? "公路車" : "三鐵車"} ·{" "}
            {measurements.inseam} cm 跨高
          </p>
        </div>
        <ScoreRing score={fitScore} />
      </div>

      {/* LeMond saddle height */}
      <Card className="border-primary/30 bg-card/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base text-primary flex items-center gap-2">
            <ChevronRight className="w-4 h-4" />
            LeMond 建議座高
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                BB 到坐墊頂（中心到中心）
              </p>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-4xl font-mono font-bold tracking-tight"
                  data-testid="text-saddle-height"
                >
                  {lemond.saddleHeight}
                </span>
                <span className="text-sm text-muted-foreground">cm</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">容許範圍</p>
              <span className="font-mono text-sm bg-background px-2 py-1 rounded border border-border">
                {lemond.saddleHeightMin} – {lemond.saddleHeightMax}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-border/50">
            {[
              lemond.saddleSetback,
              lemond.handlebarDrop,
              lemond.saddleForward,
              lemond.aerobarsHeight,
            ]
              .filter(Boolean)
              .map((item, i) => (
                <div key={i} className="flex items-center text-sm gap-2">
                  <Minus className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Geometry feedback card */}
      {geometryFeedback && selectedBikeProfile && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-primary" />
              <span>{selectedBikeProfile.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {selectedBikeProfile.type === "road" ? "公路車" : "三鐵車"} · {selectedBikeProfile.sizeLabel}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-background border border-border/50 space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stack 評估</p>
                <p className={`text-sm font-bold ${
                  geometryFeedback.stackAssessment === "符合" ? "text-emerald-500"
                  : geometryFeedback.stackAssessment === "偏高" ? "text-amber-500"
                  : "text-red-400"
                }`}>
                  {geometryFeedback.stackAssessment}
                </p>
                <p className="text-[10px] text-muted-foreground">建議 {geometryFeedback.recommendedSaddleHeight.min}–{geometryFeedback.recommendedSaddleHeight.max} mm</p>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border/50 space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reach 評估</p>
                <p className={`text-sm font-bold ${
                  geometryFeedback.reachAssessment === "符合" ? "text-emerald-500"
                  : "text-amber-500"
                }`}>
                  {geometryFeedback.reachAssessment}
                </p>
                <p className="text-[10px] text-muted-foreground">Reach {selectedBikeProfile.geometry.reach} mm</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Minus className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <span>{geometryFeedback.headTubeNote}</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Minus className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <span>{geometryFeedback.seatAngleNote}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6-oclock analyses */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            6 點鐘位置分析
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {analyses6.map((a, i) => (
          <Card
            key={i}
            className={`border-l-4 ${borderClass(a.status)} bg-card/40`}
            data-testid={`card-analysis-${i}`}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{a.name}</span>
                    <span className="flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${priorityDot(a.priority)}`}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {priorityLabel(a.priority)}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-mono font-bold">
                      {a.detected}
                    </span>
                    <span className="text-sm text-muted-foreground">{a.unit}</span>
                    <span
                      className={`ml-2 text-sm font-bold ${statusClass(a.status)}`}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground mb-1">
                    建議範圍
                  </p>
                  <span className="font-mono text-xs bg-background px-2 py-1 rounded border border-border">
                    {a.recommendedMin}–{a.recommendedMax}°
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-background rounded-lg border border-border/50 text-sm">
                <StatusIcon status={a.status} />
                <span
                  className={
                    a.status === "符合"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }
                >
                  {a.suggestion}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3-oclock analyses */}
      {analyses3 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              3 點鐘位置分析
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* KOPS card */}
          {kops && (
            <Card
              className={`border-l-4 ${
                kops.isOptimal ? "border-l-emerald-500" : "border-l-amber-500"
              } bg-card/40`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">KOPS 膝蓋對齊</p>
                    <p className="text-xs text-muted-foreground">
                      膝蓋過踏板軸心（Knee Over Pedal Spindle）
                    </p>
                    <p
                      className={`text-sm font-bold mt-1 ${
                        kops.isOptimal ? "text-emerald-500" : "text-amber-500"
                      }`}
                    >
                      {kops.isOptimal ? "對齊良好" : "需要調整"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-background rounded-lg border border-border/50 text-sm">
                  {kops.isOptimal ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <span>{kops.suggestion}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3 o'clock knee angle only */}
          {analyses3.slice(0, 1).map((a, i) => (
            <Card
              key={i}
              className={`border-l-4 ${borderClass(a.status)} bg-card/40`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-mono font-bold">
                        {a.detected}
                      </span>
                      <span className="text-sm text-muted-foreground">{a.unit}</span>
                      <span className={`ml-2 text-sm font-bold ${statusClass(a.status)}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground mb-1">建議範圍</p>
                    <span className="font-mono text-xs bg-background px-2 py-1 rounded border border-border">
                      {a.recommendedMin}–{a.recommendedMax}°
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-background rounded-lg border border-border/50 text-sm">
                  <StatusIcon status={a.status} />
                  <span className={a.status === "符合" ? "text-muted-foreground" : "text-foreground"}>
                    {a.suggestion}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Prompt for 3 o'clock if not captured */}
      {!threeOClockAngles && (
        <Card className="border-dashed border-border/50 bg-card/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">加入 3 點鐘分析</p>
              <p className="text-xs text-muted-foreground">
                擷取踏板向前姿態可進行 KOPS 膝蓋對齊分析
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => setActiveTab("analyze")}
            >
              補擷取
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Share / Export row */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-12 text-sm font-medium"
          onClick={handleShare}
          disabled={sharing}
          data-testid="button-share"
        >
          {sharing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4 mr-2" />
          )}
          分享報告
        </Button>
        <Button
          variant="outline"
          className="h-12 text-sm font-medium"
          onClick={handleExport}
          disabled={exporting}
          data-testid="button-export"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          匯出圖片
        </Button>
      </div>

      {/* Go to visualizer */}
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium border-primary/40 text-primary hover:bg-primary/10"
        onClick={handleGoToVisualizer}
      >
        <Layers className="w-4 h-4 mr-2" />
        帶入視覺化模擬
      </Button>

      {/* Save */}
      <Button
        className="w-full h-14 text-base font-semibold shadow-lg shadow-primary/15"
        size="lg"
        onClick={handleSave}
        data-testid="button-save"
      >
        <Save className="w-5 h-5 mr-2" />
        儲存本次 Fitting 紀錄
      </Button>
    </div>
  );
}
