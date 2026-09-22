// Startdata og lasting/lagring mot `window.storage` (satt opp av firebase.js).
import { newId } from "./lib.js";

export const STORAGE_KEY = "timetrack-v1";
const LEGACY_STORAGE_KEYS = ["timetrack:v1"];

export function defaultData() {
  return {
    jobs: [
      {
        id: newId(),
        name: "Timejobb 1",
        kind: "hourly",
        rate: 0,
        salary: 0,
        period: { type: "month" },
        payoutOffset: 1,
        color: "#ffb23f",
        sups: [
          { id: newId(), name: "Kveld", rate: 0 },
          { id: newId(), name: "Helg", rate: 0 },
        ],
      },
      {
        id: newId(),
        name: "Timejobb 2",
        kind: "hourly",
        rate: 0,
        salary: 0,
        period: { type: "customDay", day: 16 },
        payoutOffset: 1,
        color: "#4ec9b0",
        sups: [],
      },
      {
        id: newId(),
        name: "Fastlønn",
        kind: "fixed",
        rate: 0,
        salary: 0,
        period: { type: "month" },
        payoutOffset: 0,
        color: "#8ab4ff",
        sups: [],
      },
    ],
    entries: [],
    running: null,
    checks: {},
  };
}

export async function loadData() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const result = await window.storage.get(key);
      if (result && result.value) return JSON.parse(result.value);
    } catch {
      // prøv neste nøkkel
    }
  }
  return defaultData();
}

// Kaster hvis lagring feiler (nettverksfeil e.l.) — kalleren avgjør retry/feilmelding.
export async function saveData(data) {
  return window.storage.set(STORAGE_KEY, JSON.stringify(data));
}
