import { BodyMeasurements, FittingRecord } from "./types";

const STORAGE_KEY = "bike-fitter-history";
const MEASUREMENTS_KEY = "bike-fitter-measurements";

export function loadMeasurements(): BodyMeasurements | null {
  try {
    const raw = localStorage.getItem(MEASUREMENTS_KEY);
    return raw ? (JSON.parse(raw) as BodyMeasurements) : null;
  } catch {
    return null;
  }
}

export function saveMeasurements(m: BodyMeasurements): void {
  localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(m));
}

export function getHistory(): FittingRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveRecord(r: FittingRecord): void {
  const h = getHistory();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([r, ...h]));
}

export function deleteRecord(id: string): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(getHistory().filter((r) => r.id !== id))
  );
}
