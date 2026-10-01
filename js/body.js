// Front/back body map. Shapes are drawn for the figure's left half and mirrored; each tracked
// muscle carries data-m so a tap opens its details.

const W = 200;
const f = p => `${+p[0].toFixed(1)},${+p[1].toFixed(1)}`;
const mirror = pts => pts.map(([x, y]) => [W - x, y]).reverse();

// Closed Catmull-Rom spline through the points.
function smooth(pts) {
  const n = pts.length;
  const P = i => pts[(i + n) % n];
  let d = `M${f(P(0))}`;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return d + 'Z';
}

const ellipse = (cx, cy, rx, ry, n = 16) =>
  Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)]);

const head = ellipse(100, 30, 15, 19);
const neck = [[92, 44], [108, 44], [111, 58], [100, 60], [89, 58]];
const sideDelt = [[70, 61], [62, 64], [55, 72], [51, 84], [53, 96], [60, 104], [62, 90], [64, 76]];
const frontDelt = [[70, 61], [77, 63], [81, 72], [78, 86], [70, 98], [60, 104], [62, 90], [64, 76]];
const forearm = [[54, 144], [64, 143], [68, 153], [64, 173], [58, 193], [51, 193], [48, 175], [50, 156]];
const hand = [[50, 197], [58, 197], [60, 208], [56, 220], [49, 219], [46, 207]];
const upperArm = [[57, 106], [66, 105], [70, 112], [70, 126], [66, 139], [59, 141], [54, 131], [54, 115]];
const foot = [[79, 373], [91, 373], [94, 383], [90, 391], [77, 391], [76, 382]];

const FRONT = [
  { pts: head, center: true },
  { pts: neck, center: true },
  { m: 'upper_back', pts: [[91, 49], [84, 55], [72, 61], [79, 64], [91, 60]] },
  { m: 'delts_side', pts: sideDelt },
  { m: 'delts_front', pts: frontDelt },
  { m: 'chest_upper', pts: [[81, 64], [99, 63], [99, 80], [90, 82], [82, 79], [80, 71]] },
  { m: 'chest', pts: [[82, 81], [90, 84], [99, 82], [99, 101], [92, 107], [83, 105], [78, 97], [78, 88]] },
  { m: 'biceps', pts: upperArm },
  { m: 'forearms', pts: forearm },
  { pts: hand },
  { m: 'abs', pts: [[89, 111], [111, 111], [113, 133], [112, 161], [107, 181], [100, 185], [93, 181], [88, 161], [87, 133]], center: true, abs: true },
  { m: 'abs', pts: [[78, 108], [86, 111], [86, 137], [87, 165], [83, 173], [79, 157], [77, 133], [76, 115]] },
  { m: 'quads', pts: [[79, 193], [89, 194], [97, 201], [98, 225], [96, 255], [92, 279], [84, 283], [78, 273], [75, 247], [75, 215]],
    grooves: [[[84, 203], [86, 240], [90, 274]]] },
  { pts: ellipse(86, 291, 8, 7) },
  { m: 'calves', pts: [[78, 301], [91, 301], [94, 317], [92, 343], [88, 365], [82, 367], [77, 349], [75, 321]] },
  { pts: foot },
];

const BACK = [
  { pts: head, center: true },
  { pts: neck, center: true },
  { m: 'upper_back', pts: [[100, 45], [108, 48], [118, 55], [127, 61], [121, 71], [115, 87], [108, 106], [100, 118], [92, 106], [85, 87], [79, 71], [73, 61], [82, 55], [92, 48]], center: true,
    grooves: [[[100, 52], [100, 85], [100, 114]]] },
  { m: 'delts_side', pts: sideDelt },
  { m: 'delts_rear', pts: frontDelt },
  { m: 'lats', pts: [[77, 83], [84, 88], [91, 104], [96, 124], [95, 144], [89, 160], [82, 164], [77, 150], [73, 126], [72, 104], [73, 91]] },
  { pts: [[93, 121], [100, 125], [107, 121], [111, 147], [113, 171], [100, 177], [87, 171], [89, 147]], center: true },
  { m: 'triceps', pts: upperArm },
  { m: 'forearms', pts: forearm },
  { pts: hand },
  { m: 'glutes', pts: [[80, 173], [90, 175], [99, 181], [99, 201], [95, 217], [85, 219], [78, 209], [76, 191]] },
  { m: 'hamstrings', pts: [[77, 223], [89, 223], [97, 229], [97, 251], [94, 273], [88, 283], [81, 281], [77, 263], [75, 241]],
    grooves: [[[87, 228], [86, 252], [86, 276]]] },
  { pts: ellipse(86, 291, 7, 6) },
  { m: 'calves', pts: [[77, 299], [91, 299], [95, 313], [93, 331], [88, 351], [82, 353], [76, 337], [74, 315]],
    grooves: [[[85, 303], [85, 318], [85, 334]]] },
  { pts: [[80, 354], [88, 354], [89, 369], [81, 369]] },
  { pts: foot },
];

// Heat classes: 0 = no sets yet, 1–4 = quarters of the weekly target, 5 = target reached.
export function heatLevel(done, target) {
  if (!target) return 'none';
  if (!done) return 0;
  const r = done / target;
  return r >= 1 ? 5 : r >= 0.75 ? 4 : r >= 0.5 ? 3 : r >= 0.25 ? 2 : 1;
}

function figure(shapes, levels, selected, dx) {
  let out = `<g transform="translate(${dx} 0)">`;
  for (const s of shapes) {
    const parts = s.center ? [s.pts] : [s.pts, mirror(s.pts)];
    for (const pts of parts) {
      if (!s.m) { out += `<path class="bm-base" d="${smooth(pts)}"/>`; continue; }
      const lv = levels[s.m];
      const cls = `bm-m bm-l${lv}${selected === s.m ? ' bm-sel' : ''}`;
      out += `<path class="${cls}" data-m="${s.m}" d="${smooth(pts)}"/>`;
    }
    if (s.abs) {
      // six-pack grooves
      out += `<path class="bm-groove" d="M100 113V182M89 134H111M88.5 153H111.5M89.5 170H110.5"/>`;
    }
    for (const g of s.grooves || []) {
      for (const pts of s.center ? [g] : [g, g.map(([x, y]) => [W - x, y])]) {
        out += `<path class="bm-groove" d="M${f(pts[0])}Q${f(pts[1])} ${f(pts[2])}"/>`;
      }
    }
  }
  return out + '</g>';
}

export function bodyMap(levels, selected) {
  return `<svg class="bodymap" viewBox="0 0 412 396" role="img" aria-label="Muscle map, front and back">
    ${figure(FRONT, levels, selected, 0)}
    ${figure(BACK, levels, selected, 212)}
  </svg>`;
}
