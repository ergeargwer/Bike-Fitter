import { useState, useEffect } from "react";
import { FittingRecord } from "@/lib/types";
import { getHistory, deleteRecord } from "@/lib/storage";
import { useAppContext } from "@/lib/context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar, Bike, ChevronRight, ChevronDown, Award } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

export function History() {
  const [records, setRecords] = useState<FittingRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { setMeasurements, setSixOClockAngles, setThreeOClockAngles, setActiveTab } =
    useAppContext();

  useEffect(() => {
    setRecords(getHistory());
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteRecord(id);
    setRecords(getHistory());
    if (expandedId === id) setExpandedId(null);
  };

  const handleLoad = (record: FittingRecord) => {
    setMeasurements(record.measurements);
    setSixOClockAngles(record.sixOClockAngles);
    setThreeOClockAngles(record.threeOClockAngles ?? null);
    setActiveTab("results");
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  function scoreColor(score: number) {
    if (score >= 80) return "text-emerald-500";
    if (score >= 55) return "text-amber-500";
    return "text-red-400";
  }

  if (records.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">尚無紀錄</h2>
        <p className="text-muted-foreground text-sm max-w-[220px]">
          完成第一次 Fitting 分析後，紀錄將顯示於此
        </p>
        <Button
          onClick={() => setActiveTab("home")}
          variant="outline"
          className="mt-2"
          data-testid="button-start-from-history"
        >
          開始分析
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-28 animate-in fade-in duration-300">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">歷史紀錄</h1>
        <p className="text-sm text-muted-foreground">共 {records.length} 筆紀錄</p>
      </div>

      <div className="space-y-3">
        {records.map((record) => {
          const isExpanded = expandedId === record.id;
          const score = record.fitScore ?? 0;
          const a6 = record.sixOClockAngles;

          return (
            <Card
              key={record.id}
              className="overflow-hidden border-border/50 bg-card/40"
              data-testid={`card-record-${record.id}`}
            >
              <CardContent className="p-0">
                {/* Main row */}
                <button
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-card/80 transition-colors active:scale-[0.99]"
                  onClick={() => toggleExpand(record.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {format(new Date(record.date), "yyyy年M月d日 HH:mm", {
                          locale: zhTW,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.measurements.bikeType === "road"
                          ? "公路車"
                          : "三鐵車"}{" "}
                        · 跨高 {record.measurements.inseam} cm
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {score > 0 && (
                      <div className="flex items-center gap-1">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <span className={`text-sm font-bold ${scoreColor(score)}`}>
                          {score}
                        </span>
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Summary bar */}
                <div className="bg-background/50 px-4 py-2.5 flex items-center justify-between text-sm border-t border-border/40">
                  <div className="flex gap-5">
                    <div>
                      <p className="text-muted-foreground text-[10px] mb-0.5">座高</p>
                      <p className="font-mono font-medium text-sm">
                        {record.lemond.saddleHeight}{" "}
                        <span className="text-[10px] font-sans text-muted-foreground">
                          cm
                        </span>
                      </p>
                    </div>
                    {a6 && (
                      <>
                        <div>
                          <p className="text-muted-foreground text-[10px] mb-0.5">
                            膝蓋彎曲
                          </p>
                          <p className="font-mono font-medium text-sm">{a6.kneeAngle}°</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] mb-0.5">
                            軀幹傾角
                          </p>
                          <p className="font-mono font-medium text-sm">{a6.torsoAngle}°</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-primary hover:bg-primary/10 h-8"
                      onClick={() => handleLoad(record)}
                    >
                      載入
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={(e) => handleDelete(e, record.id)}
                      data-testid={`button-delete-${record.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border/40 bg-background/30">
                    {record.analyses.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{a.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">
                            {a.detected}°
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              a.status === "符合"
                                ? "text-emerald-500"
                                : a.status === "偏高"
                                ? "text-amber-500"
                                : "text-red-400"
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {record.kops && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">KOPS 對齊</span>
                        <span
                          className={`text-xs font-semibold ${
                            record.kops.isOptimal
                              ? "text-emerald-500"
                              : "text-amber-500"
                          }`}
                        >
                          {record.kops.isOptimal ? "良好" : "需調整"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
