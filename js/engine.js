// Training logic: weekly targets, plan generation, exercise choice, progression, volume and fatigue.
import {
  MUSCLES, TIERS, SLOTS, MUSCLE_SLOTS, ALTERNATE, SLOT_FALLBACK, EXERCISES, EXERCISE, SPLITS, EXPERIENCE, TECHNIQUE_LEVELS,
} from './data.js';

export const ACC_WEEKS = 5;                 // build weeks per mesocycle; week 6 is the deload
const RIR_COMPOUND = [3, 2, 2, 1, 1];
const RIR_ISOLATION = [3, 2, 1, 1, 0];
const DELOAD_RIR = 4;
const SESSION_CAP = 8;                      // max direct sets for one muscle in one session
const MIN_SLOT_SETS = 2;
const WARMUP_MIN = 6;
const WORK_SEC = 40;
const MAX_REPS = 30;

// Muscles whose movements give the most indirect volume to others are planned first.
const PROCESS_ORDER = ['chest_upper', 'lats', 'chest', 'upper_back', 'quads', 'hamstrings', 'delts_front',
  'delts_side', 'delts_rear', 'biceps', 'triceps', 'glutes', 'forearms', 'calves', 'abs'];

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const roundTo = (x, step) => Math.round(x / step) * step;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const fmtKg = w => (w === '' || w == null ? '–' : String(Math.round(+w * 100) / 100));
export const fmtSets = v => String(Math.round(v * 2) / 2);

export const isDeload = meso => meso.week > ACC_WEEKS;
export const daysPerWeek = state => SPLITS[state.settings.daysPerWeek].length;

export function weekRir(meso, compound) {
  if (isDeload(meso)) return DELOAD_RIR;
  const w = clamp(meso.week, 1, ACC_WEEKS) - 1;
  return compound ? RIR_COMPOUND[w] : RIR_ISOLATION[w];
}

// Weekly fractional-set target per muscle: ramps from tier start to peak across the build weeks,
// nudged by post-session feedback, halved during the deload.
export function weeklyTargets(state) {
  const mult = EXPERIENCE[state.profile.experience]?.mult ?? 1;
  const deload = isDeload(state.meso);
  const out = {};
  for (const { id } of MUSCLES) {
    const tier = TIERS[state.priorities[id]] || TIERS.maintain;
    const start = tier.start * mult, peak = tier.peak * mult;
    if (!start) { out[id] = 0; continue; }
    if (deload) { out[id] = Math.round(start / 2); continue; }
    const ramp = start + (peak - start) * (clamp(state.meso.week, 1, ACC_WEEKS) - 1) / (ACC_WEEKS - 1);
    out[id] = Math.round(clamp(ramp + (state.meso.offsets[id] || 0), start * 0.6, peak + 4));
  }
  return out;
}

const setMinutes = s => (SLOTS[s.slot].rest + WORK_SEC) / 60;
export const dayMinutes = d => WARMUP_MIN + d.slots.reduce((t, s) => t + s.sets * setMinutes(s), 0);

function spread(arr, k) {
  if (k >= arr.length) return arr;
  if (k === 1) return [arr[0]];
  return Array.from({ length: k }, (_, i) => arr[Math.round(i * (arr.length - 1) / (k - 1))]);
}

function addSlots(day, m, n, occ) {
  const types = MUSCLE_SLOTS[m];
  if (n <= 4) {
    day.slots.push({ slot: ALTERNATE.has(m) ? types[occ % types.length] : types[0], muscle: m, sets: n });
  } else {
    const a = Math.ceil(n / 2);
    day.slots.push({ slot: types[0], muscle: m, sets: a });
    day.slots.push({ slot: types[1] || types[0], muscle: m, sets: n - a });
  }
}

// Split a muscle's weekly direct sets across the days that train it. Every chosen day gets the
// minimum first; each extra set then goes to the day with the most time left, so arm and delt work
// spills onto lighter leg days instead of overfilling upper days. Skew is capped to keep frequency.
function allocate(days, m, n, dayIdx, cap) {
  let f = dayIdx.length;
  if (n < f * MIN_SLOT_SETS) f = Math.max(1, Math.floor(n / MIN_SLOT_SETS));
  const load = d => dayMinutes(days[d]);
  const chosen = f === 1 ? [dayIdx.reduce((a, b) => (load(b) < load(a) ? b : a))] : spread(dayIdx, f);
  const unit = setMinutes({ slot: MUSCLE_SLOTS[m][0] });
  const maxPer = Math.min(SESSION_CAP, Math.ceil(n / f) + 2);
  const per = new Map();
  let left = n;
  for (const d of chosen) { const k = Math.min(MIN_SLOT_SETS, left); per.set(d, k); left -= k; }
  const room = d => cap - load(d) - per.get(d) * unit;
  while (left > 0) {
    const open = chosen.filter(d => per.get(d) < maxPer);
    if (!open.length) break;
    const d = open.reduce((a, b) => (room(b) > room(a) ? b : a));
    per.set(d, per.get(d) + 1);
    left--;
  }
  for (const d of dayIdx) {   // all chosen days full: use the remaining days
    if (left < MIN_SLOT_SETS) break;
    if (per.has(d)) continue;
    const add = Math.min(maxPer, left);
    per.set(d, add);
    left -= add;
  }
  let occ = 0;
  for (const d of dayIdx) if (per.get(d)) addSlots(days[d], m, per.get(d), occ++);
}

// Fit every day into the time cap, always working on the day that is furthest over. Each step makes
// the cheapest cut: cost grows with the muscle's priority and with how much of its planned volume is
// already gone, so legs give up sets first but never all of them, and priority muscles are cut last.
// A muscle always keeps at least one movement per week.
const TRIM_WEIGHT = { priority: 3, grow: 1.5, maintain: 1, indirect: 1 };

function trimWeek(days, cap, priorities, trimmed) {
  const orig = {};
  for (const d of days) for (const s of d.slots) orig[s.muscle] = (orig[s.muscle] || 0) + s.sets;
  const cur = { ...orig };
  const count = (list, m) => list.filter(o => o.muscle === m).length;
  const weekCount = m => days.reduce((t, d) => t + count(d.slots, m), 0);
  // ties: cut the bigger movement first, and isolation before compound
  const cost = (s, x) => TRIM_WEIGHT[priorities[s.muscle]] * x / Math.max((cur[s.muscle] - x) / orig[s.muscle], 0.05)
    - s.sets * 1e-3 + (SLOTS[s.slot].compound ? 1e-4 : 0);
  const stuck = new Set();
  for (;;) {
    const day = days.filter(d => !stuck.has(d) && dayMinutes(d) > cap).sort((a, b) => dayMinutes(b) - dayMinutes(a))[0];
    if (!day) break;
    let best = null;
    for (const s of day.slots) {
      if (s.sets > MIN_SLOT_SETS) {
        const c = cost(s, 1);
        if (!best || c < best.c) best = { s, x: 1, c };
      }
      const canDrop = priorities[s.muscle] === 'priority' ? count(day.slots, s.muscle) > 1 : weekCount(s.muscle) > 1;
      if (canDrop) {
        const c = cost(s, s.sets) * 1.2;   // prefer shaving over removing a movement
        if (!best || c < best.c) best = { s, x: s.sets, c, drop: true };
      }
    }
    if (!best) { stuck.add(day); continue; }
    const { s, x } = best;
    cur[s.muscle] -= x;
    trimmed[s.muscle] = (trimmed[s.muscle] || 0) + x;
    if (best.drop) day.slots.splice(day.slots.indexOf(s), 1); else s.sets -= x;
  }
}

// Fewer, fuller exercises: the same movement twice in a day becomes one exercise when it's 5 sets or
// fewer, and a lone single set gets folded into the muscle's other movement.
function mergeSmall(day) {
  for (const m of new Set(day.slots.map(s => s.muscle))) {
    const ss = day.slots.filter(s => s.muscle === m);
    if (ss.length < 2) continue;
    const sameType = ss.every(s => s.slot === ss[0].slot);
    const total = ss.reduce((t, s) => t + s.sets, 0);
    if ((sameType && total <= 5) || ss.some(s => s.sets < MIN_SLOT_SETS)) {
      for (const s of ss.slice(1)) { ss[0].sets += s.sets; day.slots.splice(day.slots.indexOf(s), 1); }
    }
  }
}

export function buildPlan(state) {
  const split = SPLITS[state.settings.daysPerWeek];
  const targets = weeklyTargets(state);
  const days = split.map((d, index) => ({ index, name: d.name, muscles: d.muscles, slots: [] }));
  for (const m of PROCESS_ORDER) {
    const tierKey = state.priorities[m];
    const T = targets[m];
    if (tierKey === 'indirect' || !T) continue;
    let covered = 0;
    for (const d of days) for (const s of d.slots) covered += s.sets * (SLOTS[s.slot].map[m] || 0);
    const n = Math.round(Math.max(T - covered, TIERS[tierKey].minDirect * T));
    const dayIdx = days.filter(d => d.muscles.includes(m)).map(d => d.index);
    if (n > 0 && dayIdx.length) allocate(days, m, n, dayIdx, state.profile.sessionMinutes);
  }
  const trimmed = {};
  trimWeek(days, state.profile.sessionMinutes, state.priorities, trimmed);
  const order = s => (SLOTS[s.slot].compound ? 0 : 1000) + TIERS[state.priorities[s.muscle]].rank * 100
    + PROCESS_ORDER.indexOf(s.muscle) * 2 + MUSCLE_SLOTS[s.muscle].indexOf(s.slot);
  for (const d of days) {
    mergeSmall(d);
    d.slots.sort((a, b) => order(a) - order(b));
    const seen = {};
    for (const s of d.slots) s.k = seen[s.slot] = (seen[s.slot] ?? -1) + 1;
    d.minutes = Math.round(dayMinutes(d));
    d.sets = d.slots.reduce((t, s) => t + s.sets, 0);
  }
  const planned = {};
  for (const d of days) for (const s of d.slots) {
    for (const [m, f] of Object.entries(SLOTS[s.slot].map)) planned[m] = (planned[m] || 0) + s.sets * f;
  }
  return { days, targets, planned, trimmed };
}

// ---------- exercise choice ----------

// Can this exercise be done at this location with the kit the user has there?
export function available(state, ex, loc) {
  if (!ex.locs.includes(loc)) return false;
  if (loc === 'gym') return true;
  const kit = loc === 'home' ? state.settings.home : state.settings.anywhere;
  if (ex.needs && ex.needs.some(n => !kit[n])) return false;
  if (ex.equip === 'dumbbell') return loc === 'home' && kit.db.length > 0;
  if (ex.equip === 'kettlebell') return loc === 'home' && kit.kb.length > 0;
  if (ex.equip === 'free') return loc === 'home' && kit.db.length + kit.kb.length > 0;
  if (ex.equip === 'bag') return loc === 'anywhere' && !!kit.backpack;
  return true;
}

export function slotOptions(state, slot, loc) {
  const pick = slots => EXERCISES.filter(e => slots.includes(e.slot) && available(state, e, loc));
  let opts = pick([slot]);
  // e.g. no pull-up bar: try the muscle's other movements, then the closest related movement
  if (!opts.length) opts = pick(MUSCLE_SLOTS[SLOTS[slot].muscle].filter(t => t !== slot));
  if (!opts.length && SLOT_FALLBACK[slot]) opts = pick([SLOT_FALLBACK[slot]]);
  return opts;
}

export const prefKey = (state, loc, dayIndex, s) => `${loc}:${state.settings.daysPerWeek}:${dayIndex}:${s.slot}:${s.k}`;

const NOT_DEFAULT = new Set(['h_negative_pullup', 'h_archer_pushup', 'h_nordic', 'back_squat', 'bench_press',
  'a_one_arm_door_row', 'a_towel_rollout', 'a_fe_pike_pushup']);

export function pickExercise(state, dayIndex, s, loc) {
  const opts = slotOptions(state, s.slot, loc);
  if (!opts.length) return null;
  const pref = state.exPrefs[prefKey(state, loc, dayIndex, s)];
  if (pref && opts.some(o => o.id === pref)) return EXERCISE[pref];
  const pool = opts.filter(o => !NOT_DEFAULT.has(o.id));
  // At home, default to the moves written for home equipment; the shared bodyweight ones stay swappable.
  const preferred = loc === 'home' ? pool.filter(o => o.origin === 'home') : pool;
  const list = preferred.length ? preferred : pool.length ? pool : opts;
  // Vary the exercise between days that train the same muscle (Upper A vs Upper B).
  const m = SLOTS[s.slot].muscle;
  const rank = SPLITS[state.settings.daysPerWeek].slice(0, dayIndex).filter(d => d.muscles.includes(m)).length;
  return list[(rank + s.k) % list.length];
}

// The day's exercises at a location. Fallback movements can land on the same exercise twice
// (e.g. curls standing in for forearm work); then another option is used, or the sets are merged.
export function pickDayExercises(state, day, loc) {
  const out = [];
  for (const s of day.slots) {
    let ex = pickExercise(state, day.index, s, loc);
    if (!ex) continue;
    if (out.some(o => o.ex.id === ex.id)) {
      const alt = slotOptions(state, s.slot, loc).find(o => !NOT_DEFAULT.has(o.id) && !out.some(u => u.ex.id === o.id));
      if (!alt) { out.find(o => o.ex.id === ex.id).sets += s.sets; continue; }
      ex = alt;
    }
    out.push({ s, ex, sets: s.sets });
  }
  return out;
}

// ---------- history & progression ----------

export function history(state, exId) {
  const out = [];
  for (const s of state.sessions) for (const e of s.exercises) {
    if (e.exId !== exId) continue;
    const sets = e.sets.filter(x => x.reps > 0);
    if (sets.length) out.push({ date: s.date, deload: s.deload, level: e.level || 0, sets, sessionId: s.id });
  }
  return out;
}

export const exerciseMap = ex => ex.map || SLOTS[ex.slot].map;
export const effLoad = (state, ex, w) => (ex.bw ? (state.profile.bodyweight || 75) * ex.bw : 0) + (+w || 0);
export const e1rm = (load, reps, rir = 0) => load * (1 + (reps + rir) / 30);   // Epley on reps-to-failure

// Best estimated 1RM of a session (reps-to-failure for unloaded moves like hanging leg raises).
export function exposureScore(state, ex, sets) {
  let best = 0;
  for (const s of sets) {
    if (!(s.reps > 0)) continue;
    const load = effLoad(state, ex, s.w);
    best = Math.max(best, load > 0 ? e1rm(load, s.reps, +s.rir || 0) : s.reps + (+s.rir || 0));
  }
  return best;
}

// Loads you can actually use for an exercise at a location: null = anything (gym), else an ascending
// list. Bodyweight moves start at 0 (= no added load). Anywhere, the loaded backpack goes up in 1-kg steps.
export function weightSteps(state, ex, loc) {
  if (loc === 'gym') return null;
  if (ex.noLoad) return [0];
  let steps;
  if (loc === 'anywhere') {
    const a = state.settings.anywhere;
    steps = a.backpack ? Array.from({ length: Math.max(1, Math.floor(a.backpackMax || 10)) }, (_, i) => i + 1) : [];
  } else {
    const h = state.settings.home;
    const list = ex.equip === 'dumbbell' ? h.db : ex.equip === 'kettlebell' ? h.kb : [...h.db, ...h.kb];
    steps = [...new Set(list.map(Number))].filter(x => x > 0).sort((a, b) => a - b);
  }
  return ex.equip === 'bodyweight' ? [0, ...steps] : steps;
}

export function nextWeight(state, ex, w, loc) {
  const steps = weightSteps(state, ex, loc);
  if (!steps) return roundTo(w + (state.settings.gymSteps[ex.equip] ?? 2.5), 0.25);
  return steps.find(x => x > w + 1e-9) ?? null;
}

function prevWeight(state, ex, w, loc) {
  const steps = weightSteps(state, ex, loc);
  if (!steps) return Math.max(0, roundTo(w - (state.settings.gymSteps[ex.equip] ?? 2.5), 0.25));
  return [...steps].reverse().find(x => x < w - 1e-9) ?? null;
}

const repsStr = sets => sets.map(s => s.reps).join('/');

// Double progression: add reps until every set reaches the top of the range, then add weight.
// With no heavier weight available: harder technique, then a harder variation, then more reps.
// `loc` decides which loads exist (gym: any; home: your dumbbells/kettlebells; anywhere: the backpack).
export function progressionTarget(state, ex, nSets, rir, deload, loc) {
  const [lo, hi] = ex.reps;
  const mid = Math.round((lo + hi) / 2);
  const hist = history(state, ex.id).filter(h => !h.deload);
  const pad = arr => Array.from({ length: nSets }, (_, i) => arr[Math.min(i, arr.length - 1)]);
  if (!hist.length) {
    const note = ex.equip === 'bodyweight'
      ? `First time: aim for ${lo}–${hi} reps, stopping ${rir} short of failure.`
      : ex.equip === 'bag'
        ? `First time: load the backpack so you get about ${mid} reps with ${rir} left in the tank. 1 litre of water ≈ 1 kg.`
        : `First time: pick a weight you can lift about ${mid} times with ${rir} left in the tank.`;
    return { first: true, level: 0, weight: ex.equip === 'bodyweight' ? 0 : '', reps: pad([mid]), action: 'first', note };
  }
  const last = hist[hist.length - 1];
  const level = last.level || 0;
  const work0 = last.sets.filter(s => (+s.w || 0) === Math.max(...last.sets.map(x => +x.w || 0)));
  const lastLine = `Last: ${fmtKg(+work0[0].w || 0)} kg × ${repsStr(work0)}`;
  const steps = weightSteps(state, ex, loc);
  const heaviestHere = steps && steps.length ? steps[steps.length - 1] : null;
  let topW = +work0[0].w || 0;
  let work = work0;

  // Last time used more load than exists here (e.g. +4 kg at home, no backpack today):
  // estimate the reps that match the same effort with the heaviest load available.
  if (heaviestHere != null && topW > heaviestHere + 1e-9) {
    const best = Math.max(...work.map(s => e1rm(effLoad(state, ex, topW), s.reps, +s.rir || 0)));
    const r = clamp(Math.floor(30 * (best / effLoad(state, ex, heaviestHere) - 1) - rir), lo, MAX_REPS);
    topW = heaviestHere;
    work = work.map(s => ({ ...s, w: topW, reps: r }));
    if (deload) {
      return { level, weight: topW, reps: pad([Math.max(1, Math.min(r, hi) - 3)]), action: 'deload', last: lastLine,
        note: 'Deload: stop about 4 reps short of failure.' };
    }
    return { level, weight: topW, reps: pad([r]), action: 'reps', last: lastLine,
      note: `Only ${fmtKg(topW)} kg available here, so aim for more reps to match the effort.` };
  }

  if (deload) {
    return { level, weight: topW, reps: pad(work.map(s => Math.max(1, Math.min(s.reps, hi) - 3))), action: 'deload', last: lastLine,
      note: 'Deload: same weight, stop about 4 reps short of failure.' };
  }

  if (work.every(s => s.reps < lo - 1)) {
    const pw = prevWeight(state, ex, topW, loc);
    if (pw != null && pw < topW) {
      return { level, weight: pw, reps: pad([mid]), action: 'down', last: lastLine,
        note: `Below the ${lo}–${hi} range last time, so drop to ${fmtKg(pw)} kg and own the range.` };
    }
  }

  if (work.every(s => s.reps >= hi)) {
    const upgrade = ex.next && available(state, EXERCISE[ex.next], loc) ? ex.next : null;
    if (upgrade && ex.equip === 'bodyweight') {
      return { level, weight: topW, reps: pad(work.map(s => Math.min(MAX_REPS, s.reps + 1))), action: 'upgrade', upgrade, last: lastLine,
        note: `Top of the range. Move up to ${EXERCISE[upgrade].name} (or keep adding reps here).` };
    }
    const nw = nextWeight(state, ex, topW, loc);
    if (nw != null) {
      const best = Math.max(...work.map(s => e1rm(effLoad(state, ex, topW), s.reps, +s.rir || 0)));
      const pred = Math.floor(30 * (best / effLoad(state, ex, nw) - 1) - rir);
      const r = clamp(pred, lo, hi);
      return { level: 0, weight: nw, reps: pad([r, ...Array(nSets).fill(Math.max(lo, r - 1))]), action: 'weight', last: lastLine,
        note: `Every set hit ${hi}. Go up ${fmtKg(nw - topW)} kg.` };
    }
    if (level < TECHNIQUE_LEVELS.length - 1) {
      const nl = level + 1;
      const why = steps && steps.length <= 1 ? 'No way to add weight here' : 'Heaviest weight maxed out';
      return { level: nl, weight: topW, reps: pad([clamp(hi - 4, lo, hi)]), action: 'technique', last: lastLine,
        note: `${why}. Make it harder: ${TECHNIQUE_LEVELS[nl].name}.` };
    }
    if (upgrade) {
      return { level, weight: topW, reps: pad(work.map(s => Math.min(MAX_REPS, s.reps + 1))), action: 'upgrade', upgrade, last: lastLine,
        note: `This variation is maxed. Move up to ${EXERCISE[upgrade].name}.` };
    }
    return { level, weight: topW, reps: pad(work.map(s => Math.min(MAX_REPS, s.reps + 1))), action: 'reps', last: lastLine,
      note: `Weight and technique maxed. Keep adding reps (up to ${MAX_REPS}).` };
  }

  // Beat last time: +1 rep, adjusted when last session's effort differed from this week's target.
  const reps = work.map(s => Math.max(s.reps, Math.min(hi, s.reps + (s.rir ?? rir) + 1 - rir)));
  return { level, weight: topW, reps: pad(reps), action: 'reps', last: lastLine, note: 'Beat last time: add a rep where you can.' };
}

export function sessionExercise(state, ex, s, deload, loc) {
  const rir = weekRir(state.meso, SLOTS[ex.slot].compound);
  const t = progressionTarget(state, ex, s.sets, rir, deload, loc);
  return {
    slot: s.slot, muscle: s.muscle, k: s.k, exId: ex.id, rir, level: t.level, target: t,
    sets: t.reps.map(r => ({ w: t.weight, reps: r, rir, done: false })),
  };
}

export function createSession(state, plan, dayIndex, loc) {
  const day = plan.days[dayIndex];
  const deload = isDeload(state.meso);
  const exercises = pickDayExercises(state, day, loc).map(({ s, ex, sets }) => sessionExercise(state, ex, { ...s, sets }, deload, loc));
  return {
    id: uid(), startedAt: Date.now(), dayIndex, dayName: day.name, loc, meso: state.meso.number, week: state.meso.week,
    deload, planWeek: state.planWeek.index, exercises,
  };
}

// ---------- volume ----------

export function volumeOf(entries) {
  const v = {};
  for (const e of entries) {
    const ex = EXERCISE[e.exId];
    if (!ex) continue;
    const n = e.sets.filter(s => s.done !== false && s.reps > 0).length;
    if (!n) continue;
    for (const [m, f] of Object.entries(exerciseMap(ex))) v[m] = (v[m] || 0) + n * f;
  }
  return v;
}

export function weekEntries(state, planWeek) {
  const entries = state.sessions.filter(s => s.planWeek === planWeek).flatMap(s => s.exercises);
  if (state.active && state.active.planWeek === planWeek) entries.push(...state.active.exercises);
  return entries;
}

export const weekVolume = (state, planWeek) => volumeOf(weekEntries(state, planWeek));

// Sessions this week in which a muscle was a prime mover for at least one set.
export function weekFrequency(state, planWeek) {
  const f = {};
  const sessions = state.sessions.filter(s => s.planWeek === planWeek);
  if (state.active && state.active.planWeek === planWeek) sessions.push(state.active);
  for (const s of sessions) {
    const hit = new Set();
    for (const e of s.exercises) {
      const ex = EXERCISE[e.exId];
      if (!ex || !e.sets.some(x => x.done !== false && x.reps > 0)) continue;
      for (const [m, w] of Object.entries(exerciseMap(ex))) if (w >= 1) hit.add(m);
    }
    hit.forEach(m => { f[m] = (f[m] || 0) + 1; });
  }
  return f;
}

export function volumeHistory(state) {
  const byWeek = new Map();
  for (const s of state.sessions) {
    if (!byWeek.has(s.planWeek)) byWeek.set(s.planWeek, { week: s.planWeek, entries: [], targets: s.targets || {}, meso: s.meso, mesoWeek: s.week });
    const w = byWeek.get(s.planWeek);
    w.entries.push(...s.exercises);
    if (s.targets) w.targets = s.targets;
  }
  return [...byWeek.values()].sort((a, b) => a.week - b.week).map(w => ({ ...w, vol: volumeOf(w.entries) }));
}

// ---------- after a session ----------

export function sessionPRs(state, session) {
  const prs = [];
  for (const e of session.exercises) {
    const ex = EXERCISE[e.exId];
    const hist = history(state, e.exId);
    if (!ex || !hist.length) continue;
    const best = Math.max(...hist.map(h => exposureScore(state, ex, h.sets)));
    const now = exposureScore(state, ex, e.sets);
    if (now > best * 1.001) prs.push({ exId: e.exId, name: ex.name, now, best });
  }
  return prs;
}

// A "dip" = at least half of the comparable exercises got clearly worse than last time.
export function sessionTrend(state, session) {
  let compared = 0, dropped = 0;
  for (const e of session.exercises) {
    const ex = EXERCISE[e.exId];
    if (!ex) continue;
    const prev = history(state, e.exId).filter(h => !h.deload).pop();
    if (!prev || prev.level !== (e.level || 0)) continue;
    compared++;
    if (exposureScore(state, ex, e.sets) < exposureScore(state, ex, prev.sets) * 0.97) dropped++;
  }
  return { compared, dropped, dip: compared >= 2 && dropped / compared >= 0.5 };
}

// Exposures since the exercise last improved (same technique level, deloads ignored).
export function stallCount(state, exId) {
  const ex = EXERCISE[exId];
  let best = -Infinity, level = -1, since = 0;
  for (const h of history(state, exId).filter(x => !x.deload)) {
    const sc = exposureScore(state, ex, h.sets);
    if (h.level !== level || sc > best * 1.005) { best = h.level !== level ? sc : Math.max(best, sc); level = h.level; since = 0; } else since++;
  }
  return since;
}

export function applyFeedback(state, feedback, pain) {
  if (isDeload(state.meso)) return;
  const bump = { easy: 0.5, right: 0, much: -1 };
  const o = state.meso.offsets;
  for (const [m, v] of Object.entries(feedback)) o[m] = clamp((o[m] || 0) + (bump[v] || 0), -4, 4);
  for (const m of pain) o[m] = clamp((o[m] || 0) - 1, -4, 4);
}

export function nextDay(state) {
  const n = daysPerWeek(state);
  for (let i = 0; i < n; i++) if (!state.planWeek.done.includes(i)) return i;
  return 0;
}

export function startMeso(state) {
  const offsets = {};
  for (const [m, v] of Object.entries(state.meso.offsets)) { const h = Math.round(v / 2); if (h) offsets[m] = h; }
  state.meso = { number: state.meso.number + 1, week: 1, offsets, startedAt: Date.now() };
  state.fatigue = 0;
}

export function advanceWeek(state) {
  state.planWeek = { index: state.planWeek.index + 1, done: [] };
  if (isDeload(state.meso)) startMeso(state); else state.meso.week++;
}

export function startDeload(state) {
  state.meso.week = ACC_WEEKS + 1;
  state.fatigue = 0;
}

export function completeDay(state, dayIndex) {
  if (!state.planWeek.done.includes(dayIndex)) state.planWeek.done.push(dayIndex);
  if (state.planWeek.done.length >= daysPerWeek(state)) { advanceWeek(state); return true; }
  return false;
}
