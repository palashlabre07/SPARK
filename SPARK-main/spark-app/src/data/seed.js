// ============================================================
// SPARK — Synthetic Seed Data (clearly labelled SYNTHETIC)
// All values are simulated. No real meter readings used.
// ============================================================

export const RATE = 8;           // ₹ per kWh  — ASSUMPTION
export const EF   = 0.82;        // kg CO₂/kWh — replace with current CEA value before demo
export const N    = 14;          // days of history
export const BASE = 10;          // baseline window (first 10 days)

export const campuses = [
  { id: 'main', name: 'SPARK Campus', area: 'Academic blocks, library, admin', m: 1.0 },
  { id: 'eng',  name: 'Engineering Block', area: 'Labs, workshops, computer centre', m: 1.35 },
  { id: 'hostel', name: 'Hostel Campus', area: 'Hostels, mess, common areas', m: 0.85 },
];

// zones: b=base kWh/day, w=weekend factor, a=after-hours kWh, noAH=hostel skip
export const ZONES = [
  { id: 'lab',  name: 'Computer Lab 2', b: 30, w: 0.4, a: 3,  eq: '40 PCs × 100 W × 8 h = 32 kWh' },
  { id: 'lib',  name: 'Library',        b: 45, w: 0.7, a: 4  },
  { id: 'host', name: 'Hostel A',       b: 90, w: 1.05, a: 50, noAH: true },
  { id: 'can',  name: 'Canteen',        b: 35, w: 0.8,  a: 6  },
  { id: 'aud',  name: 'Auditorium',     b: 20, w: 0.5,  a: 1,  ev: true },
  { id: 'pump', name: 'Water Pumps',    b: 25, w: 1.0,  a: 2  },
];

// Deterministic RNG (seeded)
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildEnergyData(campusIdx = 0) {
  const ro = rng(99 + campusIdx);
  const r  = rng(7  + campusIdx);
  const m  = campuses[campusIdx].m;
  const today = new Date();

  return ZONES.map(z => {
    const tot = [], ah = [], occ = [];
    for (let d = 0; d < N; d++) {
      const day  = new Date(today.getTime() - (N - 1 - d) * 86400000);
      const we   = [0, 6].includes(day.getDay());
      let T = z.b * (we ? z.w : 1) * m * (1 + (r() - 0.5) * 0.1);
      let A = z.a * m * (1 + (r() - 0.5) * 0.2);

      // Lab: after-hours spike last 3 nights, 0 people → R1 High
      if (z.id === 'lab' && d >= 11) { T += 28 * m; A += 28 * m; }
      // Library: earlier spike days 3-5 (for savings example)
      if (z.id === 'lib' && d >= 2 && d <= 5) { T += 15 * m; A += 15 * m; }
      // Water pumps: gradual 35% rise last 4 days → R2
      if (z.id === 'pump' && d >= 10) T *= 1.35;
      // Auditorium: 2.2× today + event flag → R2 suppressed
      if (z.id === 'aud' && d === N - 1) T *= 2.2;

      // Occupancy after hours
      let O = ro() > 0.85 ? 1 : 0;
      if (z.id === 'lab') O = 0;                      // confirmed empty → High alert
      if (z.id === 'lib' && d === N - 1) { T += 12; A += 12; O = 34; } // exam night

      occ.push(O); tot.push(T); ah.push(A);
    }
    return { ...z, tot, ah, occ };
  });
}

// ── Food waste seed data ──────────────────────────────────────
const MENU = [
  { id: 'rice',  name: 'Rice',       std: 0.25, cost: 40 },
  { id: 'dal',   name: 'Dal',        std: 0.15, cost: 60 },
  { id: 'sabzi', name: 'Sabzi',      std: 0.12, cost: 80 },
  { id: 'roti',  name: 'Roti',       std: 0.10, cost: 50 },
  { id: 'curd',  name: 'Curd',       std: 0.08, cost: 70 },
];

export { MENU };

const WC = ['Preparation scraps','Unserved cooked surplus','Plate returns','Spoiled / expired stock','Other'];
const WR = ['Overproduction','Low demand','Quality / taste','Excessive portion','Spoilage','Handling issue','Unknown'];
const WD = ['General disposal','Compost / biowaste','Approved donation','Other approved route','Unknown'];

export function buildFoodData() {
  const sessions = [];
  const wasteRecords = [];
  const today = new Date();

  // 7 days × 2 meals (lunch + dinner)
  for (let d = 6; d >= 0; d--) {
    const date = new Date(today.getTime() - d * 86400000);
    const dateStr = date.toISOString().split('T')[0];

    for (const meal of ['Lunch', 'Dinner']) {
      const expected = 280 + Math.round(Math.random() * 40);
      const actual   = Math.round(expected * (0.86 + Math.random() * 0.10));
      const isToday  = d === 0;
      const status   = isToday && meal === 'Lunch' ? 'Draft' : 'Closed';

      const items = MENU.map(m => {
        const planned  = Math.round(expected * m.std * 10) / 10;
        const prepared = Math.round(planned * (1.08 + Math.random() * 0.08) * 10) / 10;
        const served   = Math.round(prepared * (0.75 + Math.random() * 0.15) * 10) / 10;
        return { itemId: m.id, planned, prepared, served };
      });

      const sessionId = `SES-${dateStr}-${meal.slice(0,1)}`;
      sessions.push({ id: sessionId, date: dateStr, meal, expected, actual, status, items });

      if (status === 'Closed') {
        // Rice surplus → unserved (triggers suggestion)
        const riceItem = items.find(i => i.itemId === 'rice');
        const riceSurplus = Math.max(0, riceItem.prepared - riceItem.served);
        if (riceSurplus > 0) {
          wasteRecords.push({
            id: `WR-${sessionId}-rice`,
            sessionId,
            item: 'Rice',
            category: 'Unserved cooked surplus',
            reason: 'Overproduction',
            qty: d === 2 ? 0 : Math.round(riceSurplus * 0.7 * 10) / 10,
            disposition: d === 3 ? 'Approved donation' : 'Compost / biowaste',
            note: '',
          });
        }
        // Dal plate returns
        wasteRecords.push({
          id: `WR-${sessionId}-dal`,
          sessionId, item: 'Dal',
          category: 'Plate returns', reason: 'Excessive portion',
          qty: Math.round((0.8 + Math.random() * 0.6) * 10) / 10,
          disposition: 'General disposal', note: '',
        });
        // Sabzi scraps
        if (Math.random() > 0.4) {
          wasteRecords.push({
            id: `WR-${sessionId}-sabzi`,
            sessionId, item: 'Sabzi',
            category: 'Preparation scraps', reason: 'Handling issue',
            qty: Math.round((0.3 + Math.random() * 0.4) * 10) / 10,
            disposition: 'Compost / biowaste', note: '',
          });
        }
      }
    }
  }

  const stock = [
    { id: 'stk1', ingredient: 'Rice',    qty: 120, received: '2026-10-05', bestBefore: '2027-04-05', location: 'Store A' },
    { id: 'stk2', ingredient: 'Dal',     qty: 45,  received: '2026-09-28', bestBefore: '2026-10-14', location: 'Store A' },
    { id: 'stk3', ingredient: 'Cooking Oil', qty: 30, received: '2026-09-15', bestBefore: '2026-10-11', location: 'Store B' },
    { id: 'stk4', ingredient: 'Sabzi',   qty: 18,  received: '2026-10-10', bestBefore: '2026-10-15', location: 'Cold store' },
  ];

  return { sessions, wasteRecords, stock, menu: MENU };
}

// ── Saved actions seed ────────────────────────────────────────
export const SEED_ACTIONS = [
  {
    id: 1, zone: 'lib', rule: 'R1',
    title: 'Add closing checklist and timer for reading-room lights',
    owner: 'Library In-charge', pri: 'Medium', due: '2026-10-06',
    status: 'Resolved',
    note: 'Timer fitted on reading-room lighting circuit. Closing checklist added.',
    resolvedAt: '2026-10-07',
    baselineStart: '2026-10-03', baselineEnd: '2026-10-06',
    postStart: '2026-10-08', postEnd: '2026-10-12',
    baselineAvg: 18, postAvg: 4,
  },
];

export const SEED_REPORTS = [
  { id: 1, zone: 'lab', cat: 'Computers left on',           desc: 'PCs still on at 10 PM',    age: 2, verified: true  },
  { id: 2, zone: 'lab', cat: 'Lights left on',              desc: 'Lab lights on overnight',   age: 1, verified: false },
];

export const BUILDINGS = [
  { id: 'acaA', name: 'Academic Block A', baseKwh: 10000, sepKwh: 8400,  rooms: 24, wastage: 1260 },
  { id: 'acaB', name: 'Academic Block B', baseKwh: 7600,  sepKwh: 6200,  rooms: 18, wastage: 930  },
  { id: 'lib',  name: 'Library',          baseKwh: 5000,  sepKwh: 4200,  rooms: 6,  wastage: 630  },
  { id: 'labs', name: 'Labs',             baseKwh: 4400,  sepKwh: 3600,  rooms: 12, wastage: 540  },
  { id: 'adm',  name: 'Administration',   baseKwh: 3000,  sepKwh: 2200,  rooms: 8,  wastage: 330  },
];

export const ROOMS = [
  { id: 'A-204', building: 'Academic Block A', usageToday: 24.8, waste: 4.8, occupancy: 'Empty · 14:00–16:00', issue: 'AC left running',    assessment: 'High waste' },
  { id: 'A-206', building: 'Academic Block A', usageToday: 19.6, waste: 3.4, occupancy: 'Empty · 15:00–16:00', issue: 'Lights left on',     assessment: 'Review'    },
  { id: 'A-208', building: 'Academic Block A', usageToday: 14.0, waste: 0.0, occupancy: 'Occupied · until 16:00', issue: 'Within schedule', assessment: 'Normal'    },
  { id: 'A-210', building: 'Academic Block A', usageToday: 32.4, waste: 6.2, occupancy: 'Empty · 13:00–16:00', issue: 'AC + lights on',     assessment: 'High waste' },
  { id: 'A-212', building: 'Academic Block A', usageToday: 16.2, waste: 1.8, occupancy: 'Empty · 15:00–16:00', issue: 'Fans left running',  assessment: 'Review'    },
  { id: 'A-214', building: 'Academic Block A', usageToday: 18.6, waste: 0.0, occupancy: 'Occupied · until 16:00', issue: 'Within schedule', assessment: 'Normal'    },
];

export const FACULTY_ROOMS = [
  { id: 'A-204', building: 'Academic Block A', usage: 24.8, waste: 4.8, issue: 'AC on in empty room',   lastClass: '2:00 pm', owner: 'R. Patel · Facilities', status: 'Open'        },
  { id: 'A-206', building: 'Academic Block A', usage: 19.6, waste: 3.4, issue: 'Lights on after class', lastClass: '3:00 pm', owner: 'Dr. Priya Sharma',       status: 'In progress' },
  { id: 'A-208', building: 'Academic Block A', usage: 14.0, waste: 0.0, issue: 'Within schedule',       lastClass: 'until 4:00 pm', owner: 'Dr. Priya Sharma', status: 'Normal'      },
];

export const STUDENT_REPORTS = [
  { id: 'SR-0286', issue: 'Lights left on',       location: 'Academic B · B-102', submitted: '30 Sep, 11:20 am', status: 'Open',       update: 'Received · awaiting facilities assignment' },
  { id: 'SR-0279', issue: 'Fans in empty room',   location: 'Academic A · A-212', submitted: '29 Sep, 3:40 pm',  status: 'In progress', update: 'M. Joshi is checking the room schedule'    },
  { id: 'SR-0258', issue: 'AC running after class',location: 'Academic B · B-108', submitted: '25 Sep, 4:05 pm', status: 'Resolved',   update: 'Cooling switched off · reviewed 26 Sep'    },
  { id: 'SR-0231', issue: 'Corridor lights on',   location: 'Library · First floor', submitted: '21 Sep, 1:30 pm', status: 'Resolved', update: 'Lighting schedule adjusted · 22 Sep'       },
];
