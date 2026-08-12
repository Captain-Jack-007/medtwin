import { RealScanResult } from "./types";

export interface RealScanRecord {
  id: string;
  result: RealScanResult;
}

const STORAGE_KEY = "medtwin.real-scan.v1";

export function saveRealScan(record: RealScanRecord): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function loadRealScan(): RealScanRecord | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as RealScanRecord;
    return record?.result?.sessionId ? record : null;
  } catch {
    return null;
  }
}
