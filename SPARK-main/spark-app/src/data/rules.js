// Detection rules R1–R4 (all transparent, all unit-testable)
import { BASE, N } from './seed';

const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const med = a => {
  const s = [...a].sort((x, y) => x - y), k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};
const sdFn = a => { const m = avg(a); return Math.sqrt(avg(a.map(x => (x - m) ** 2))); };

export { avg, med, sdFn };

/**
 * R1 After-hours use
 * Fires if ah_today > max(2 × median_ah, median_ah + 3)
 * people == 0  → High alert
 * people 1-2   → Medium alert
 * people >= 3  → R4 (expected, no alert)
 */
export function ruleR1(zone, occOverride) {
  if (zone.noAH) return null;
  const ah    = zone.ah;
  const ahToday = ah[N - 1];
  const medAH   = med(ah.slice(0, BASE));
  const threshold = Math.max(2 * medAH, medAH + 3);
  if (ahToday <= threshold) return null;

  const people = occOverride != null ? occOverride : zone.occ[N - 1];
  const kwh    = ahToday - medAH;
  const base   = {
    zone: zone.id, rule: people >= 3 ? 'R4' : 'R1',
    name: people >= 3 ? 'After-hours use with people present' : 'After-hours consumption',
    sev:  people >= 3 ? 'Info' : people === 0 ? 'High' : 'Medium',
    kwh, people, medAH, ahToday,
    why: `After-hours use was ${ahToday.toFixed(1)} kWh against a typical ${medAH.toFixed(1)} kWh (median of first ${BASE} days). Threshold: > 2× median and 3 kWh above it.${zone.eq ? ' Equipment check: ' + zone.eq + '.' : ''} Camera (YOLO person count): ${people} ${people === 1 ? 'person' : 'people'} after hours.`,
    fp: 'Cameras can miss people who are out of view. Verify before acting.',
  };
  if (people >= 3) {
    return { ...base, why: `Camera shows ~${people} people in the after-hours window, so this high use is likely legitimate (e.g. exam preparation). No alert raised. ${base.why}` };
  }
  if (people === 0) return { ...base, why: 'Camera confirms the zone was empty. ' + base.why };
  return base;
}

/**
 * R2 Above baseline
 * Fires if today > mean + 2.5 × sd AND today > 1.15 × mean
 * Suppressed if zone has event flag
 */
export function ruleR2(zone) {
  const b   = zone.tot.slice(0, BASE);
  const mu  = avg(b);
  const sd  = sdFn(b);
  const T   = zone.tot[N - 1];
  if (T <= mu + 2.5 * sd || T <= 1.15 * mu) return null;
  const kwh = T - mu;
  const result = {
    zone: zone.id, rule: 'R2',
    name: 'Above baseline',
    sev: zone.ev ? 'Info' : 'Medium',
    kwh, mu, sd, T,
    why: `Daily use was ${T.toFixed(0)} kWh against a baseline of ${mu.toFixed(0)} ± ${sd.toFixed(1)} kWh. Flagged: > 2.5 SD and 15% above baseline.`,
    fp: 'Could be weather, an event or higher occupancy. A steady rise on pumps can mean a fault.',
    suppressed: !!zone.ev,
  };
  return result;
}

/**
 * R3 Repeated reports
 * Fires if ≥ 3 unmerged reports in the last 7 days for the zone
 */
export function ruleR3(zoneId, reports) {
  const recent = reports.filter(r => r.zone === zoneId && r.age < 7);
  if (recent.length < 3) return null;
  return {
    zone: zoneId, rule: 'R3',
    name: 'Repeated waste reports',
    sev: 'Medium', kwh: 0,
    why: `${recent.length} separate waste reports in the last 7 days.`,
    fp: 'Reports are unverified until staff confirm them.',
  };
}

/** Run all rules, return { alerts, expected } */
export function analyse(zones, occOverrides = {}, reports = []) {
  const alerts = [], expected = [];

  zones.forEach(z => {
    const r1 = ruleR1(z, occOverrides[z.id] ?? null);
    if (r1) {
      r1.rule === 'R4' ? expected.push(r1) : alerts.push(r1);
    }
    const r2 = ruleR2(z);
    if (r2) {
      r2.suppressed ? expected.push(r2) : alerts.push(r2);
    }
    const r3 = ruleR3(z.id, reports);
    if (r3) alerts.push(r3);
  });

  return { alerts, expected };
}

/** Savings verification */
export function verifySavings(baselineAvg, postAvg, postDays) {
  const reduction = ((baselineAvg - postAvg) / baselineAvg) * 100;
  const savedKwh  = (baselineAvg - postAvg) * postDays;
  const confidence = postDays >= 7 ? 'High' : postDays >= 3 ? 'Medium' : 'Low';
  return { reduction, savedKwh, confidence };
}

// ── Unit-test friendly exports ──────────────────────────────
export const _test = {
  ruleR1, ruleR2, ruleR3, verifySavings,
  // R1 fires for after-hours 31 vs median 3, people 0 → High
  // R1 → Medium for people 1-2, R4 (no alert) for >= 3
  // Savings: baseline 18, post 4, 7 days → 77.8%, 98 kWh
};
