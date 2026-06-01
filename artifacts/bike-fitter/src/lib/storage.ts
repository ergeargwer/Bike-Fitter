import { BikeProfile, BodyMeasurements, FittingRecord } from "./types";

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

const BIKE_PROFILES_KEY = "bikeProfiles";
export const MAX_BIKE_PROFILES = 2;

export function loadBikeProfiles(): BikeProfile[] {
  try {
    return JSON.parse(localStorage.getItem(BIKE_PROFILES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveBikeProfiles(profiles: BikeProfile[]): void {
  localStorage.setItem(
    BIKE_PROFILES_KEY,
    JSON.stringify(profiles.slice(0, MAX_BIKE_PROFILES))
  );
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
