import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface BodyMeasurements {
  height: number;
  inseam: number;
  armLength: number;
  torsoLength: number;
  bikeType: "road" | "triathlon";
}

export interface PoseAngles {
  kneeAngle: number;
  hipAngle: number;
  torsoAngle: number;
  elbowAngle: number;
  position: "6oclock" | "3oclock";
  kopsOffset?: number;
}

export interface AngleAnalysis {
  name: string;
  detected: number;
  unit: string;
  recommendedMin: number;
  recommendedMax: number;
  status: "符合" | "偏高" | "偏低";
  suggestion: string;
  priority: "high" | "medium" | "low";
  description: string;
}

export interface KOPSAnalysis {
  offset: number;
  isOptimal: boolean;
  description: string;
  suggestion: string;
}

export interface LeMondResult {
  saddleHeight: number;
  saddleHeightMin: number;
  saddleHeightMax: number;
  saddleSetback?: string;
  handlebarDrop?: string;
  saddleForward?: string;
  aerobarsHeight?: string;
}

export interface FittingRecord {
  id: string;
  date: string;
  measurements: BodyMeasurements;
  sixOClockAngles: PoseAngles;
  threeOClockAngles?: PoseAngles;
  lemond: LeMondResult;
  analyses: AngleAnalysis[];
  kops?: KOPSAnalysis;
  fitScore: number;
}

interface AppContextValue {
  measurements: BodyMeasurements | null;
  sixOClockAngles: PoseAngles | null;
  threeOClockAngles: PoseAngles | null;
  history: FittingRecord[];
  setMeasurements: (m: BodyMeasurements) => void;
  setSixOClockAngles: (a: PoseAngles) => void;
  setThreeOClockAngles: (a: PoseAngles) => void;
  saveToHistory: (record: FittingRecord) => Promise<void>;
  deleteFitting: (id: string) => Promise<void>;
  clearSession: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const HISTORY_KEY = "@bike_fitter_history";
const MEASUREMENTS_KEY = "@bike_fitter_measurements";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [measurements, setMeasurementsState] = useState<BodyMeasurements | null>(null);
  const [sixOClockAngles, setSixOClockAnglesState] = useState<PoseAngles | null>(null);
  const [threeOClockAngles, setThreeOClockAnglesState] = useState<PoseAngles | null>(null);
  const [history, setHistory] = useState<FittingRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [savedMeasurements, savedHistory] = await Promise.all([
          AsyncStorage.getItem(MEASUREMENTS_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
        ]);
        if (savedMeasurements) {
          setMeasurementsState(JSON.parse(savedMeasurements));
        }
        if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
        }
      } catch {
        // ignore storage errors
      }
    };
    load();
  }, []);

  const setMeasurements = useCallback(async (m: BodyMeasurements) => {
    setMeasurementsState(m);
    try {
      await AsyncStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(m));
    } catch {
      // ignore
    }
  }, []);

  const setSixOClockAngles = useCallback((a: PoseAngles) => {
    setSixOClockAnglesState(a);
  }, []);

  const setThreeOClockAngles = useCallback((a: PoseAngles) => {
    setThreeOClockAnglesState(a);
  }, []);

  const saveToHistory = useCallback(async (record: FittingRecord) => {
    const updated = [record, ...history].slice(0, 50);
    setHistory(updated);
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [history]);

  const deleteFitting = useCallback(async (id: string) => {
    const updated = history.filter((r) => r.id !== id);
    setHistory(updated);
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [history]);

  const clearSession = useCallback(() => {
    setSixOClockAnglesState(null);
    setThreeOClockAnglesState(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        measurements,
        sixOClockAngles,
        threeOClockAngles,
        history,
        setMeasurements,
        setSixOClockAngles,
        setThreeOClockAngles,
        saveToHistory,
        deleteFitting,
        clearSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
