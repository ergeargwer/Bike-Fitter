import { createContext, useContext, useState, ReactNode } from "react";
import { BikeProfile, BodyMeasurements, PoseAngles } from "./types";
import { loadMeasurements, saveMeasurements, loadBikeProfiles, saveBikeProfiles } from "./storage";

export type TabType = "home" | "bikes" | "analyze" | "results" | "history";

interface AppContextType {
  measurements: BodyMeasurements | null;
  setMeasurements: (m: BodyMeasurements) => void;
  bikeProfiles: BikeProfile[];
  setBikeProfiles: (profiles: BikeProfile[]) => void;
  selectedBikeProfile: BikeProfile | null;
  setSelectedBikeProfile: (p: BikeProfile | null) => void;
  sixOClockAngles: PoseAngles | null;
  setSixOClockAngles: (a: PoseAngles | null) => void;
  threeOClockAngles: PoseAngles | null;
  setThreeOClockAngles: (a: PoseAngles | null) => void;
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [measurements, setMeasurementsState] = useState<BodyMeasurements | null>(
    () => loadMeasurements()
  );
  const [bikeProfiles, setBikeProfilesState] = useState<BikeProfile[]>(
    () => loadBikeProfiles()
  );
  const [selectedBikeProfile, setSelectedBikeProfile] = useState<BikeProfile | null>(null);
  const [sixOClockAngles, setSixOClockAngles] = useState<PoseAngles | null>(null);
  const [threeOClockAngles, setThreeOClockAngles] = useState<PoseAngles | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  const setMeasurements = (m: BodyMeasurements) => {
    saveMeasurements(m);
    setMeasurementsState(m);
  };

  const setBikeProfiles = (profiles: BikeProfile[]) => {
    saveBikeProfiles(profiles);
    setBikeProfilesState(profiles);
  };

  return (
    <AppContext.Provider
      value={{
        measurements,
        setMeasurements,
        bikeProfiles,
        setBikeProfiles,
        selectedBikeProfile,
        setSelectedBikeProfile,
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
