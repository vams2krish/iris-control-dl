export type Point = { x: number; y: number };
export type Sample = { features: number[]; target: Point };
export type Profile = { x: number[]; y: number[] };
export const targets: Point[] = [.15, .5, .85].flatMap(y => [.15, .5, .85].map(x => ({ x, y })));
export function fit(samples: Sample[]): Profile {
  if (samples.length < 9 || samples.some(s => s.features.length !== 4 || s.features.some(v => !Number.isFinite(v)))) throw new Error("Not enough reliable samples");
  if ([0, 1].some(axis => Math.max(...samples.map(s => s.features[axis])) - Math.min(...samples.map(s => s.features[axis])) <= .02)) throw new Error("Eye movement was too small. Retry calibration with a clear, stable view.");
  function solve(axis: "x" | "y") {
    const n = 5, a = Array.from({ length: n }, () => Array(n + 1).fill(0) as number[]);
    for (const s of samples) { const f = [1, ...s.features]; for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) a[i][j] += f[i] * f[j]; a[i][n] += f[i] * s.target[axis]; } }
    for (let i = 1; i < n; i++) a[i][i] += .001;
    for (let i = 0; i < n; i++) {
      let pivot = i; for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k;
      [a[i], a[pivot]] = [a[pivot], a[i]];
      if (Math.abs(a[i][i]) < 1e-10) throw new Error("Calibration failed. Try better lighting.");
      const d = a[i][i]; for (let j = i; j <= n; j++) a[i][j] /= d;
      for (let k = 0; k < n; k++) if (k !== i) { const s = a[k][i]; for (let j = i; j <= n; j++) a[k][j] -= s * a[i][j]; }
    }
    return a.map(row => row[n]);
  }
  return { x: solve("x"), y: solve("y") };
}
export function map(profile: Profile, features: number[]): Point {
  const f = [1, ...features]; const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return { x: clamp(profile.x.reduce((s, v, i) => s + v * f[i], 0)), y: clamp(profile.y.reduce((s, v, i) => s + v * f[i], 0)) };
}
export function readFace(p: { x: number; y: number }[]) {
  if (p.length < 478) return null;
  const dist = (a: number, b: number) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y);
  const eye = (a: number, b: number, t: number, d: number, i: number) => [(p[i].x - p[a].x) / Math.max(.001, p[b].x - p[a].x), (p[i].y - p[t].y) / Math.max(.001, p[d].y - p[t].y)];
  const l = eye(33, 133, 159, 145, 468), r = eye(362, 263, 386, 374, 473);
  const w = Math.max(.001, dist(234, 454));
  const hx = (p[1].x - (p[234].x + p[454].x) / 2) / w;
  const hy = (p[1].y - (p[10].y + p[152].y) / 2) / Math.max(.001, dist(10, 152));
  const inside = [33, 263, 10, 152].every(i => p[i].x > .02 && p[i].x < .98 && p[i].y > .02 && p[i].y < .98);
  return { features: [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, hx, hy], closed: (dist(159, 145) / Math.max(.001, dist(33, 133)) + dist(386, 374) / Math.max(.001, dist(362, 263))) / 2 < .17, confidence: inside && w > .16 && Math.abs(hx) < .25 ? .9 : .35 };
}
export function validProfile(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  return ["x", "y"].every(k => { const a = (value as Record<string, unknown>)[k]; return Array.isArray(a) && a.length === 5 && a.every(v => typeof v === "number" && Number.isFinite(v)); });
}
