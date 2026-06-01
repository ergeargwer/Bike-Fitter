import { useState } from "react";
import { useAppContext } from "@/lib/context";
import { BikeProfile } from "@/lib/types";
import { MAX_BIKE_PROFILES } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bike, Plus, Trash2, ChevronRight, ArrowLeft } from "lucide-react";

type FormData = Omit<BikeProfile, "id">;

const EMPTY_FORM: FormData = {
  name: "",
  type: "road",
  sizeLabel: "",
  geometry: {
    seatTube: 0,
    stack: 0,
    reach: 0,
    headTube: 0,
    seatAngle: 73,
    bbDrop: 0,
    forkRake: 0,
  },
};

function GeomField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {label} <span className="text-muted-foreground/60">({unit})</span>
      </Label>
      <Input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-background/50 h-9 text-sm"
        placeholder="0"
      />
    </div>
  );
}

export function BikeProfiles() {
  const { bikeProfiles, setBikeProfiles } = useAppContext();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId("new");
  };

  const openEdit = (p: BikeProfile) => {
    setForm({ name: p.name, type: p.type, sizeLabel: p.sizeLabel, geometry: { ...p.geometry } });
    setEditingId(p.id);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.sizeLabel.trim()) return;
    if (editingId === "new") {
      const newProfile: BikeProfile = {
        id: crypto.randomUUID(),
        ...form,
      };
      setBikeProfiles([...bikeProfiles, newProfile]);
    } else {
      setBikeProfiles(
        bikeProfiles.map((p) => (p.id === editingId ? { id: p.id, ...form } : p))
      );
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setBikeProfiles(bikeProfiles.filter((p) => p.id !== id));
  };

  const setGeom = (key: keyof BikeProfile["geometry"], val: number) => {
    setForm((f) => ({ ...f, geometry: { ...f.geometry, [key]: val } }));
  };

  const isFormValid = form.name.trim() && form.sizeLabel.trim();

  if (editingId !== null) {
    return (
      <div className="p-4 space-y-5 pb-24 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditingId(null)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">
            {editingId === "new" ? "新增車型" : "編輯車型"}
          </h1>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1">
              <Label>車型名稱</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="例如：Mamba Road"
                className="bg-background/50"
              />
            </div>

            <div className="space-y-1">
              <Label>車種</Label>
              <div className="flex gap-3">
                {(["road", "tri"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                      form.type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {t === "road" ? "公路車" : "三鐵車"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>尺寸代號</Label>
              <Input
                value={form.sizeLabel}
                onChange={(e) => setForm((f) => ({ ...f, sizeLabel: e.target.value }))}
                placeholder="例如：M、54cm、自訂"
                className="bg-background/50"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            車架幾何
          </p>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 grid grid-cols-2 gap-3">
              <GeomField label="座管長" unit="mm" value={form.geometry.seatTube} onChange={(v) => setGeom("seatTube", v)} />
              <GeomField label="Stack" unit="mm" value={form.geometry.stack} onChange={(v) => setGeom("stack", v)} />
              <GeomField label="Reach" unit="mm" value={form.geometry.reach} onChange={(v) => setGeom("reach", v)} />
              <GeomField label="Head Tube" unit="mm" value={form.geometry.headTube} onChange={(v) => setGeom("headTube", v)} />
              <GeomField label="座管角度" unit="°" value={form.geometry.seatAngle} onChange={(v) => setGeom("seatAngle", v)} />
              <GeomField label="BB Drop" unit="mm" value={form.geometry.bbDrop} onChange={(v) => setGeom("bbDrop", v)} />
              <GeomField label="Fork Rake" unit="mm" value={form.geometry.forkRake} onChange={(v) => setGeom("forkRake", v)} />
            </CardContent>
          </Card>
        </div>

        <Button
          className="w-full h-12 font-semibold"
          onClick={handleSave}
          disabled={!isFormValid}
        >
          儲存車型
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 pb-24 animate-in fade-in duration-300">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">車型管理</h1>
        <p className="text-sm text-muted-foreground">
          最多儲存 {MAX_BIKE_PROFILES} 台車型（{bikeProfiles.length}/{MAX_BIKE_PROFILES}）
        </p>
      </div>

      {bikeProfiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="p-4 rounded-full bg-muted">
            <Bike className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">尚未新增任何車型</p>
          <p className="text-muted-foreground/60 text-xs">新增車型後可在分析時選擇，並獲得車架幾何建議</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bikeProfiles.map((p) => (
            <Card
              key={p.id}
              className="border-border/50 bg-card/50 hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Bike className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.type === "road" ? "公路車" : "三鐵車"} · {p.sizeLabel}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">
                    Stack {p.geometry.stack}mm · Reach {p.geometry.reach}mm
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    data-testid={`button-delete-profile-${p.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    data-testid={`button-edit-profile-${p.id}`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {bikeProfiles.length < MAX_BIKE_PROFILES && (
        <Button
          variant="outline"
          className="w-full h-12 font-semibold border-dashed border-primary/40 text-primary hover:bg-primary/10"
          onClick={openNew}
          data-testid="button-add-profile"
        >
          <Plus className="w-4 h-4 mr-2" />
          新增車型
        </Button>
      )}
    </div>
  );
}
