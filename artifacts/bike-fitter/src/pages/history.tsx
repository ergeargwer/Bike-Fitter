import { useState, useEffect } from "react";
import { FittingRecord } from "@/lib/types";
import { getHistory, deleteRecord } from "@/lib/storage";
import { useAppContext } from "@/lib/context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar, Bike, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

export function History() {
  const [records, setRecords] = useState<FittingRecord[]>([]);
  const { setMeasurements, setAngles, setActiveTab } = useAppContext();

  useEffect(() => {
    setRecords(getHistory());
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteRecord(id);
    setRecords(getHistory());
  };

  const handleLoad = (record: FittingRecord) => {
    setMeasurements(record.measurements);
    setAngles(record.angles);
    setActiveTab("results");
  };

  if (records.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">尚無紀錄</h2>
        <p className="text-muted-foreground text-sm max-w-[200px]">完成第一次 Fitting 分析後，紀錄將顯示於此。</p>
        <Button onClick={() => setActiveTab("home")} variant="outline" className="mt-4">
          開始分析
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24 animate-in fade-in duration-300">
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">歷史紀錄</h1>
        <p className="text-sm text-muted-foreground">共 {records.length} 筆 Fitting 紀錄</p>
      </div>

      <div className="space-y-3">
        {records.map((record) => (
          <Card 
            key={record.id} 
            className="overflow-hidden border-border/50 bg-card/40 hover:bg-card/80 transition-colors cursor-pointer active:scale-[0.98]"
            onClick={() => handleLoad(record)}
          >
            <CardContent className="p-0">
              <div className="p-4 flex items-center justify-between border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {format(new Date(record.date), "yyyy年MM月dd日", { locale: zhTW })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {record.measurements.bikeType === 'road' ? '公路車' : '三鐵車'}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                  onClick={(e) => handleDelete(e, record.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="bg-background/50 px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex gap-6">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">座高</p>
                    <p className="font-mono font-medium">{record.lemond.saddleHeight} <span className="text-xs font-sans text-muted-foreground">cm</span></p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">膝蓋角度</p>
                    <p className="font-mono font-medium">{record.angles.kneeAngle}°</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
