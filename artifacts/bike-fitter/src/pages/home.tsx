import { useState } from "react";
import { useAppContext } from "@/lib/context";
import { calculateLeMond } from "@/lib/lemond";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity } from "lucide-react";

export function Home() {
  const { measurements, setMeasurements, setActiveTab } = useAppContext();
  
  const [formData, setFormData] = useState({
    height: measurements?.height?.toString() || "",
    inseam: measurements?.inseam?.toString() || "",
    armLength: measurements?.armLength?.toString() || "",
    torsoLength: measurements?.torsoLength?.toString() || "",
    bikeType: measurements?.bikeType || "road" as "road" | "triathlon"
  });

  const isFormValid = formData.height && formData.inseam && formData.armLength && formData.torsoLength;

  const lemondResult = isFormValid ? calculateLeMond({
    height: parseFloat(formData.height),
    inseam: parseFloat(formData.inseam),
    armLength: parseFloat(formData.armLength),
    torsoLength: parseFloat(formData.torsoLength),
    bikeType: formData.bikeType
  }) : null;

  return (
    <div className="p-4 space-y-6 pb-20 animate-in fade-in zoom-in-95 duration-300">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Bike Fitter</h1>
        <p className="text-sm text-muted-foreground">專業單車 Fitting 分析工具</p>
      </div>

      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">基本數據</CardTitle>
          <CardDescription>請輸入您的身體數據以進行基礎計算</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>車種</Label>
              <RadioGroup 
                value={formData.bikeType} 
                onValueChange={(val: "road" | "triathlon") => setFormData(prev => ({...prev, bikeType: val}))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2 bg-background/50 p-3 rounded-md border border-border flex-1">
                  <RadioGroupItem value="road" id="road" />
                  <Label htmlFor="road" className="flex-1 cursor-pointer">公路車</Label>
                </div>
                <div className="flex items-center space-x-2 bg-background/50 p-3 rounded-md border border-border flex-1">
                  <RadioGroupItem value="triathlon" id="triathlon" />
                  <Label htmlFor="triathlon" className="flex-1 cursor-pointer">三鐵車</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">身高 (cm)</Label>
                <Input 
                  id="height" 
                  type="number" 
                  placeholder="175"
                  value={formData.height}
                  onChange={(e) => setFormData(prev => ({...prev, height: e.target.value}))}
                  className="bg-background/50 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inseam">跨高 (cm)</Label>
                <Input 
                  id="inseam" 
                  type="number" 
                  placeholder="82"
                  value={formData.inseam}
                  onChange={(e) => setFormData(prev => ({...prev, inseam: e.target.value}))}
                  className="bg-background/50 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="armLength">臂長 (cm)</Label>
                <Input 
                  id="armLength" 
                  type="number" 
                  placeholder="60"
                  value={formData.armLength}
                  onChange={(e) => setFormData(prev => ({...prev, armLength: e.target.value}))}
                  className="bg-background/50 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="torsoLength">軀幹長 (cm)</Label>
                <Input 
                  id="torsoLength" 
                  type="number" 
                  placeholder="65"
                  value={formData.torsoLength}
                  onChange={(e) => setFormData(prev => ({...prev, torsoLength: e.target.value}))}
                  className="bg-background/50 focus-visible:ring-primary"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {lemondResult && (
        <Card className="border-primary bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
              <Activity className="w-4 h-4" />
              基礎設定預覽
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs mb-1">建議座高</span>
                <span className="font-mono text-lg">{lemondResult.saddleHeight}</span>
                <span className="text-muted-foreground text-xs ml-1">cm</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">座高範圍</span>
                <span className="font-mono">{lemondResult.saddleHeightMin} - {lemondResult.saddleHeightMax}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button 
        className="w-full h-14 text-lg font-medium shadow-lg shadow-primary/20" 
        size="lg"
        disabled={!isFormValid}
        onClick={() => {
          if (isFormValid) {
            setMeasurements({
              height: parseFloat(formData.height),
              inseam: parseFloat(formData.inseam),
              armLength: parseFloat(formData.armLength),
              torsoLength: parseFloat(formData.torsoLength),
              bikeType: formData.bikeType,
            });
          }
          setActiveTab("analyze");
        }}
        data-testid="button-start-analyze"
      >
        開始分析
      </Button>
    </div>
  );
}
