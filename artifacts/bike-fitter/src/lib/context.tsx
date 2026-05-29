import { createContext, useContext, useState, ReactNode } from "react";
import { BodyMeasurements, PoseAngles } from "./types";

export type TabType = "home" | "analyze" | "results" | "history";

interface AppContextType {
  measurements: BodyMeasurements | null;
  setMeasurements: (m: BodyMeasurements) => void;
  sixOClockAngles: PoseAngles | null;
  setSixOClockAngles: (a: PoseAngles | null) => void;
  threeOClockAngles: PoseAngles | null;
  setThreeOClockAngles: (a: PoseAngles | null) => void;
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [measurements, setMeasurements] = useState<BodyMeasurements | null>(null);
  const [sixOClockAngles, setSixOClockAngles] = useState<PoseAngles | null>(null);
  const [threeOClockAngles, setThreeOClockAngles] = useState<PoseAngles | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  return (
    <AppContext.Provider
      value={{
        measurements,
        setMeasurements,
        sixOClockAngles,
        setSixOClockAngles,
        threeOClockAngles,
        setThreeOClockAngles,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
