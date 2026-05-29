import { useAppContext } from "@/lib/context";
import { calculateLeMond } from "@/lib/lemond";
import { analyzeAngles } from "@/lib/analyze";
import { saveRecord } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, ChevronRight, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Results() {
  const { measurements, angles, setActiveTab } = useAppContext();
  const { toast } = useToast();

  if (!measurements || !angles) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">缺少分析數據</p>
        <Button onClick={() => setActiveTab("home")} variant="outline">重新開始</Button>
      </div>
    );
  }

  const lemond = calculateLeMond(measurements);
  const analyses = analyzeAngles(angles, measurements.bikeType);

  const handleSave = () => {
    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      measurements,
      angles,
      lemond,
      analyses
    });
    toast({
      title: "紀錄已儲存",
      description: "您可以在「紀錄」標籤中查看",
    });
    setActiveTab("history");
  };

  return (
    <div className="p-4 space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">分析結果</h1>
        <p className="text-sm text-muted-foreground">基於 LeMond 公式與關節角度偵測</p>
      </div>

      <Card className="border-primary/30 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-primary">LeMond 建議設定</CardTitle>
          <CardDescription>基礎座高與龍頭設定</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between border-b border-border/50 pb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">目標座高 (BB to Saddle)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-mono font-bold tracking-tighter text-foreground">{lemond.saddleHeight}</span>
                <span className="text-sm text-muted-foreground font-mono">cm</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">容許範圍</p>
              <span className="text-sm font-mono bg-background px-2 py-1 rounded border border-border">
                {lemond.saddleHeightMin} - {lemond.saddleHeightMax}
              </span>
            </div>
          </div>
          
          <div className="space-y-2 pt-2">
            {lemond.saddleSetback && (
              <div className="flex items-center text-sm"><ChevronRight className="w-4 h-4 text-primary mr-2" />{lemond.saddleSetback}</div>
            )}
            {lemond.handlebarDrop && (
              <div className="flex items-center text-sm"><ChevronRight className="w-4 h-4 text-primary mr-2" />{lemond.handlebarDrop}</div>
            )}
            {lemond.saddleForward && (
              <div className="flex items-center text-sm"><ChevronRight className="w-4 h-4 text-primary mr-2" />{lemond.saddleForward}</div>
            )}
            {lemond.aerobarsHeight && (
              <div className="flex items-center text-sm"><ChevronRight className="w-4 h-4 text-primary mr-2" />{lemond.aerobarsHeight}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-bold">姿勢角度診斷</h3>
        <div className="space-y-3">
          {analyses.map((a, i) => (
            <Card key={i} className={`border-l-4 ${a.status === '符合' ? 'border-l-emerald-500' : 'border-l-destructive'} bg-card/40`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      <Badge variant={a.status === '符合' ? 'default' : 'destructive'} className={a.status === '符合' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}>
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-2xl font-mono font-bold">{a.detected}°</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-1">
                    <p>建議範圍</p>
                    <p className="font-mono bg-background px-2 py-1 rounded">{a.recommendedMin}° - {a.recommendedMax}°</p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-background rounded-md text-sm flex items-start gap-2 border border-border/50">
                  {a.status === '符合' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <span className={a.status === '符合' ? 'text-muted-foreground' : 'text-foreground'}>{a.suggestion}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Button 
        className="w-full h-14 text-lg font-medium shadow-lg mt-8" 
        size="lg"
        onClick={handleSave}
      >
        <Save className="w-5 h-5 mr-2" />
        儲存本次紀錄
      </Button>
    </div>
  );
}
