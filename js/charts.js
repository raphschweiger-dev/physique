// Small SVG charts: a single-series line chart with a tap/drag readout, and a weekly bar strip.

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function niceTicks(min, max, count = 3) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= step0) || step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

const shortDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// points: [{ t: ms, v: number }], one series. Returns markup; wire it up with bindLineCharts().
export function lineChart(points, { width = 320, height = 168, fmt = v => v, label = '' } = {}) {
  if (points.length < 2) return '';
  const pad = { l: 36, r: 14, t: 14, b: 24 };
  const vs = points.map(p => p.v);
  const ticks = niceTicks(Math.min(...vs), Math.max(...vs));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const X = t => pad.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (width - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - pad.t - pad.b);
  const pts = points.map(p => [X(p.t), Y(p.v)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)} ${Y(y0).toFixed(1)}L${pts[0][0].toFixed(1)} ${Y(y0).toFixed(1)}Z`;
  const last = pts[pts.length - 1];
  const endStyle = `left:${Math.min(last[0] + 6, width - 40).toFixed(0)}px;top:${Math.max(0, last[1] - 24).toFixed(0)}px`;
  const data = esc(JSON.stringify(points.map((p, i) => [pts[i][0], pts[i][1], shortDate(p.t), fmt(p.v)])));
  return `<div class="lc" data-points="${data}" style="width:${width}px">
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(label)}">
      ${ticks.map(v => `<line class="lc-grid" x1="${pad.l}" x2="${width - pad.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>
        <text class="lc-tick" x="${pad.l - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`).join('')}
      <text class="lc-tick" x="${pad.l}" y="${height - 6}">${esc(shortDate(t0))}</text>
      <text class="lc-tick" x="${width - pad.r}" y="${height - 6}" text-anchor="end">${esc(shortDate(t1))}</text>
      <path class="lc-area" d="${area}"/>
      <path class="lc-line" d="${line}"/>
      ${pts.map(p => `<circle class="lc-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4"/>`).join('')}
      <line class="lc-cross" x1="0" x2="0" y1="${pad.t}" y2="${height - pad.b}" visibility="hidden"/>
      <circle class="lc-hot" r="5" visibility="hidden"/>
      <rect class="lc-hit" x="0" y="0" width="${width}" height="${height}"/>
    </svg>
    <div class="lc-tip" hidden></div>
    <div class="lc-end" style="${endStyle}">${esc(fmt(points[points.length - 1].v))}</div>
  </div>`;
}

export function bindLineCharts(root) {
  root.querySelectorAll('.lc').forEach(el => {
    const pts = JSON.parse(el.dataset.points);
    const svg = el.querySelector('svg');
    const cross = el.querySelector('.lc-cross'), hot = el.querySelector('.lc-hot'), tip = el.querySelector('.lc-tip');
    const show = e => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
      let best = pts[0];
      for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
      cross.setAttribute('x1', best[0]); cross.setAttribute('x2', best[0]); cross.setAttribute('visibility', 'visible');
      hot.setAttribute('cx', best[0]); hot.setAttribute('cy', best[1]); hot.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(best[3])}</b><span>${esc(best[2])}</span>`;
      const left = best[0] * (r.width / svg.viewBox.baseVal.width);
      tip.style.left = `${Math.max(0, Math.min(left - 44, r.width - 96))}px`;
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); hot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) show(e); });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(hide, 1600); });
  });
}

// Weekly bars for one muscle with a target tick per week. weeks: [{ label, v, target }]
export function weekBars(weeks, { width = 300, height = 64 } = {}) {
  if (!weeks.length) return '';
  const max = Math.max(1, ...weeks.map(w => Math.max(w.v, w.target || 0))) * 1.1;
  const n = weeks.length, gap = 6;
  const bw = Math.min(24, (width - gap * (n - 1)) / n);
  const total = n * bw + (n - 1) * gap;
  const x0 = (width - total) / 2, base = height - 14;
  const Y = v => base - (v / max) * (base - 4);
  return `<svg class="wb" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Weekly sets">
    <line class="lc-grid" x1="0" x2="${width}" y1="${base}" y2="${base}"/>
    ${weeks.map((w, i) => {
      const x = x0 + i * (bw + gap), y = Y(w.v), h = Math.max(0, base - y);
      const r = Math.min(4, h, bw / 2);
      const bar = h > 0 ? `<path class="wb-bar${w.current ? ' cur' : ''}" d="M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${base}Z"><title>${esc(w.label)}: ${w.v} sets</title></path>` : '';
      const tick = w.target ? `<line class="wb-target" x1="${x - 2}" x2="${x + bw + 2}" y1="${Y(w.target)}" y2="${Y(w.target)}"/>` : '';
      return `${bar}${tick}<text class="lc-tick" x="${x + bw / 2}" y="${height - 2}" text-anchor="middle">${esc(w.label)}</text>`;
    }).join('')}
  </svg>`;
}
