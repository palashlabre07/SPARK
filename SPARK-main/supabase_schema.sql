-- ============================================================
-- SPARK — Supabase Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Campuses ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campuses (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  area        TEXT,
  multiplier  NUMERIC NOT NULL DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO campuses (id, name, area, multiplier) VALUES
  ('main',   'SPARK Campus',       'Academic blocks, library, admin',  1.0),
  ('eng',    'Engineering Block',  'Labs, workshops, computer centre', 1.35),
  ('hostel', 'Hostel Campus',      'Hostels, mess, common areas',      0.85)
ON CONFLICT (id) DO NOTHING;

-- ── Zones ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  base_kwh        NUMERIC NOT NULL DEFAULT 0,
  weekend_factor  NUMERIC NOT NULL DEFAULT 1.0,
  after_hours_kwh NUMERIC NOT NULL DEFAULT 0,
  no_after_hours  BOOLEAN DEFAULT FALSE,
  equipment_note  TEXT,
  has_event_flag  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO zones (id, name, base_kwh, weekend_factor, after_hours_kwh, no_after_hours, equipment_note, has_event_flag) VALUES
  ('lab',  'Computer Lab 2', 30, 0.40, 3,  FALSE, '40 PCs x 100 W x 8 h = 32 kWh', FALSE),
  ('lib',  'Library',        45, 0.70, 4,  FALSE, NULL,                              FALSE),
  ('host', 'Hostel A',       90, 1.05, 50, TRUE,  NULL,                              FALSE),
  ('can',  'Canteen',        35, 0.80, 6,  FALSE, NULL,                              FALSE),
  ('aud',  'Auditorium',     20, 0.50, 1,  FALSE, NULL,                              TRUE),
  ('pump', 'Water Pumps',    25, 1.00, 2,  FALSE, NULL,                              FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── Occupancy readings (from YOLO camera agent) ────────────────────────────────
CREATE TABLE IF NOT EXISTS occupancy_readings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id        TEXT REFERENCES zones(id),
  campus_id      TEXT REFERENCES campuses(id) DEFAULT 'main',
  ts             TIMESTAMPTZ NOT NULL,
  people         INTEGER NOT NULL CHECK (people >= 0),
  source         TEXT NOT NULL DEFAULT 'yolo',
  confidence     NUMERIC,
  is_after_hours BOOLEAN,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Occupancy alerts (YOLO empty-room warnings) ────────────────────────────────
CREATE TABLE IF NOT EXISTS occupancy_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id      TEXT REFERENCES zones(id),
  campus_id    TEXT REFERENCES campuses(id) DEFAULT 'main',
  alert_type   TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'High',
  people_count INTEGER NOT NULL DEFAULT 0,
  message      TEXT,
  frame_path   TEXT,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  ack_by       TEXT,
  ack_at       TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Waste reports ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waste_reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id     TEXT REFERENCES zones(id),
  campus_id   TEXT REFERENCES campuses(id) DEFAULT 'main',
  category    TEXT NOT NULL,
  description TEXT,
  age_days    INTEGER NOT NULL DEFAULT 0,
  verified    BOOLEAN DEFAULT FALSE,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO waste_reports (zone_id, campus_id, category, description, age_days, verified) VALUES
  ('lab', 'main', 'Computers left on', 'PCs still on at 10 PM',  2, TRUE),
  ('lab', 'main', 'Lights left on',    'Lab lights on overnight', 1, FALSE)
ON CONFLICT DO NOTHING;

-- ── Actions ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id      TEXT REFERENCES zones(id),
  rule_code    TEXT NOT NULL,
  title        TEXT NOT NULL,
  owner        TEXT,
  priority     TEXT NOT NULL DEFAULT 'Medium',
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'Open',
  note         TEXT,
  resolved_at  TIMESTAMPTZ,
  baseline_avg NUMERIC,
  post_avg     NUMERIC,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO actions (zone_id, rule_code, title, owner, priority, due_date, status, note, resolved_at, baseline_avg, post_avg) VALUES
  ('lib', 'R1', 'Add closing checklist and timer for reading-room lights',
   'Library In-charge', 'Medium', '2026-10-06', 'Resolved',
   'Timer fitted on reading-room lighting circuit. Closing checklist added.',
   '2026-10-07T00:00:00Z', 18, 4)
ON CONFLICT DO NOTHING;

-- ── Energy readings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS energy_readings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id         TEXT REFERENCES zones(id),
  campus_id       TEXT REFERENCES campuses(id) DEFAULT 'main',
  reading_date    DATE NOT NULL,
  total_kwh       NUMERIC NOT NULL DEFAULT 0,
  after_hours_kwh NUMERIC NOT NULL DEFAULT 0,
  source          TEXT NOT NULL DEFAULT 'synthetic',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(zone_id, campus_id, reading_date)
);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE campuses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones              ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_alerts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_readings    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_campuses"           ON campuses           FOR SELECT USING (true);
CREATE POLICY "public_read_zones"              ON zones              FOR SELECT USING (true);
CREATE POLICY "public_read_occupancy_readings" ON occupancy_readings FOR SELECT USING (true);
CREATE POLICY "public_read_occupancy_alerts"   ON occupancy_alerts   FOR SELECT USING (true);
CREATE POLICY "public_read_waste_reports"      ON waste_reports      FOR SELECT USING (true);
CREATE POLICY "public_read_actions"            ON actions            FOR SELECT USING (true);
CREATE POLICY "public_read_energy_readings"    ON energy_readings    FOR SELECT USING (true);

CREATE POLICY "anon_insert_occupancy"        ON occupancy_readings FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_alerts"           ON occupancy_alerts   FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_waste_reports"    ON waste_reports      FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_actions"          ON actions            FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_actions"          ON actions            FOR UPDATE USING (true);
CREATE POLICY "anon_update_waste_reports"    ON waste_reports      FOR UPDATE USING (true);
CREATE POLICY "anon_update_occupancy_alerts" ON occupancy_alerts   FOR UPDATE USING (true);
