// UI: renders each tab from state and handles every interaction through data-act delegation.
import {
  MUSCLES, MUSCLE, TIERS, TIER_ORDER, BASELINE_PRIORITIES, EXPERIENCE, SLOTS, EXERCISE, SPLITS,
  TECHNIQUE_LEVELS, SCIENCE,
} from './data.js';
import * as E from './engine.js';
import * as store from './store.js';
import { bodyMap, heatLevel } from './body.js';
import { lineChart, bindLineCharts, weekBars } from './charts.js';

let S = store.load();
const ui = { tab: 'today', mv: 'map', sel: null, obStep: 0, ob: null, planLoc: 'gym', openCue: new Set(), pickDay: null };
let sheet = null;
let timer = null;
let toastTimer = null;

const $app = document.getElementById('app');
const $tabs = document.getElementById('tabbar');
const $sheet = document.getElementById('sheet-root');
const $timer = document.getElementById('timer');
const $toast = document.getElementById('toast');

// ---------- helpers ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const save = () => { if (!store.save(S)) toast('Storage full or blocked. Export a backup in Settings.'); };
const commit = () => { save(); render(); };
const tierOf = m => S.priorities[m];
const muscleOrder = (a, b) => TIERS[tierOf(a)].rank - TIERS[tierOf(b)].rank || MUSCLES.findIndex(x => x.id === a) - MUSCLES.findIndex(x => x.id === b);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtRest = s => (s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60}`) + ' min';
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const ICONS = {
  today: '<path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/>',
  muscles: '<circle cx="12" cy="4.6" r="2.1"/><path d="M4.5 8.6c2.5 1 5 1.4 7.5 1.4s5-.4 7.5-1.4M12 10v5.2M8.8 21l3.2-5.8 3.2 5.8"/>',
  progress: '<path d="M4 4.5V19.5H20"/><path d="M7.5 15l3.5-4.5 3 2.5 5-6.5"/>',
  plan: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  swap: '<path d="M7 4L4 7l3 3M4 7h12M17 20l3-3-3-3M20 17H8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  gym: '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>',
  home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  share: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12v8h14v-8"/>',
  warn: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4.5l3 2M9.5 2.5h5"/>',
};
const icon = (name, size = 22) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
}

function getPath(root, path) { return path.split('.').reduce((o, k) => o?.[k], root); }
function setPath(root, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], root)[last] = value;
}
const rootFor = path => (path.startsWith('ob.') ? [ui.ob, path.slice(3)] : path.startsWith('ui.') ? [ui, path.slice(3)] : [S, path]);

function seg(path, options, { numeric = false, small = false } = {}) {
  const [root, p] = rootFor(path);
  const cur = getPath(root, p);
  return `<div class="seg${small ? ' small' : ''}" role="radiogroup">${options.map(([v, label]) =>
    `<button role="radio" aria-checked="${String(cur) === String(v)}" class="${String(cur) === String(v) ? 'on' : ''}" data-act="set" data-path="${path}" data-v="${v}"${numeric ? ' data-num="1"' : ''}>${label}</button>`).join('')}</div>`;
}

function toggle(path, label, sub = '') {
  const [root, p] = rootFor(path);
  const on = !!getPath(root, p);
  return `<button class="toggle-row" data-act="flip" data-path="${path}" role="switch" aria-checked="${on}">
    <span><span class="tr-label">${label}</span>${sub ? `<span class="tr-sub">${sub}</span>` : ''}</span>
    <span class="switch${on ? ' on' : ''}"><span></span></span></button>`;
}

const KB_WEIGHTS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32];
const DB_WEIGHTS = [1, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 15, 17.5, 20, 22.5, 25];

function weightPicker(path, defaults) {
  const [root, p] = rootFor(path);
  const list = getPath(root, p);
  const all = [...new Set([...defaults, ...list])].sort((a, b) => a - b);
  return `<div class="wchips">${all.map(w => `<button class="wchip${list.includes(w) ? ' on' : ''}" data-act="toggle-weight" data-path="${path}" data-v="${w}" aria-pressed="${list.includes(w)}">${E.fmtKg(w)}</button>`).join('')}
    <span class="wadd"><input class="input tiny" inputmode="decimal" placeholder="Other" aria-label="Add another weight in kg" data-add-for="${path}"><button class="btn small ghost" data-act="add-weight" data-path="${path}">Add</button></span></div>`;
}

// ---------- shared bits ----------

function muscleChips(entries) {
  return `<div class="chips">${entries.map(([m, n]) =>
    `<span class="chip${tierOf(m) === 'priority' ? ' pri' : ''}">${esc(MUSCLE[m].name)} <b>${E.fmtSets(n)}</b></span>`).join('')}</div>`;
}

function daySetsByMuscle(day) {
  const by = {};
  for (const s of day.slots) by[s.muscle] = (by[s.muscle] || 0) + s.sets;
  return Object.entries(by).sort((a, b) => muscleOrder(a[0], b[0]));
}

function mesoPill() {
  return E.isDeload(S.meso) ? `<span class="pill">Meso ${S.meso.number} · Deload</span>`
    : `<span class="pill">Meso ${S.meso.number} · Week ${S.meso.week}/${E.ACC_WEEKS}</span>`;
}

function effortLine() {
  if (E.isDeload(S.meso)) return 'Deload week: half the sets, stop ~4 reps short';
  const c = E.weekRir(S.meso, true), i = E.weekRir(S.meso, false);
  const word = r => (r === 0 ? 'to failure' : `${r} in reserve`);
  return `Big lifts ${word(c)} · isolation ${word(i)}`;
}

function meter(done, target, planned) {
  const max = Math.max(target, done, planned || 0, 1) * 1.08;
  const pct = v => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;
  return `<div class="meter" aria-hidden="true">
    ${planned ? `<div class="meter-plan" style="width:${pct(planned)}"></div>` : ''}
    <div class="meter-fill" style="width:${pct(done)}"></div>
    ${target ? `<div class="meter-target" style="left:${pct(target)}"></div>` : ''}
  </div>`;
}

function statusLabel(done, target) {
  if (!target) return '<span class="status muted">Indirect only</span>';
  if (done >= target) return `<span class="status good">${icon('check', 14)} On target</span>`;
  return `<span class="status muted">${E.fmtSets(target - done)} to go</span>`;
}

// ---------- onboarding ----------

function startOnboarding() {
  ui.ob = {
    daysPerWeek: 4, experience: 'intermediate', bodyweight: '', sessionMinutes: 75,
    home: { bar: true, chair: true, bench: false, db: [], kb: [] },
    priorities: { ...BASELINE_PRIORITIES },
  };
  ui.obStep = 0;
}

const OB_STEPS = 6;

function viewOnboarding() {
  if (!ui.ob) startOnboarding();
  const o = ui.ob, st = ui.obStep;
  const dots = `<div class="ob-dots">${Array.from({ length: OB_STEPS - 1 }, (_, i) => `<span class="${i < st ? 'on' : ''}"></span>`).join('')}</div>`;
  const nav = (label = 'Continue') => `<div class="ob-nav">
    <button class="btn ghost" data-act="ob-back">Back</button>
    <button class="btn primary" data-act="ob-next">${label}</button></div>`;
  if (st === 0) {
    return `<div class="ob ob-welcome">
      <div class="ob-logo">${logoSVG()}</div>
      <h1>Physique</h1>
      <p class="lead">A hypertrophy plan built for aesthetics. It tracks every muscle you hit and adjusts to what you log.</p>
      <ul class="ob-points">
        <li>${icon('check', 18)} Volume, effort and rest based on current research</li>
        <li>${icon('check', 18)} Same muscle volume at the gym or at home</li>
        <li>${icon('check', 18)} Tells you exactly what to beat next session</li>
      </ul>
      <button class="btn primary big" data-act="ob-next">Set up my plan</button>
    </div>`;
  }
  if (st === 1) {
    return `<div class="ob">${dots}
      <h1>How many days a week?</h1>
      <p class="lead">You can change this anytime. Your history carries over.</p>
      <div class="opt-list">${[2, 3, 4, 5, 6].map(n => `<button class="opt${o.daysPerWeek === n ? ' on' : ''}" data-act="set" data-path="ob.daysPerWeek" data-v="${n}" data-num="1">
        <span class="opt-big">${n}</span><span class="opt-text"><b>${n} days</b><span>${SPLITS[n].map(d => esc(d.name)).join(' · ')}</span></span></button>`).join('')}</div>
      ${nav()}</div>`;
  }
  if (st === 2) {
    return `<div class="ob">${dots}
      <h1>Your training background</h1>
      <p class="lead">Sets your starting volume. Beginners grow on less.</p>
      <div class="opt-list">${Object.entries(EXPERIENCE).map(([k, v]) => `<button class="opt${o.experience === k ? ' on' : ''}" data-act="set" data-path="ob.experience" data-v="${k}">
        <span class="opt-text"><b>${v.label}</b><span>${k === 'beginner' ? 'New or returning after a long break' : k === 'intermediate' ? 'Consistent training, still progressing steadily' : 'Years of consistent, hard training'}</span></span></button>`).join('')}</div>
      <label class="field"><span>Bodyweight (kg, optional)</span>
        <input class="input" inputmode="decimal" data-bind="ob.bodyweight" value="${esc(o.bodyweight)}" placeholder="e.g. 78"></label>
      <p class="hint">Used to estimate strength on pull-ups, push-ups and dips.</p>
      ${nav()}</div>`;
  }
  if (st === 3) {
    return `<div class="ob">${dots}
      <h1>How long can you train?</h1>
      <p class="lead">Per session. Longer sessions fit more volume. When time runs short, the plan cuts the lowest-priority sets first.</p>
      <div class="opt-list grid2">${[45, 60, 75, 90].map(n => `<button class="opt center${o.sessionMinutes === n ? ' on' : ''}" data-act="set" data-path="ob.sessionMinutes" data-v="${n}" data-num="1"><span class="opt-big">${n}</span><span class="muted">minutes</span></button>`).join('')}</div>
      ${nav()}</div>`;
  }
  if (st === 4) {
    return `<div class="ob">${dots}
      <h1>Your home gym</h1>
      <p class="lead">Pick every weight you own. Home plans only suggest weights you actually have.</p>
      <div class="card flush">
        ${toggle('ob.home.bar', 'Pull-up bar')}
        ${toggle('ob.home.chair', 'Sturdy chair or couch', 'For split squats, rows, hip thrusts')}
        ${toggle('ob.home.bench', 'Weight bench')}
      </div>
      <h3 class="sub">Kettlebells (kg)</h3>${weightPicker('ob.home.kb', KB_WEIGHTS)}
      <h3 class="sub">Dumbbells (kg)</h3>${weightPicker('ob.home.db', DB_WEIGHTS)}
      ${nav()}</div>`;
  }
  return `<div class="ob">${dots}
    <h1>Muscle priorities</h1>
    <p class="lead">Baseline: <b>Aesthetic V-taper</b>. Shoulders, lats, upper chest and arms get the most volume. Legs stay on a maintenance dose.</p>
    ${priorityEditor('ob.priorities')}
    <div class="ob-nav"><button class="btn ghost" data-act="ob-back">Back</button><button class="btn primary" data-act="ob-finish">Build my plan</button></div>
  </div>`;
}

function priorityEditor(path) {
  const [root, p] = rootFor(path);
  const pr = getPath(root, p);
  const groups = [...new Set(MUSCLES.map(m => m.group))];
  return `<div class="prio">${groups.map(g => `<div class="prio-group"><h3 class="sub">${g}</h3>
    ${MUSCLES.filter(m => m.group === g).map(m => `<div class="prio-row"><span class="prio-name">${esc(m.name)}</span>
      <div class="seg small">${TIER_ORDER.map(t => `<button class="${pr[m.id] === t ? 'on' : ''}" aria-pressed="${pr[m.id] === t}" data-act="set" data-path="${path}.${m.id}" data-v="${t}">${t === 'indirect' ? 'Indirect' : TIERS[t].label}</button>`).join('')}</div></div>`).join('')}
  </div>`).join('')}</div>`;
}

function logoSVG() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5598e7"/><stop offset="1" stop-color="#1c5cab"/></linearGradient></defs>
    <rect width="64" height="64" rx="16" fill="#1a1a19"/><circle cx="32" cy="15.5" r="5" fill="url(#lg)"/>
    <path d="M12 24.5C19 22.8 25.5 22 32 22s13 .8 20 2.5L42 50a3 3 0 0 1-2.8 2H24.8a3 3 0 0 1-2.8-2Z" fill="url(#lg)"/></svg>`;
}

// ---------- today ----------

function viewToday() {
  if (S.active) return viewWorkout();
  const plan = E.buildPlan(S);
  const n = plan.days.length;
  const di = ui.pickDay ?? E.nextDay(S);
  const day = plan.days[di];
  const vol = E.weekVolume(S, S.planWeek.index);
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const banners = [];
  if (isIOS() && !isStandalone()) {
    banners.push(`<section class="card note">${icon('share', 20)}<div><b>Install as an app</b><p>In Safari tap Share, then <b>Add to Home Screen</b>. It opens full-screen and works offline.</p></div></section>`);
  }
  if (S.fatigue >= 2 && !E.isDeload(S.meso)) {
    banners.push(`<section class="card note warn">${icon('warn', 20)}<div><b>Performance dipped two sessions in a row</b>
      <p>That usually means fatigue is outrunning recovery. An easy week now lets you come back stronger.</p>
      <div class="row"><button class="btn small primary" data-act="deload-now">Start deload week</button><button class="btn small ghost" data-act="dismiss-fatigue">Not now</button></div></div></section>`);
  }
  const daysSinceBackup = S.lastBackup ? (Date.now() - S.lastBackup) / 864e5 : Infinity;
  if (S.sessions.length >= 4 && daysSinceBackup > 21) {
    banners.push(`<section class="card note">${icon('info', 20)}<div><b>Back up your log</b><p>Your data lives only on this phone. Export a backup in Settings now and then.</p>
      <div class="row"><button class="btn small ghost" data-act="go" data-tab="settings">Go to Settings</button></div></div></section>`);
  }
  const prio = MUSCLES.filter(m => tierOf(m.id) === 'priority');
  return `<header class="top"><div><p class="eyebrow">${esc(dateStr)}</p><h1>Today</h1></div>${mesoPill()}</header>
    ${banners.join('')}
    <section class="card hero">
      <div class="hero-meta"><span>Day ${di + 1} of ${n}</span><span>~${day.minutes} min · ${day.sets} sets</span></div>
      <h2>${esc(day.name)}</h2>
      <p class="effort">${effortLine()}</p>
      ${muscleChips(daySetsByMuscle(day))}
      <button class="btn primary big" data-act="start" data-day="${di}">Start workout</button>
      <button class="btn text" data-act="pick-day">Pick another day</button>
    </section>
    <section class="card">
      <div class="card-head"><h3>This week</h3><span class="muted">${S.planWeek.done.length}/${n} done</span></div>
      <div class="week-strip">${plan.days.map(d => {
        const done = S.planWeek.done.includes(d.index);
        return `<div class="wd${done ? ' done' : ''}${d.index === di ? ' next' : ''}"><span class="wd-dot">${done ? icon('check', 16) : d.index + 1}</span><span class="wd-name">${esc(d.name)}</span></div>`;
      }).join('')}</div>
    </section>
    <section class="card">
      <div class="card-head"><h3>Priority muscles</h3><button class="btn text small" data-act="go" data-tab="muscles">All muscles ${icon('chevron', 14)}</button></div>
      ${prio.map(m => {
        const done = vol[m.id] || 0, t = plan.targets[m.id];
        return `<div class="mini-row"><div class="mini-top"><span>${esc(m.name)}</span><span class="num-label"><b>${E.fmtSets(done)}</b> / ${t} sets</span></div>${meter(done, t)}</div>`;
      }).join('')}
    </section>`;
}

// ---------- workout ----------

function workoutStats(a) {
  let done = 0, total = 0;
  for (const e of a.exercises) for (const s of e.sets) { total++; if (s.done) done++; }
  return { done, total };
}

const elapsed = a => {
  const s = Math.floor((Date.now() - a.startedAt) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function viewWorkout() {
  const a = S.active;
  const st = workoutStats(a);
  return `<header class="top wk"><div><p class="eyebrow">${a.deload ? 'Deload week' : `Meso ${a.meso} · Week ${a.week}`}</p><h1>${esc(a.dayName)}</h1></div>
      <button class="loc-pill" data-act="switch-loc">${icon(a.loc, 18)}${a.loc === 'gym' ? 'Gym' : 'Home'}</button></header>
    <div class="wk-meta"><span>${icon('timer', 16)} <span id="elapsed">${elapsed(a)}</span></span><span>${st.done}/${st.total} sets</span></div>
    <div class="wk-progress"><div style="width:${st.total ? (st.done / st.total) * 100 : 0}%"></div></div>
    ${a.exercises.map((e, i) => exerciseCard(a, e, i)).join('') || '<p class="muted pad">No exercises available. Check your equipment in Settings.</p>'}
    <button class="btn primary big" data-act="finish">Finish workout</button>
    <button class="btn text danger" data-act="discard">Discard workout</button>`;
}

function exerciseCard(a, e, i) {
  const ex = EXERCISE[e.exId];
  const map = E.exerciseMap(ex);
  const helpers = Object.entries(map).filter(([m, w]) => w < 1 && m !== e.muscle).map(([m]) => MUSCLE[m].name.toLowerCase());
  const primary = Object.entries(map).filter(([, w]) => w >= 1).map(([m]) => MUSCLE[m].name);
  const t = e.target || {};
  const bw = ex.equip === 'bodyweight';
  const stall = !a.deload && E.stallCount(S, ex.id) >= 3;
  const level = e.level || 0;
  const allDone = e.sets.length && e.sets.every(s => s.done);
  const showCue = ui.openCue.has(i);
  return `<article class="card ex${allDone ? ' complete' : ''}">
    <div class="ex-head">
      <div class="ex-title"><h3>${esc(ex.name)}</h3>
        <p class="ex-muscles">${esc(primary.join(' + '))}${helpers.length ? `<span class="muted"> · ½ ${esc(helpers.join(', '))}</span>` : ''}</p></div>
      <button class="icon-btn" data-act="swap" data-i="${i}" aria-label="Swap exercise">${icon('swap', 20)}</button>
    </div>
    <div class="tags"><span class="tag">${ex.reps[0]}–${ex.reps[1]} reps</span><span class="tag">${e.rir === 0 ? 'To failure' : `${e.rir} in reserve`}</span><span class="tag">Rest ${fmtRest(SLOTS[ex.slot].rest)}</span>${level ? `<span class="tag accent">${esc(TECHNIQUE_LEVELS[level].name)}</span>` : ''}</div>
    ${t.last || t.note ? `<div class="target">${t.last ? `<span class="muted">${esc(t.last)}</span>` : ''}<span class="target-note${t.action === 'weight' || t.action === 'technique' ? ' up' : ''}">${t.action === 'weight' || t.action === 'technique' ? icon('up', 14) : ''}${esc(t.note || '')}</span></div>` : ''}
    ${t.upgrade ? `<button class="btn small ghost upgrade" data-act="upgrade" data-i="${i}">${icon('up', 16)} Switch to ${esc(EXERCISE[t.upgrade].name)}</button>` : ''}
    ${stall ? `<div class="stall">${icon('warn', 16)} No progress for 3 sessions. Consider swapping this exercise or checking sleep and food.</div>` : ''}
    <div class="sets" role="table" aria-label="Sets">
      <div class="set-row head" role="row"><span>Set</span><span>${bw ? '+kg' : 'kg'}</span><span>Reps</span><span>RIR</span><span></span></div>
      ${e.sets.map((s, j) => setRow(i, j, s, bw)).join('')}
    </div>
    <div class="ex-foot">
      <button class="btn small ghost" data-act="add-set" data-i="${i}">${icon('plus', 16)} Set</button>
      <button class="btn small ghost" data-act="del-set" data-i="${i}"${e.sets.length <= 1 ? ' disabled' : ''}>${icon('minus', 16)} Set</button>
      <button class="btn small ghost" data-act="cue" data-i="${i}" aria-expanded="${showCue}">How to</button>
    </div>
    ${showCue ? `<p class="cue">${esc(ex.cue)}${level ? ` <b>${esc(TECHNIQUE_LEVELS[level].cue)}</b>` : ''}</p>` : ''}
  </article>`;
}

function setRow(i, j, s, bw) {
  const rirBtn = v => `<button class="${(v === 3 ? s.rir >= 3 : s.rir === v) ? 'on' : ''}" data-act="rir" data-i="${i}" data-j="${j}" data-v="${v}" aria-label="${v} reps in reserve">${v === 3 ? '3+' : v}</button>`;
  return `<div class="set-row${s.done ? ' done' : ''}" role="row">
    <span class="set-n">${j + 1}</span>
    <input class="input num" inputmode="decimal" data-in="w" data-i="${i}" data-j="${j}" value="${esc(s.w)}" placeholder="${bw ? '0' : 'kg'}" aria-label="Set ${j + 1} weight">
    <input class="input num" inputmode="numeric" data-in="reps" data-i="${i}" data-j="${j}" value="${esc(s.reps)}" placeholder="reps" aria-label="Set ${j + 1} reps">
    <div class="rir">${[0, 1, 2, 3].map(rirBtn).join('')}</div>
    <button class="check${s.done ? ' on' : ''}" data-act="tick" data-i="${i}" data-j="${j}" aria-label="${s.done ? 'Undo set' : 'Log set'} ${j + 1}" aria-pressed="${s.done}">${icon('check', 20)}</button>
  </div>`;
}

// ---------- muscles ----------

function viewMuscles() {
  const plan = E.buildPlan(S);
  const vol = E.weekVolume(S, S.planWeek.index);
  const freq = E.weekFrequency(S, S.planWeek.index);
  const head = `<header class="top"><div><p class="eyebrow">This training week</p><h1>Muscles</h1></div>${mesoPill()}</header>
    ${seg('ui.mv', [['map', 'Map'], ['volume', 'Volume']])}`;
  if (ui.mv === 'map') {
    const levels = {};
    for (const m of MUSCLES) levels[m.id] = tierOf(m.id) === 'indirect' ? 'none' : heatLevel(vol[m.id] || 0, plan.targets[m.id]);
    const sw = (cls, label) => `<span class="lg-item"><span class="lg-sw ${cls}"></span>${label}</span>`;
    return `${head}<section class="card map-card">
        ${bodyMap(levels, ui.sel)}
        <div class="map-labels"><span>Front</span><span>Back</span></div>
        <div class="legend">${sw('bm-l0', 'No sets')}${sw('bm-l1', '<25%')}${sw('bm-l2', '25–50%')}${sw('bm-l3', '50–75%')}${sw('bm-l4', '75–99%')}${sw('bm-l5', 'Target hit')}${sw('bm-lnone', 'Indirect only')}</div>
      </section>
      <p class="hint center">Shading = sets done this week ÷ weekly target. Tap a muscle for details.</p>`;
  }
  return `${head}${TIER_ORDER.map(t => {
    const ms = MUSCLES.filter(m => tierOf(m.id) === t);
    if (!ms.length) return '';
    return `<section class="card flush"><div class="card-head pad"><h3>${TIERS[t].label}</h3><span class="muted">${t === 'indirect' ? 'from compounds' : 'sets this week'}</span></div>
      ${ms.map(m => {
        const done = vol[m.id] || 0, target = plan.targets[m.id];
        return `<button class="vrow" data-act="muscle" data-m="${m.id}">
          <div class="vrow-top"><span class="vname">${esc(m.name)}</span><span class="num-label"><b>${E.fmtSets(done)}</b>${target ? ` / ${target}` : ''}</span></div>
          ${meter(done, target, plan.planned[m.id])}
          <div class="vrow-sub"><span>${freq[m.id] ? `Hit ${freq[m.id]}× this week` : 'Not hit yet'}</span>${statusLabel(done, target)}</div>
        </button>`;
      }).join('')}</section>`;
  }).join('')}
  <p class="hint">Bar = sets done, light bar = planned this week, tick = target. A set counts fully for the main muscle and ½ for helpers (Pelland 2024).</p>`;
}

function muscleSheet(m) {
  const plan = E.buildPlan(S);
  const vol = E.weekVolume(S, S.planWeek.index);
  const freq = E.weekFrequency(S, S.planWeek.index);
  const target = plan.targets[m], done = vol[m] || 0;
  const hist = E.volumeHistory(S).slice(-7);
  const weeks = hist.map(w => ({ label: `W${w.week + 1}`, v: Math.round((w.vol[m] || 0) * 2) / 2, target: w.targets?.[m] || 0, current: w.week === S.planWeek.index }));
  if (!hist.some(w => w.week === S.planWeek.index)) weeks.push({ label: `W${S.planWeek.index + 1}`, v: Math.round(done * 2) / 2, target, current: true });
  const hits = {};
  for (const e of E.weekEntries(S, S.planWeek.index)) {
    const ex = EXERCISE[e.exId], w = E.exerciseMap(ex)[m];
    const n = e.sets.filter(s => s.done !== false && s.reps > 0).length;
    if (w && n) hits[ex.name] = (hits[ex.name] || 0) + n * w;
  }
  const plannedRows = [];
  for (const d of plan.days) for (const s of d.slots) {
    const w = SLOTS[s.slot].map[m];
    if (w) plannedRows.push(`<li><span>${esc(d.name)}: ${esc(SLOTS[s.slot].name)}</span><span>${w === 1 ? plural(s.sets, 'set') : `${s.sets} × ½`}</span></li>`);
  }
  const adj = S.meso.offsets[m] || 0;
  return `<div class="sheet-head"><div><p class="eyebrow">${esc(MUSCLE[m].group)}</p><h2>${esc(MUSCLE[m].name)}</h2></div><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    <div class="stat-row">
      <div class="stat"><span class="stat-v">${E.fmtSets(done)}</span><span class="stat-l">sets this week</span></div>
      <div class="stat"><span class="stat-v">${target || '–'}</span><span class="stat-l">weekly target</span></div>
      <div class="stat"><span class="stat-v">${freq[m] || 0}×</span><span class="stat-l">trained</span></div>
    </div>
    ${adj ? `<p class="hint">Your check-ins moved this target ${adj > 0 ? 'up' : 'down'} by ${E.fmtSets(Math.abs(adj))} sets this mesocycle.</p>` : ''}
    <h3 class="sub">Priority</h3>
    <div class="seg small">${TIER_ORDER.map(t => `<button class="${tierOf(m) === t ? 'on' : ''}" aria-pressed="${tierOf(m) === t}" data-act="set" data-path="priorities.${m}" data-v="${t}">${t === 'indirect' ? 'Indirect' : TIERS[t].label}</button>`).join('')}</div>
    ${weeks.length > 1 ? `<h3 class="sub">Weekly sets</h3>${weekBars(weeks)}<p class="hint">Tick = that week's target.</p>` : ''}
    <h3 class="sub">Counted this week</h3>
    ${Object.keys(hits).length ? `<ul class="kv">${Object.entries(hits).map(([k, v]) => `<li><span>${esc(k)}</span><span>${E.fmtSets(v)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing logged yet this week.</p>'}
    <h3 class="sub">Planned this week</h3>
    ${plannedRows.length ? `<ul class="kv">${plannedRows.join('')}</ul>` : '<p class="muted">No work planned.</p>'}`;
}

// ---------- progress ----------

function prFeed() {
  const best = {}, feed = [];
  for (const s of S.sessions) for (const e of s.exercises) {
    const ex = EXERCISE[e.exId];
    if (!ex || s.deload) continue;
    const sc = E.exposureScore(S, ex, e.sets);
    if (best[e.exId] != null && sc > best[e.exId] * 1.001) feed.push({ date: s.date, ex, sets: e.sets });
    best[e.exId] = Math.max(best[e.exId] ?? 0, sc);
  }
  return feed.reverse();
}

function viewProgress() {
  const totalSets = S.sessions.reduce((t, s) => t + s.exercises.reduce((u, e) => u + e.sets.length, 0), 0);
  const prs = prFeed();
  const prs30 = prs.filter(p => Date.now() - new Date(p.date) < 30 * 864e5).length;
  const exIds = [];
  for (let k = S.sessions.length - 1; k >= 0; k--) for (const e of S.sessions[k].exercises) if (!exIds.includes(e.exId)) exIds.push(e.exId);
  const ms = S.measurements;
  const lastM = ms[ms.length - 1];
  const ratio = lastM && lastM.shoulders && lastM.waist ? lastM.shoulders / lastM.waist : null;
  const ratioPts = ms.filter(x => x.shoulders && x.waist).map(x => ({ t: new Date(x.date).getTime(), v: x.shoulders / x.waist }));
  const width = Math.min(innerWidth, 560) - 64;
  return `<header class="top"><div><p class="eyebrow">Since you started</p><h1>Progress</h1></div></header>
    <div class="stat-row cards">
      <div class="stat card"><span class="stat-v">${S.sessions.length}</span><span class="stat-l">workouts</span></div>
      <div class="stat card"><span class="stat-v">${totalSets}</span><span class="stat-l">hard sets</span></div>
      <div class="stat card"><span class="stat-v">${prs30}</span><span class="stat-l">PRs, 30 days</span></div>
    </div>
    <section class="card">
      <div class="card-head"><h3>Physique</h3><button class="btn small ghost" data-act="measure">${icon('plus', 16)} Log</button></div>
      ${ratio ? `<div class="hero-num"><span class="hn-v">${ratio.toFixed(2)}</span><span class="hn-l">shoulder-to-waist ratio<br><span class="muted">${E.fmtKg(lastM.shoulders)} cm shoulders ÷ ${E.fmtKg(lastM.waist)} cm waist</span></span></div>
        ${ratioPts.length > 1 ? lineChart(ratioPts, { width, fmt: v => v.toFixed(2), label: 'Shoulder-to-waist ratio over time' }) : ''}
        <p class="hint">The V-taper number. ~1.6 is the classic "golden ratio" look. Raise it with shoulder and lat growth while keeping the waist lean.</p>`
        : '<p class="muted">Measure shoulder circumference (around the widest point of the delts) and waist (at the navel) every few weeks to track your V-taper.</p>'}
      ${lastM ? `<ul class="kv">${[['bodyweight', 'Bodyweight', 'kg'], ['shoulders', 'Shoulders', 'cm'], ['chest', 'Chest', 'cm'], ['arm', 'Arm (flexed)', 'cm'], ['waist', 'Waist', 'cm']]
        .filter(([k]) => lastM[k]).map(([k, l, u]) => `<li><span>${l}</span><span>${E.fmtKg(lastM[k])} ${u}</span></li>`).join('')}</ul>` : ''}
    </section>
    <section class="card flush">
      <div class="card-head pad"><h3>Exercises</h3><span class="muted">tap for history</span></div>
      ${exIds.length ? exIds.map(id => {
        const ex = EXERCISE[id];
        if (!ex) return '';
        const h = E.history(S, id);
        const last = h[h.length - 1];
        const topW = Math.max(...last.sets.map(s => +s.w || 0));
        const first = E.exposureScore(S, ex, h[0].sets), now = E.exposureScore(S, ex, last.sets);
        const delta = h.length > 1 && first ? Math.round((now / first - 1) * 100) : null;
        return `<button class="list-row" data-act="exercise" data-ex="${id}">
          <span class="lr-main"><b>${esc(ex.name)}</b><span class="muted">${ex.loc === 'home' ? 'Home · ' : ''}${E.fmtKg(topW)} kg × ${last.sets.map(s => s.reps).join('/')}</span></span>
          ${delta != null ? `<span class="delta${delta > 0 ? ' up' : delta < 0 ? ' down' : ''}">${delta > 0 ? '+' : ''}${delta}%</span>` : ''}${icon('chevron', 16)}</button>`;
      }).join('') : '<p class="muted pad">Finish a workout and your exercises show up here.</p>'}
    </section>
    ${prs.length ? `<section class="card flush"><div class="card-head pad"><h3>Recent PRs</h3></div>
      ${prs.slice(0, 8).map(p => `<div class="list-row static"><span class="lr-main"><b>${esc(p.ex.name)}</b><span class="muted">${new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${p.sets.map(s => `${E.fmtKg(s.w)}×${s.reps}`).join(', ')}</span></span></div>`).join('')}</section>` : ''}`;
}

function exerciseSheet(id) {
  const ex = EXERCISE[id];
  const h = E.history(S, id);
  const pts = h.filter(x => !x.deload).map(x => ({ t: new Date(x.date).getTime(), v: Math.round(E.exposureScore(S, ex, x.sets) * 10) / 10 }));
  const loaded = E.effLoad(S, ex, 0) > 0 || h.some(x => x.sets.some(s => +s.w > 0));
  const width = Math.min(innerWidth, 560) - 48;
  return `<div class="sheet-head"><div><p class="eyebrow">${esc(SLOTS[ex.slot].name)} · ${ex.loc === 'gym' ? 'Gym' : 'Home'}</p><h2>${esc(ex.name)}</h2></div><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    ${pts.length > 1 ? `<h3 class="sub">${loaded ? 'Estimated 1-rep max (kg)' : 'Best set (reps to failure)'}</h3>${lineChart(pts, { width, fmt: v => (loaded ? `${E.fmtKg(v)}` : `${Math.round(v)}`), label: 'Strength estimate over time' })}
      <p class="hint">${loaded ? 'Estimated from your best set each session (weight, reps and reps in reserve). It rises as you add reps or weight.' : 'Reps you could have done in your best set.'}</p>` : '<p class="muted">Log this exercise twice to see a trend.</p>'}
    <h3 class="sub">History</h3>
    <ul class="kv hist">${[...h].reverse().map(x => `<li><span>${new Date(x.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}${x.deload ? ' <span class="tag">deload</span>' : ''}${x.level ? ` <span class="tag accent">${esc(TECHNIQUE_LEVELS[x.level].name)}</span>` : ''}</span><span>${x.sets.map(s => `${E.fmtKg(s.w)}×${s.reps}`).join('  ')}</span></li>`).join('')}</ul>`;
}

function measureSheet() {
  const last = S.measurements[S.measurements.length - 1] || {};
  const f = (k, l, u) => `<label class="field"><span>${l} (${u})</span><input class="input" inputmode="decimal" data-measure="${k}" value="${esc(k === 'bodyweight' ? (last[k] ?? S.profile.bodyweight ?? '') : last[k] ?? '')}"></label>`;
  return `<div class="sheet-head"><h2>Log measurements</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    <p class="hint">Same time of day, relaxed, tape level. Shoulders: around the widest point of the delts. Waist: at the navel.</p>
    ${f('bodyweight', 'Bodyweight', 'kg')}${f('shoulders', 'Shoulders', 'cm')}${f('waist', 'Waist', 'cm')}${f('chest', 'Chest', 'cm')}${f('arm', 'Arm, flexed', 'cm')}
    <button class="btn primary big" data-act="save-measure">Save</button>`;
}

// ---------- plan ----------

function viewPlan() {
  const plan = E.buildPlan(S);
  const w = S.meso.week;
  const segs = Array.from({ length: E.ACC_WEEKS + 1 }, (_, k) => {
    const wk = k + 1, cls = wk < w ? 'past' : wk === w ? 'cur' : '';
    return `<span class="ms ${cls}">${wk > E.ACC_WEEKS ? 'D' : wk}</span>`;
  }).join('');
  const trimmedTotal = Object.values(plan.trimmed).reduce((a, b) => a + b, 0);
  return `<header class="top"><div><p class="eyebrow">${S.settings.daysPerWeek} days a week</p><h1>Plan</h1></div>${mesoPill()}</header>
    <section class="card">
      <div class="card-head"><h3>Mesocycle ${S.meso.number}</h3><span class="muted">${E.isDeload(S.meso) ? 'Deload week' : `Week ${w} of ${E.ACC_WEEKS}`}</span></div>
      <div class="meso">${segs}</div>
      <p class="effort">${effortLine()}</p>
      <p class="hint">Sets and effort rise each week, then a deload week clears fatigue. Your check-ins after each workout fine-tune the sets per muscle.</p>
      <div class="row wrap">
        ${E.isDeload(S.meso) ? '<button class="btn small ghost" data-act="new-meso">Start new mesocycle</button>' : '<button class="btn small ghost" data-act="deload-now">Deload now</button>'}
        <button class="btn small ghost" data-act="skip-week">Skip to next week</button>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h3>Days per week</h3></div>
      <div class="seg">${[2, 3, 4, 5, 6].map(n => `<button class="${S.settings.daysPerWeek === n ? 'on' : ''}" aria-pressed="${S.settings.daysPerWeek === n}" data-act="days" data-v="${n}">${n}</button>`).join('')}</div>
    </section>
    <div class="section-head"><h2>This week</h2>${seg('ui.planLoc', [['gym', 'Gym'], ['home', 'Home']], { small: true })}</div>
    ${plan.days.map(d => {
      const done = S.planWeek.done.includes(d.index);
      return `<section class="card day${done ? ' done' : ''}">
        <div class="card-head"><h3>${done ? icon('check', 18) : ''}${esc(d.name)}</h3><span class="muted">~${d.minutes} min · ${d.sets} sets</span></div>
        <ul class="slots">${d.slots.map(s => {
          const ex = E.pickExercise(S, d.index, s, ui.planLoc);
          return `<li><span><b>${ex ? esc(ex.name) : 'No option with your equipment'}</b><span class="muted">${esc(MUSCLE[s.muscle].name)}</span></span><span class="sets-n">${s.sets}×</span></li>`;
        }).join('')}</ul></section>`;
    }).join('')}
    ${trimmedTotal ? `<p class="hint">${icon('info', 14)} Your ${S.profile.sessionMinutes}-min time cap cut ${plural(trimmedTotal, 'set')} this week, lowest priority first. Add a day or longer sessions to get them back.</p>` : ''}
    <section class="card flush">
      <div class="card-head pad"><h3>Weekly targets</h3><button class="btn small ghost" data-act="priorities">Edit priorities</button></div>
      <div class="ttable">
        <div class="tt-row head"><span>Muscle</span><span>Target</span><span>Planned</span></div>
        ${[...MUSCLES].sort((a, b) => muscleOrder(a.id, b.id)).map(m => {
          const adj = S.meso.offsets[m.id] || 0;
          return `<div class="tt-row"><span>${esc(m.name)} <span class="tier-dot t-${tierOf(m.id)}" title="${TIERS[tierOf(m.id)].label}">${TIERS[tierOf(m.id)].label}</span></span>
          <span>${plan.targets[m.id] || '–'}${adj ? `<span class="adj">${adj > 0 ? '+' : ''}${E.fmtSets(adj)}</span>` : ''}</span><span>${E.fmtSets(plan.planned[m.id] || 0)}</span></div>`;
        }).join('')}
      </div>
    </section>
    <p class="hint">Planned counts every set: 1 for the main muscle, ½ for helpers. Small differences from the target are rounding.</p>`;
}

// ---------- settings ----------

function viewSettings() {
  const lastB = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('en-GB') : 'never';
  return `<header class="top"><div><p class="eyebrow">Physique</p><h1>Settings</h1></div></header>
    <section class="card">
      <h3>Training</h3>
      <h4 class="sub">Experience</h4>${seg('profile.experience', Object.entries(EXPERIENCE).map(([k, v]) => [k, v.label]), { small: true })}
      <h4 class="sub">Session length (min)</h4>${seg('profile.sessionMinutes', [[45, '45'], [60, '60'], [75, '75'], [90, '90']], { numeric: true })}
      <h4 class="sub">Where you train</h4>${seg('settings.location', [['ask', 'Ask each time'], ['gym', 'Always gym'], ['home', 'Always home']], { small: true })}
      <label class="field"><span>Bodyweight (kg)</span><input class="input" inputmode="decimal" data-bind="profile.bodyweight" value="${esc(S.profile.bodyweight ?? '')}" placeholder="optional"></label>
    </section>
    <section class="card">
      <h3>Home gym</h3>
      <div class="flush-in">${toggle('settings.home.bar', 'Pull-up bar')}${toggle('settings.home.chair', 'Sturdy chair or couch')}${toggle('settings.home.bench', 'Weight bench')}</div>
      <h4 class="sub">Kettlebells (kg)</h4>${weightPicker('settings.home.kb', KB_WEIGHTS)}
      <h4 class="sub">Dumbbells (kg)</h4>${weightPicker('settings.home.db', DB_WEIGHTS)}
    </section>
    <section class="card">
      <h3>Gym weight jumps (kg)</h3>
      <p class="hint">The smallest increase your gym allows for each type of equipment.</p>
      <div class="grid-inputs">${[['dumbbell', 'Dumbbells'], ['barbell', 'Barbell'], ['machine', 'Machines'], ['cable', 'Cables'], ['smith', 'Smith'], ['bodyweight', 'Added weight']].map(([k, l]) =>
        `<label class="field"><span>${l}</span><input class="input" inputmode="decimal" data-bind="settings.gymSteps.${k}" data-numeric="1" value="${esc(S.settings.gymSteps[k])}"></label>`).join('')}</div>
    </section>
    <section class="card flush">
      ${toggle('settings.sound', 'Beep when rest is over', 'Follows the iPhone silent switch')}
    </section>
    <section class="card">
      <h3>Your data</h3>
      <p class="hint">Everything is stored on this device only. Export a backup now and then, e.g. to iCloud Drive via the share sheet. Last backup: <b>${esc(lastB)}</b>.</p>
      <div class="row wrap"><button class="btn small primary" data-act="export">${icon('share', 16)} Export backup</button><button class="btn small ghost" data-act="import">Import backup</button></div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <button class="btn text danger" data-act="reset">Erase all data</button>
    </section>
    <section class="card">
      <h3>Why this works</h3>
      <ul class="science">${SCIENCE.map(s => `<li><b>${esc(s.title)}</b><span>${esc(s.text)}</span><span class="refs">${esc(s.refs)}</span></li>`).join('')}</ul>
      <p class="hint">No plan is perfect for everyone. These defaults are the starting point, and your logs and check-ins adjust them.</p>
    </section>
    ${!isStandalone() ? `<section class="card note">${icon('share', 20)}<div><b>Install on iPhone</b><p>Open this page in Safari, tap Share, then <b>Add to Home Screen</b>. Set it up after installing: the installed app keeps its own data.</p></div></section>` : ''}
    <p class="hint center">Physique v1</p>`;
}

// ---------- sheets ----------

function locationSheet(day) {
  const h = S.settings.home;
  const kit = [h.bar && 'pull-up bar', h.kb.length && `${h.kb.length} kettlebell${h.kb.length > 1 ? 's' : ''}`, h.db.length && `${h.db.length} dumbbell weight${h.db.length > 1 ? 's' : ''}`, h.bench && 'bench'].filter(Boolean).join(', ') || 'bodyweight only';
  return `<div class="sheet-head"><h2>Where are you training?</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    <div class="loc-choices">
      <button class="loc-choice" data-act="start-at" data-day="${day}" data-loc="gym">${icon('gym', 32)}<b>Gym</b><span>Machines, cables, free weights</span></button>
      <button class="loc-choice" data-act="start-at" data-day="${day}" data-loc="home">${icon('home', 32)}<b>Home</b><span>${esc(kit)}</span></button>
    </div>
    <p class="hint">Same muscles and sets either way. Only the exercises change.</p>`;
}

function pickDaySheet() {
  const plan = E.buildPlan(S);
  return `<div class="sheet-head"><h2>Pick a day</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    ${plan.days.map(d => `<button class="list-row" data-act="choose-day" data-day="${d.index}">
      <span class="lr-main"><b>${S.planWeek.done.includes(d.index) ? '✓ ' : ''}${esc(d.name)}</b><span class="muted">~${d.minutes} min · ${d.sets} sets</span></span>${icon('chevron', 16)}</button>`).join('')}`;
}

function swapSheet(i) {
  const e = S.active.exercises[i];
  const opts = E.slotOptions(S, e.slot, S.active.loc);
  return `<div class="sheet-head"><div><p class="eyebrow">${esc(SLOTS[e.slot].name)}</p><h2>Swap exercise</h2></div><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    ${opts.map(o => `<button class="list-row${o.id === e.exId ? ' sel' : ''}" data-act="swap-to" data-i="${i}" data-ex="${o.id}">
      <span class="lr-main"><b>${esc(o.name)}</b><span class="muted">${esc(o.cue)}</span></span>${o.id === e.exId ? icon('check', 18) : ''}</button>`).join('')}
    <p class="hint">Your choice sticks for this day of the plan, so progress keeps building on the same exercise.</p>
    <button class="btn text danger" data-act="remove-ex" data-i="${i}">Skip this exercise today</button>`;
}

function checkinSheet() {
  const a = S.active;
  const muscles = [...new Set(a.exercises.filter(e => e.sets.some(s => s.done)).map(e => e.muscle))].sort(muscleOrder);
  const fb = sheet.fb, pain = sheet.pain;
  return `<div class="sheet-head"><div><p class="eyebrow">10-second check-in</p><h2>How did each muscle feel?</h2></div></div>
    <p class="hint">${a.deload ? 'Deload week: answers are noted but sets won’t change.' : 'Your answers fine-tune the upcoming sets for each muscle. “Too much” includes still being sore from last time.'}</p>
    ${muscles.map(m => `<div class="ci-row"><div class="ci-top"><b>${esc(MUSCLE[m].name)}</b>
        <button class="pain${pain.has(m) ? ' on' : ''}" data-act="ci-pain" data-m="${m}" aria-pressed="${pain.has(m)}">Joint pain</button></div>
      <div class="seg small">${[['easy', 'Could do more'], ['right', 'Just right'], ['much', 'Too much']].map(([v, l]) =>
        `<button class="${(fb[m] || 'right') === v ? 'on' : ''}" aria-pressed="${(fb[m] || 'right') === v}" data-act="ci" data-m="${m}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('')}
    <button class="btn primary big" data-act="ci-save">Save workout</button>
    <button class="btn text" data-act="close-sheet">Back to workout</button>`;
}

function summarySheet() {
  const { session, prs, weekDone } = sheet;
  const sets = session.exercises.reduce((t, e) => t + e.sets.length, 0);
  const vol = E.volumeOf(session.exercises);
  const top = Object.entries(vol).filter(([, v]) => v >= 1).sort((a, b) => muscleOrder(a[0], b[0]));
  return `<div class="sheet-head"><div><p class="eyebrow">Workout saved</p><h2>${esc(session.dayName)} done</h2></div><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    <div class="stat-row"><div class="stat"><span class="stat-v">${session.durationMin}</span><span class="stat-l">minutes</span></div>
      <div class="stat"><span class="stat-v">${sets}</span><span class="stat-l">hard sets</span></div>
      <div class="stat"><span class="stat-v">${prs.length}</span><span class="stat-l">PRs</span></div></div>
    ${prs.length ? `<h3 class="sub">New personal records</h3><ul class="kv">${prs.map(p => `<li><span>${icon('up', 14)} ${esc(p.name)}</span><span>+${Math.round((p.now / p.best - 1) * 100)}%</span></li>`).join('')}</ul>` : ''}
    <h3 class="sub">Muscles hit</h3>${muscleChips(top)}
    ${weekDone ? `<p class="note-line">${icon('check', 16)} Week complete. ${E.isDeload(S.meso) ? 'Next up: deload week.' : S.meso.week === 1 ? `Mesocycle ${S.meso.number} starts now.` : `Week ${S.meso.week} starts now with a little more volume.`}</p>` : ''}
    <button class="btn primary big" data-act="close-sheet">Done</button>`;
}

function confirmSheet() {
  return `<div class="sheet-head"><h2>${esc(sheet.title)}</h2></div><p class="lead">${esc(sheet.text)}</p>
    <button class="btn ${sheet.danger ? 'danger-fill' : 'primary'} big" data-act="confirm-yes">${esc(sheet.yes)}</button>
    <button class="btn text" data-act="close-sheet">Cancel</button>`;
}

function prioritiesSheet() {
  return `<div class="sheet-head"><h2>Muscle priorities</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    <p class="hint">Priority: ${TIERS.priority.start}→${TIERS.priority.peak} sets/week · Grow: ${TIERS.grow.start}→${TIERS.grow.peak} · Maintain: ${TIERS.maintain.start}→${TIERS.maintain.peak} · Indirect: only what compounds give.</p>
    ${priorityEditor('priorities')}
    <button class="btn ghost big" data-act="reset-prio">Reset to Aesthetic baseline</button>`;
}

function renderSheet() {
  if (!sheet) { $sheet.innerHTML = ''; document.body.classList.remove('sheet-open'); return; }
  const scroller = $sheet.querySelector('.sheet');
  const keep = scroller && scroller.dataset.type === sheet.type ? scroller.scrollTop : 0;
  const body = {
    loc: () => locationSheet(sheet.day), pickDay: pickDaySheet, swap: () => swapSheet(sheet.i), checkin: checkinSheet,
    summary: summarySheet, confirm: confirmSheet, muscle: () => muscleSheet(sheet.m), exercise: () => exerciseSheet(sheet.ex),
    measure: measureSheet, priorities: prioritiesSheet,
  }[sheet.type]();
  $sheet.innerHTML = `<div class="sheet-backdrop" data-act="${sheet.type === 'checkin' ? '' : 'close-sheet'}"></div>
    <div class="sheet" role="dialog" aria-modal="true" data-type="${sheet.type}"><div class="grabber"></div>${body}</div>`;
  document.body.classList.add('sheet-open');
  const sc = $sheet.querySelector('.sheet');
  sc.scrollTop = keep;
  bindLineCharts($sheet);
}

// ---------- main render ----------

const TABS = [['today', 'Today'], ['muscles', 'Muscles'], ['progress', 'Progress'], ['plan', 'Plan'], ['settings', 'Settings']];

function render() {
  if (!S.onboarded) {
    $app.innerHTML = viewOnboarding();
    $tabs.hidden = true;
    renderSheet();
    return;
  }
  $tabs.hidden = false;
  $tabs.innerHTML = TABS.map(([k, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="go" data-tab="${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">${icon(k, 24)}<span>${l}</span></button>`).join('');
  const view = { today: viewToday, muscles: viewMuscles, progress: viewProgress, plan: viewPlan, settings: viewSettings }[ui.tab];
  $app.innerHTML = view();
  bindLineCharts($app);
  renderSheet();
  renderTimer();
}

// ---------- rest timer ----------

let audioCtx = null;
function unlockAudio() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { audioCtx = null; }
}
function beep() {
  if (!S.settings.sound || !audioCtx) return;
  const t = audioCtx.currentTime;
  [0, 0.22].forEach(d => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
    o.connect(g).connect(audioCtx.destination);
    o.start(t + d); o.stop(t + d + 0.2);
  });
  navigator.vibrate?.([120, 80, 120]);
}

function startTimer(sec) { timer = { end: Date.now() + sec * 1000, total: sec, beeped: false }; renderTimer(); }

// Built once and then only updated, so the buttons stay tappable while the clock ticks.
function renderTimer() {
  const show = timer && S.active && ui.tab === 'today' && !sheet;
  $timer.hidden = !show;
  if (!show) return;
  if (!$timer.firstElementChild) {
    $timer.innerHTML = `<div class="tm-bar"></div><span class="tm-label"></span><span class="tm-time"></span>
      <button data-act="timer-add" data-v="-15" aria-label="15 seconds less">−15</button><button data-act="timer-add" data-v="15" aria-label="15 seconds more">+15</button>
      <button data-act="timer-stop" aria-label="Stop timer">${icon('close', 18)}</button>`;
  }
  const left = Math.ceil((timer.end - Date.now()) / 1000);
  const over = left <= 0;
  const t = Math.abs(left);
  $timer.classList.toggle('over', over);
  $timer.querySelector('.tm-bar').style.width = `${over ? 100 : Math.max(0, (1 - left / timer.total) * 100)}%`;
  $timer.querySelector('.tm-label').textContent = over ? 'Rest done · go' : 'Rest';
  $timer.querySelector('.tm-time').textContent = `${over ? '+' : ''}${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

setInterval(() => {
  if (S.active) { const el = document.getElementById('elapsed'); if (el) el.textContent = elapsed(S.active); }
  if (!timer) return;
  if (Date.now() >= timer.end && !timer.beeped) { timer.beeped = true; beep(); }
  if (Date.now() - timer.end > 60000) timer = null;
  renderTimer();
}, 500);

// Keep the screen awake during a workout where supported.
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.active) keepAwake(true); });

// ---------- workout actions ----------

function startWorkout(day, loc) {
  const plan = E.buildPlan(S);
  S.active = E.createSession(S, plan, day, loc);
  ui.pickDay = null;
  ui.openCue = new Set();
  sheet = null;
  timer = null;
  keepAwake(true);
  commit();
  scrollTo(0, 0);
}

function finishWorkout() {
  const a = S.active;
  const session = {
    id: a.id, date: new Date().toISOString(), startedAt: a.startedAt,
    durationMin: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)),
    dayIndex: a.dayIndex, dayName: a.dayName, loc: a.loc, meso: a.meso, week: a.week, deload: a.deload, planWeek: a.planWeek,
    targets: E.weeklyTargets(S),
    exercises: a.exercises.map(e => ({
      exId: e.exId, slot: e.slot, muscle: e.muscle, level: e.level || 0, rir: e.rir,
      sets: e.sets.filter(s => s.done && num(s.reps) > 0).map(s => ({ w: num(s.w) || 0, reps: num(s.reps), rir: +s.rir })),
    })).filter(e => e.sets.length),
    feedback: { ...sheet.fb }, pain: [...sheet.pain],
  };
  const prs = E.sessionPRs(S, session);
  const trend = E.sessionTrend(S, session);
  S.sessions.push(session);
  S.fatigue = !session.deload && trend.dip ? (S.fatigue || 0) + 1 : 0;
  const fb = {};
  for (const e of session.exercises) fb[e.muscle] = sheet.fb[e.muscle] || 'right';
  E.applyFeedback(S, fb, [...sheet.pain]);
  const weekDone = a.dayIndex < E.daysPerWeek(S) ? E.completeDay(S, a.dayIndex) : false;
  S.active = null;
  timer = null;
  keepAwake(false);
  save();
  sheet = { type: 'summary', session, prs, weekDone };
  ui.tab = 'today';
  render();
  scrollTo(0, 0);
}

function switchLocation() {
  const a = S.active;
  const loc = a.loc === 'gym' ? 'home' : 'gym';
  for (let i = 0; i < a.exercises.length; i++) {
    const e = a.exercises[i];
    if (e.sets.some(s => s.done)) continue;
    const ex = E.pickExercise(S, a.dayIndex, { slot: e.slot, k: e.k }, loc);
    if (ex) a.exercises[i] = E.sessionExercise(S, ex, { slot: e.slot, muscle: e.muscle, k: e.k, sets: e.sets.length }, a.deload);
  }
  a.loc = loc;
  commit();
  toast(`Switched to ${loc === 'gym' ? 'gym' : 'home'} exercises`);
}

function confirmThen(title, text, yes, fn, danger = false) { sheet = { type: 'confirm', title, text, yes, fn, danger }; renderSheet(); }

// ---------- actions ----------

const A = {
  go(el) { ui.tab = el.dataset.tab; sheet = null; render(); scrollTo(0, 0); },
  set(el) {
    const path = el.dataset.path;
    const v = el.dataset.num ? +el.dataset.v : el.dataset.v;
    if (path.startsWith('ui.')) { ui[path.slice(3)] = v; render(); return; }
    const [root, p] = rootFor(path);
    setPath(root, p, v);
    if (!path.startsWith('ob.')) save();
    render();
  },
  flip(el) {
    const [root, p] = rootFor(el.dataset.path);
    setPath(root, p, !getPath(root, p));
    if (!el.dataset.path.startsWith('ob.')) save();
    render();
  },
  'toggle-weight'(el) {
    const [root, p] = rootFor(el.dataset.path);
    const list = getPath(root, p), w = +el.dataset.v;
    setPath(root, p, list.includes(w) ? list.filter(x => x !== w) : [...list, w].sort((a, b) => a - b));
    if (!el.dataset.path.startsWith('ob.')) save();
    render();
  },
  'add-weight'(el) {
    const input = document.querySelector(`[data-add-for="${el.dataset.path}"]`);
    const w = num(input?.value);
    if (!(w > 0 && w < 500)) { toast('Enter a weight in kg'); return; }
    const [root, p] = rootFor(el.dataset.path);
    const list = getPath(root, p);
    if (!list.includes(w)) setPath(root, p, [...list, w].sort((a, b) => a - b));
    if (!el.dataset.path.startsWith('ob.')) save();
    render();
  },
  'ob-next'() { ui.obStep = Math.min(OB_STEPS - 1, ui.obStep + 1); render(); scrollTo(0, 0); },
  'ob-back'() { ui.obStep = Math.max(0, ui.obStep - 1); render(); scrollTo(0, 0); },
  'ob-finish'() {
    const o = ui.ob;
    S.settings.daysPerWeek = o.daysPerWeek;
    S.profile.experience = o.experience;
    S.profile.sessionMinutes = o.sessionMinutes;
    S.profile.bodyweight = num(o.bodyweight) > 0 ? num(o.bodyweight) : null;
    S.settings.home = { ...o.home };
    S.priorities = { ...o.priorities };
    S.onboarded = true;
    S.meso = { number: 1, week: 1, offsets: {}, startedAt: Date.now() };
    S.planWeek = { index: 0, done: [] };
    store.requestPersistence();
    ui.tab = 'today';
    commit();
    scrollTo(0, 0);
  },
  start(el) {
    unlockAudio();
    const day = +el.dataset.day;
    if (S.settings.location === 'ask') { sheet = { type: 'loc', day }; renderSheet(); } else startWorkout(day, S.settings.location);
  },
  'start-at'(el) { unlockAudio(); startWorkout(+el.dataset.day, el.dataset.loc); },
  'pick-day'() { sheet = { type: 'pickDay' }; renderSheet(); },
  'choose-day'(el) { ui.pickDay = +el.dataset.day; sheet = null; render(); },
  tick(el) {
    unlockAudio();
    const e = S.active.exercises[+el.dataset.i], s = e.sets[+el.dataset.j];
    if (!s.done) {
      const ex = EXERCISE[e.exId];
      if (!(num(s.reps) > 0)) { toast('Enter your reps first'); return; }
      if (ex.equip !== 'bodyweight' && !(num(s.w) >= 0 && String(s.w).trim() !== '')) { toast('Enter the weight first'); return; }
      s.w = ex.equip === 'bodyweight' && String(s.w).trim() === '' ? 0 : num(s.w);
      s.reps = num(s.reps);
      s.done = true;
      startTimer(SLOTS[ex.slot].rest);
    } else {
      s.done = false;
    }
    commit();
  },
  rir(el) {
    const s = S.active.exercises[+el.dataset.i].sets[+el.dataset.j];
    s.rir = +el.dataset.v;
    save();
    el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
  },
  'add-set'(el) {
    const e = S.active.exercises[+el.dataset.i];
    const last = e.sets[e.sets.length - 1] || { w: '', reps: '', rir: e.rir };
    e.sets.push({ w: last.w, reps: last.reps, rir: e.rir, done: false });
    commit();
  },
  'del-set'(el) {
    const e = S.active.exercises[+el.dataset.i];
    if (e.sets.length <= 1) return;
    const k = e.sets.map(s => s.done).lastIndexOf(false);
    e.sets.splice(k >= 0 ? k : e.sets.length - 1, 1);
    commit();
  },
  cue(el) { const i = +el.dataset.i; ui.openCue.has(i) ? ui.openCue.delete(i) : ui.openCue.add(i); render(); },
  swap(el) {
    const e = S.active.exercises[+el.dataset.i];
    if (e.sets.some(s => s.done)) { toast('Sets already logged. Add a new exercise after this one instead.'); return; }
    sheet = { type: 'swap', i: +el.dataset.i };
    renderSheet();
  },
  'swap-to'(el) {
    const a = S.active, i = +el.dataset.i, e = a.exercises[i];
    const ex = EXERCISE[el.dataset.ex];
    a.exercises[i] = E.sessionExercise(S, ex, { slot: e.slot, muscle: e.muscle, k: e.k, sets: e.sets.length }, a.deload);
    S.exPrefs[E.prefKey(S, a.loc, a.dayIndex, e)] = ex.id;
    sheet = null;
    commit();
  },
  upgrade(el) {
    const a = S.active, i = +el.dataset.i, e = a.exercises[i];
    const ex = EXERCISE[e.target.upgrade];
    a.exercises[i] = E.sessionExercise(S, ex, { slot: e.slot, muscle: e.muscle, k: e.k, sets: e.sets.length }, a.deload);
    S.exPrefs[E.prefKey(S, a.loc, a.dayIndex, e)] = ex.id;
    commit();
    toast(`Switched to ${ex.name}`);
  },
  'remove-ex'(el) { S.active.exercises.splice(+el.dataset.i, 1); ui.openCue = new Set(); sheet = null; commit(); },
  'switch-loc'() {
    const to = S.active.loc === 'gym' ? 'home' : 'gym';
    confirmThen(`Switch to ${to}?`, 'Exercises you haven’t started get swapped for their ' + to + ' versions. Logged sets stay.', 'Switch', switchLocation);
  },
  finish() {
    if (!S.active.exercises.some(e => e.sets.some(s => s.done))) { toast('Log at least one set first'); return; }
    timer = null;
    sheet = { type: 'checkin', fb: {}, pain: new Set() };
    renderSheet(); renderTimer();
  },
  ci(el) { sheet.fb[el.dataset.m] = el.dataset.v; renderSheet(); },
  'ci-pain'(el) { const m = el.dataset.m; sheet.pain.has(m) ? sheet.pain.delete(m) : sheet.pain.add(m); renderSheet(); },
  'ci-save'() { finishWorkout(); },
  discard() {
    confirmThen('Discard this workout?', 'Logged sets from this session will be deleted.', 'Discard', () => {
      S.active = null; timer = null; keepAwake(false); commit();
    }, true);
  },
  'timer-add'(el) { if (timer) { timer.end += +el.dataset.v * 1000; timer.total = Math.max(timer.total, Math.ceil((timer.end - Date.now()) / 1000)); timer.beeped = Date.now() >= timer.end; renderTimer(); } },
  'timer-stop'() { timer = null; renderTimer(); },
  muscle(el) { ui.sel = el.dataset.m; sheet = { type: 'muscle', m: el.dataset.m }; render(); },
  exercise(el) { sheet = { type: 'exercise', ex: el.dataset.ex }; renderSheet(); },
  measure() { sheet = { type: 'measure' }; renderSheet(); },
  'save-measure'() {
    const entry = { date: new Date().toISOString() };
    let any = false;
    document.querySelectorAll('[data-measure]').forEach(inp => { const v = num(inp.value); if (v > 0) { entry[inp.dataset.measure] = v; any = true; } });
    if (!any) { toast('Enter at least one measurement'); return; }
    S.measurements.push(entry);
    if (entry.bodyweight) S.profile.bodyweight = entry.bodyweight;
    sheet = null;
    commit();
    toast('Measurements saved');
  },
  priorities() { sheet = { type: 'priorities' }; renderSheet(); },
  'reset-prio'() { S.priorities = { ...BASELINE_PRIORITIES }; commit(); toast('Back to the Aesthetic baseline'); },
  days(el) {
    const n = +el.dataset.v;
    if (n === S.settings.daysPerWeek) return;
    if (S.active) { toast('Finish or discard the current workout first'); return; }
    confirmThen(`Switch to ${n} days a week?`, 'The week restarts on day 1 of the new split. Your history, progress and mesocycle week stay.', 'Switch', () => {
      S.settings.daysPerWeek = n;
      S.planWeek.done = [];
      ui.pickDay = null;
      commit();
    });
  },
  'deload-now'() {
    confirmThen('Start a deload week?', 'Half the sets at the same weights, stopping about 4 reps short. A new mesocycle starts after it.', 'Start deload', () => {
      E.startDeload(S); commit();
    });
  },
  'dismiss-fatigue'() { S.fatigue = 0; commit(); },
  'skip-week'() {
    confirmThen('Skip to next week?', 'Days you haven’t done this week are skipped and the plan moves on to the next week.', 'Skip', () => {
      if (S.active) { toast('Finish or discard the current workout first'); return; }
      E.advanceWeek(S); ui.pickDay = null; commit();
    });
  },
  'new-meso'() {
    confirmThen('Start a new mesocycle?', 'Back to week 1 with fresh volume. Feedback adjustments carry over at half strength.', 'Start', () => {
      E.startMeso(S); S.planWeek = { index: S.planWeek.index + 1, done: [] }; commit();
    });
  },
  'confirm-yes'() { const fn = sheet.fn; sheet = null; fn(); render(); },
  'close-sheet'() {
    if (!sheet) return;
    if (sheet.type === 'muscle') ui.sel = null;
    sheet = null;
    render();
  },
  async export() {
    const text = store.exportJSON(S);
    const name = `physique-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([text], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Physique backup' });
      } else {
        const url = URL.createObjectURL(file);
        const link = Object.assign(document.createElement('a'), { href: url, download: name });
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      S.lastBackup = Date.now();
      commit();
      toast('Backup exported');
    } catch (e) {
      if (e.name !== 'AbortError') toast('Export failed: ' + e.message);
    }
  },
  import() { document.getElementById('import-file')?.click(); },
  reset() {
    confirmThen('Erase all data?', 'Every workout, measurement and setting on this device will be deleted. Export a backup first if you might want it back.', 'Erase everything', () => {
      localStorage.removeItem('physique.v1');
      S = store.defaultState();
      ui.ob = null; ui.obStep = 0; ui.tab = 'today';
      render();
    }, true);
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !el.dataset.act || el.disabled) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

// Body map taps (paths carry data-m).
document.addEventListener('click', e => {
  const p = e.target.closest('.bodymap [data-m]');
  if (!p) return;
  ui.sel = p.dataset.m;
  sheet = { type: 'muscle', m: p.dataset.m };
  render();
});

// Typing: update state without re-rendering so the keyboard stays open.
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.in && S.active) {
    const s = S.active.exercises[+t.dataset.i].sets[+t.dataset.j];
    s[t.dataset.in] = t.value.replace(',', '.');
    save();
  } else if (t.dataset.bind) {
    const [root, p] = rootFor(t.dataset.bind);
    const raw = t.value.replace(',', '.');
    setPath(root, p, t.dataset.numeric ? (num(raw) > 0 ? num(raw) : getPath(root, p)) : (p === 'profile.bodyweight' ? (num(raw) > 0 ? num(raw) : null) : raw));
    if (!t.dataset.bind.startsWith('ob.')) save();
  }
});

// A changed weight carries over to the following sets that haven't been logged yet.
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.in === 'w' && S.active) {
    const e2 = S.active.exercises[+t.dataset.i], j = +t.dataset.j;
    for (let k = j + 1; k < e2.sets.length; k++) {
      if (e2.sets[k].done) continue;
      e2.sets[k].w = t.value.replace(',', '.');
      const inp = document.querySelector(`[data-in="w"][data-i="${t.dataset.i}"][data-j="${k}"]`);
      if (inp) inp.value = e2.sets[k].w;
    }
    save();
  }
  if (t.id === 'import-file' && t.files?.[0]) {
    try {
      const imported = store.importJSON(await t.files[0].text());
      confirmThen('Replace all data with this backup?', `The backup has ${plural(imported.sessions.length, 'workout')}. Everything currently on this device will be replaced.`, 'Replace', () => {
        S = imported; S.lastBackup = Date.now(); commit(); toast('Backup restored');
      }, true);
    } catch (err) { toast(err.message || 'Could not read that file'); }
    t.value = '';
  }
});

// Select the whole number when tapping into a set field, so typing replaces it.
document.addEventListener('focusin', e => { if (e.target.matches?.('.set-row .input')) setTimeout(() => e.target.select(), 0); });

// ---------- service worker (offline + updates) ----------

if ('serviceWorker' in navigator && (location.protocol === 'https:' || new URLSearchParams(location.search).has('sw'))) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Update installed. It loads next time you open the app.');
      });
    });
  }).catch(() => { /* offline support unavailable */ });
}

if (S.active) keepAwake(true);
render();
