import { FittingRecord } from "./types";

const STORAGE_KEY = "bike-fitter-history";

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
