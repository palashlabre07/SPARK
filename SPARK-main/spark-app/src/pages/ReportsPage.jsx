import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { BUILDINGS, RATE, EF } from '../data/seed';
import { useApp } from '../context/AppContext';

const fmt = n => Math.round(n).toLocaleString('en-IN');

const BASE_KWH = 30000;
const SEP_KWH  = 24600;
const DELTA    = BASE_KWH - SEP_KWH;

export function ReportsPage() {
  const { actions } = useApp();

  // Savings verification (Library example)
  const libAction = actions.find(a => a.zone === 'lib' && a.status === 'Resolved');
  const baselineAvg = libAction?.baselineAvg ?? 18;
  const postAvg     = libAction?.postAvg     ?? 4;
  const postDays    = 5;
  const savedKwh    = (baselineAvg - postAvg) * postDays;
  const reduction   = ((baselineAvg - postAvg) / baselineAvg * 100).toFixed(1);

  // Period comparison bar data
  const periodData = [
    { period: 'Aug baseline', kWh: BASE_KWH },
    { period: 'September',    kWh: SEP_KWH },
  ];

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Reports &amp; impact</h1>
          <p>Connect reduced electricity use to estimated savings and environmental impact.</p>
        </div>
        <button className="btn btn-outline"><Download size={15} /> Export report</button>
      </div>

      <div className="filter-bar">
        <div className="filter-chip active">01–30 Sep 2026</div>
        <div className="filter-chip active">Baseline: 01–31 Aug 2026</div>
        <div className="filter-chip active">All buildings</div>
        <span className="spacer" />
        <span className="text-sm text-muted">Monthly comparison · Demo data</span>
      </div>

      <div className="synth-banner">⚠ SYNTHETIC demo data — all figures are estimates, not verified savings.</div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Consumption reduction</div>
          <div className="kpi-value good">{fmt(DELTA)} kWh</div>
          <div className="kpi-sub good">{fmt(BASE_KWH)} → {fmt(SEP_KWH)} kWh · 18% less</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated cost savings</div>
          <div className="kpi-value good">₹{fmt(DELTA * RATE)}</div>
          <div className="kpi-sub">{fmt(DELTA)} kWh × ₹{RATE}/kWh</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated CO₂ avoided</div>
          <div className="kpi-value">{(DELTA * EF / 1000).toFixed(2)} t</div>
          <div className="kpi-sub">{fmt(DELTA)} kWh × {EF} kg CO₂/kWh</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Monthly reduction target</div>
          <div className="kpi-value good">18% / 15%</div>
          <div className="kpi-sub good">3 percentage points above target</div>
        </div>
      </div>

      {/* Period comparison + calculation */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        {/* Bar chart */}
        <div className="card">
          <div className="card-header"><h2>Period comparison</h2><p>Electricity consumption (kWh) · full calendar months</p></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={periodData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="period" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={v => [`${fmt(v)} kWh`]} />
                <Bar dataKey="kWh" fill="#2d6a4f" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <span className="badge good" style={{ fontSize: '.82rem', padding: '3px 12px' }}>18% reduction</span>
            </div>
          </div>
        </div>

        {/* Calculation */}
        <div className="card">
          <div className="card-header"><h2>From less usage to estimated savings</h2><p>A transparent calculation, not a verified claim</p></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.6rem', fontWeight: 800, color: '#2d6a4f' }}>{fmt(DELTA)}</div>
                <div className="text-xs text-muted">kWh reduced</div>
              </div>
              <div style={{ color: '#6b7f79', fontSize: '1.2rem' }}>×</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.6rem', fontWeight: 800 }}>₹{RATE}</div>
                <div className="text-xs text-muted">per kWh</div>
              </div>
              <div style={{ color: '#6b7f79', fontSize: '1.2rem' }}>=</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.6rem', fontWeight: 800, color: '#2d6a4f' }}>₹{fmt(DELTA * RATE)}</div>
                <div className="text-xs text-muted">est. savings</div>
              </div>
            </div>
            <p className="text-sm text-muted">Estimated energy cost fell from ₹{fmt(BASE_KWH * RATE)} in August to ₹{fmt(SEP_KWH * RATE)} in September.</p>
            <p className="text-xs text-muted" style={{ marginTop: 8 }}>Usage differences may reflect schedules and occupancy, not only waste-reduction actions.</p>
          </div>
        </div>
      </div>

      {/* Savings verification (Library worked example) */}
      {libAction && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h2>Savings verification · Library after-hours fix</h2>
            <span className="badge resolved">Verified</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 14 }}>
              {[
                { label: 'Baseline avg (per night)', value: `${baselineAvg} kWh`, note: 'Issue active period' },
                { label: 'Post-fix avg (per night)', value: `${postAvg} kWh`,     note: 'After resolution' },
                { label: 'Reduction',                value: `${reduction}%`,      note: 'vs baseline' },
                { label: 'Saved kWh',                value: `${savedKwh} kWh`,   note: `Over ${postDays} nights` },
              ].map(s => (
                <div key={s.label} style={{ background: '#f9fbfa', borderRadius: 8, padding: '12px 14px' }}>
                  <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: "'Bricolage Grotesque',sans-serif", color: '#2d6a4f' }}>{s.value}</div>
                  <div className="text-xs text-muted">{s.note}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: '.82rem', color: '#92400e' }}>
              <strong>Confidence: Medium</strong> — Meter-based comparison. Occupancy, timetable and weekday mix are not fully controlled.
              Monthly projection: ~{fmt(savedKwh * 6)} kWh · ₹{fmt(savedKwh * 6 * RATE)} (labelled projection only, not verified).
            </div>
          </div>
        </div>
      )}

      {/* Building-level impact table */}
      <div className="card">
        <div className="card-header"><h2>Building-level impact</h2><p>Contributions to the campus-wide reduction</p></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Building</th><th>Aug baseline</th><th>Sep usage</th><th>Reduction</th><th>Change</th><th>Est. cost saved</th><th>Est. CO₂ avoided</th></tr>
            </thead>
            <tbody>
              {BUILDINGS.map(b => {
                const delta = b.baseKwh - b.sepKwh;
                const pct   = ((delta / b.baseKwh) * 100).toFixed(1);
                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td>{b.baseKwh.toLocaleString()} kWh</td>
                    <td>{b.sepKwh.toLocaleString()} kWh</td>
                    <td>{delta.toLocaleString()} kWh</td>
                    <td><span className="badge good">↓ {pct}%</span></td>
                    <td>₹{fmt(delta * RATE)}</td>
                    <td>{Math.round(delta * EF).toLocaleString()} kg</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '2px solid #dde8e4', fontWeight: 700 }}>
                <td>Campus total</td><td colSpan={6} style={{ textAlign: 'right' }}>
                  {fmt(DELTA)} reduced · ₹{fmt(DELTA * RATE)} estimated savings · {Math.round(DELTA * EF).toLocaleString()} kg est. CO₂ avoided
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Assumptions */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid #eee', background: '#f9fbfa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: '.85rem' }}>Calculation assumptions</div>
            <span className="badge normal">Estimates only</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, fontSize: '.78rem', color: '#6b7f79' }}>
            <div><strong>Energy &amp; baseline:</strong> Flat monthly totals, Sep (30 days) vs Aug (31 days); not normalised for days, weather or occupancy.</div>
            <div><strong>Cost estimate:</strong> Flat tariff of ₹{RATE}/kWh. Excludes fixed charges, taxes and demand charges. Savings = usage difference × tariff.</div>
            <div><strong>Environmental estimate:</strong> Illustrative factor: {EF} kg CO₂/kWh. Not a verified local grid factor. No carbon credits or verified savings claimed.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
