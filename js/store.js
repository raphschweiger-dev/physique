// Persistence: everything lives in localStorage on the device, with JSON export/import as backup.
import { BASELINE_PRIORITIES } from './data.js';

const KEY = 'physique.v1';

export function defaultState() {
  return {
    version: 1,
    onboarded: false,
    profile: { experience: 'intermediate', sessionMinutes: 75, bodyweight: null },
    settings: {
      daysPerWeek: 4,
      location: 'ask',                       // ask | gym | home
      home: { bar: true, chair: true, bench: false, db: [], kb: [] },
      gymSteps: { barbell: 2.5, dumbbell: 2, cable: 2.5, machine: 2.5, smith: 2.5, bodyweight: 2.5 },
      sound: true,
    },
    priorities: { ...BASELINE_PRIORITIES },
    meso: { number: 1, week: 1, offsets: {}, startedAt: Date.now() },
    planWeek: { index: 0, done: [] },
    exPrefs: {},
    sessions: [],
    active: null,
    measurements: [],
    fatigue: 0,
    lastBackup: null,
    createdAt: Date.now(),
  };
}

// Fill in keys added in newer versions so older saves and backups keep working.
function migrate(s) {
  const d = defaultState();
  return {
    ...d, ...s,
    profile: { ...d.profile, ...s.profile },
    settings: {
      ...d.settings, ...s.settings,
      home: { ...d.settings.home, ...s.settings?.home },
      gymSteps: { ...d.settings.gymSteps, ...s.settings?.gymSteps },
    },
    priorities: { ...d.priorities, ...s.priorities },
    meso: { ...d.meso, ...s.meso, offsets: { ...s.meso?.offsets } },
    planWeek: { ...d.planWeek, ...s.planWeek },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not read saved data', e);
  }
  return defaultState();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Could not save', e);
    return false;
  }
}

export const exportJSON = state => JSON.stringify({ app: 'physique', exportedAt: new Date().toISOString(), state });

export function importJSON(text) {
  const data = JSON.parse(text);
  const s = data.state || data;
  if (!s || !Array.isArray(s.sessions) || !s.priorities) throw new Error('This file is not a Physique backup.');
  return migrate(s);
}

// Ask the browser not to evict our storage (no-op where unsupported).
export function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* unsupported */ }
}
