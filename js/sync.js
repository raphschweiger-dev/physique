// Optional sync across devices through Firestore's REST API (no SDK, no sign-in).
// A sync code is a long random secret: every device that knows it shares one log.
// Workouts merge by id (they never change once saved); the rest of the state is
// last-writer-wins. The workout in progress and the backup date stay on each device.
import { FIREBASE } from './sync-config.js';
import { SPLITS } from './data.js';

const META_KEY = 'physique.sync';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I to mix up
const CODE_LEN = 20;
const EPOCH = '1970-01-01T00:00:00Z';
const SYNCED_KEYS = ['onboarded', 'profile', 'settings', 'priorities', 'meso', 'planWeek', 'exPrefs', 'measurements', 'fatigue'];
const SYNCED_AT = { fieldPath: 'syncedAt', setToServerValue: 'REQUEST_TIME' };

export class SyncError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

export const configured = () => Boolean(FIREBASE.projectId && FIREBASE.apiKey);

// Per-device bookkeeping: the code, which workouts the cloud already has, and the last
// cloud version of the shared state this device has seen.
let meta = (() => { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; } })();
const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* storage full or blocked */ } };

export const isOn = () => configured() && Boolean(meta.code);
const format = c => c.match(/.{1,4}/g).join('-');
export const code = () => (meta.code ? format(meta.code) : '');
export const status = () => ({ lastSync: meta.lastSync || null, error: meta.error || null });

export function normalize(input) {
  const c = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === CODE_LEN && [...c].every(ch => ALPHABET.includes(ch)) ? c : null;
}

// 32 letters divide 256 evenly, so every character is equally likely: 100 bits of randomness.
const newCode = () => [...crypto.getRandomValues(new Uint8Array(CODE_LEN))].map(b => ALPHABET[b % 32]).join('');

const subset = s => Object.fromEntries(SYNCED_KEYS.map(k => [k, s[k]]));
function hash(obj) {
  const str = JSON.stringify(obj);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) | 0;
  return `${str.length}:${h >>> 0}`;
}
// Firestore timestamps come with varying fraction digits; compare them padded.
const normTs = t => (t ? t.replace(/(?:\.(\d+))?Z$/, (_, f = '') => `.${(f + '000000000').slice(0, 9)}Z`) : '');
const sameTime = (a, b) => Boolean(a && b) && normTs(a) === normTs(b);

// ---------- Firestore REST ----------

const ROOT = () => `projects/${FIREBASE.projectId}/databases/(default)/documents`;
const docName = path => `${ROOT()}/${path}`;
const url = path => `${FIREBASE.baseUrl || 'https://firestore.googleapis.com/v1'}/${path}?key=${encodeURIComponent(FIREBASE.apiKey)}`;

async function call(method, path, body, { allowMissing = false } = {}) {
  let res;
  try {
    res = await fetch(url(path), {
      method, cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new SyncError('offline', 'Offline. Changes sync when you’re back online.');
  }
  if (res.status === 404 && allowMissing) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 403) throw new SyncError('denied', 'The sync database refused access. Check the Firestore rules.');
  if (!res.ok) throw new SyncError('error', `Sync failed (${data.error?.status || res.status}). Try again later.`);
  return data;
}

async function commit(writes) {
  const results = [];
  for (let i = 0; i < writes.length; i += 400) {
    const r = await call('POST', `${ROOT()}:commit`, { writes: writes.slice(i, i + 400) });
    results.push(...(r.writeResults || []));
  }
  return results;
}

const stateWrite = s => ({
  update: {
    name: docName(`sync/${meta.code}`),
    fields: { data: { stringValue: JSON.stringify(subset(s)) }, updatedAt: { integerValue: String(meta.stateUpdatedAt || Date.now()) } },
  },
  updateTransforms: [SYNCED_AT],
});

const sessionWrite = x => ({
  update: { name: docName(`sync/${meta.code}/sessions/${x.id}`), fields: { data: { stringValue: JSON.stringify(x) } } },
  updateTransforms: [SYNCED_AT],
});

async function fetchState(c = meta.code) {
  const d = await call('GET', `${ROOT()}/sync/${c}`, null, { allowMissing: true });
  if (!d?.fields?.data) return null;
  return {
    state: JSON.parse(d.fields.data.stringValue),
    updatedAt: Number(d.fields.updatedAt?.integerValue || 0),
    syncedAt: d.fields.syncedAt?.timestampValue || d.updateTime,
  };
}

// Workouts that reached the cloud after `since` (a server timestamp), and the new read time.
async function fetchSessions(since) {
  const rows = await call('POST', `${ROOT()}/sync/${meta.code}:runQuery`, {
    structuredQuery: {
      from: [{ collectionId: 'sessions' }],
      where: { fieldFilter: { field: { fieldPath: 'syncedAt' }, op: 'GREATER_THAN', value: { timestampValue: since || EPOCH } } },
    },
  });
  const docs = [];
  let readTime = since;
  for (const row of rows || []) {
    if (row.readTime) readTime = row.readTime;
    if (row.document) docs.push({ name: row.document.name, data: JSON.parse(row.document.fields.data.stringValue) });
  }
  return { docs, readTime };
}

// ---------- merging ----------

function mergeMeasurements(a = [], b = []) {
  const byDate = new Map([...a, ...b].map(m => [m.date, m]));
  return [...byDate.values()].sort((x, y) => String(x.date).localeCompare(String(y.date)));
}

function applyState(s, remote) {
  const measurements = mergeMeasurements(s.measurements, remote.measurements);
  for (const k of SYNCED_KEYS) if (k in remote) s[k] = remote[k];
  s.measurements = measurements;
}

function addSessions(s, incoming) {
  const have = new Set(s.sessions.map(x => x.id));
  const fresh = incoming.filter(x => !have.has(x.id));
  if (fresh.length) {
    s.sessions.push(...fresh);
    s.sessions.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  return fresh.length;
}

// A day finished on any device counts as done for the current training week.
function reconcileWeek(s) {
  const n = SPLITS[s.settings.daysPerWeek]?.length || 0;
  const done = new Set(s.planWeek.done);
  for (const x of s.sessions) if (x.planWeek === s.planWeek.index && x.dayIndex < n) done.add(x.dayIndex);
  s.planWeek.done = [...done];
}

const markSynced = () => { meta.lastSync = Date.now(); meta.error = null; saveMeta(); };

// ---------- pull & push ----------

// Bring in what other devices changed. Resolves to true when the local state changed.
async function pull(s) {
  const remote = await fetchState();
  if (!remote) throw new SyncError('missing', 'The online copy for this code is gone. Turn sync off, then on again.');
  let changed = false;
  if (!sameTime(remote.syncedAt, meta.stateServerTime)) {
    const localWins = meta.stateDirty && (meta.stateUpdatedAt || 0) > remote.updatedAt;
    if (!localWins) {
      applyState(s, remote.state);
      meta.stateDirty = false;
      meta.stateHash = hash(subset(s));
      meta.stateUpdatedAt = remote.updatedAt;
      changed = true;
    }
    meta.stateServerTime = remote.syncedAt;
  }
  const { docs, readTime } = await fetchSessions(meta.lastPull);
  const pushed = new Set(meta.pushed);
  for (const d of docs) pushed.add(d.data.id);
  if (addSessions(s, docs.map(d => d.data))) changed = true;
  if (changed) reconcileWeek(s);
  meta.pushed = [...pushed];
  meta.lastPull = readTime;
  markSynced();
  return changed;
}

// Send local changes: the shared state if it changed, plus workouts the cloud hasn't seen.
async function push(s) {
  const h = hash(subset(s));
  if (h !== meta.stateHash) {
    meta.stateHash = h;
    meta.stateDirty = true;
    meta.stateUpdatedAt = Date.now();
    saveMeta();
  }
  const pushed = new Set(meta.pushed);
  const fresh = s.sessions.filter(x => !pushed.has(x.id));
  const writes = [...(meta.stateDirty ? [stateWrite(s)] : []), ...fresh.map(sessionWrite)];
  if (!writes.length) { markSynced(); return; }
  const results = await commit(writes);
  if (meta.stateDirty) {
    meta.stateServerTime = results[0]?.transformResults?.[0]?.timestampValue || meta.stateServerTime;
    meta.stateDirty = false;
  }
  meta.pushed = [...pushed, ...fresh.map(x => x.id)];
  markSynced();
}

// One sync step at a time. Background steps record failures for the status line instead of throwing.
let queue = Promise.resolve();
function enqueue(task, { rethrow = false } = {}) {
  const run = queue.then(task).catch(e => {
    meta.error = e instanceof SyncError ? e.message : 'Sync failed. Try again later.';
    saveMeta();
    if (rethrow) throw e;
    return false;
  });
  queue = run.catch(() => {});
  return run;
}

let timer = null;
// Push shortly after local changes settle. getState returns the current state object.
export function schedule(getState, after) {
  if (!isOn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => enqueue(() => push(getState())).then(() => after?.()), 1500);
}

// Pull, then push. Resolves to true when another device changed something.
export function syncNow(s) {
  if (!isOn()) return Promise.resolve(false);
  return enqueue(async () => {
    const changed = await pull(s);
    await push(s);
    return changed;
  });
}

// Start a new synced log from this device's data.
export function enable(s) {
  meta = { code: newCode(), pushed: [], stateDirty: true, stateUpdatedAt: Date.now() };
  saveMeta();
  return enqueue(() => push(s), { rethrow: true });
}

// Connect this device to an existing log: its settings win, this device's workouts are added.
export async function join(input, s) {
  const c = normalize(input);
  if (!c) throw new SyncError('format', 'That doesn’t look like a sync code. It has 20 letters and digits.');
  const remote = await fetchState(c);
  if (!remote) throw new SyncError('missing', 'No synced log found for this code. Check it on your other device.');
  meta = { code: c, pushed: [], stateDirty: false, stateUpdatedAt: remote.updatedAt, stateServerTime: remote.syncedAt };
  applyState(s, remote.state);
  meta.stateHash = hash(subset(s));
  saveMeta();
  return enqueue(async () => { await pull(s); await push(s); }, { rethrow: true });
}

export function disable() {
  clearTimeout(timer);
  meta = {};
  saveMeta();
}

// Remove the online copy (all workouts and settings), then stop syncing on this device.
export function deleteRemote() {
  return enqueue(async () => {
    const { docs } = await fetchSessions(null);
    await commit([...docs.map(d => ({ delete: d.name })), { delete: docName(`sync/${meta.code}`) }]);
    disable();
  }, { rethrow: true });
}
