import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { Download, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildEnergyData, BUILDINGS, RATE, EF, N } from '../data/seed';
import { analyse } from '../data/rules';

const fmt  = n => Math.round(n).toLocaleString('en-IN');
const fmtK = n => (n / 1000).toFixed(1) + 'k';

export function AdminOverview({ setPage }) {
  const { campus, actions, reports, occOverrides, dbConnected } = useApp();
  const zones = useMemo(() => buildEnergyData(campus), [campus]);
  const { alerts, expected } = useMemo(() => analyse(zones, occOverrides, reports), [zones, occOverrides, reports]);

  const totToday = zones.reduce((a, z) => a + z.tot[N - 1], 0);
  const estWaste = alerts.reduce((a, x) => a + x.kwh, 0);
  const openAct  = actions.filter(a => a.status !== 'Resolved').length;

  // Trend data (14 days)
  const trend = Array.from({ length: N }, (_, d) => ({
    day: `D${d + 1}`,
    kWh: Math.round(zones.reduce((a, z) => a + z.tot[d], 0)),
  }));

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Campus overview</h1>
          <p>Understand consumption, find avoidable use and focus your next action.</p>
        </div>
        <button className="btn btn-outline"><Download size={15} /> Export summary</button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-chip active">01–14 Oct 2026</div>
        <div className="filter-chip active">All buildings</div>
        <span className="spacer" />
        <span className="text-muted text-sm">Comparison: 01–14 Sep 2026</span>
      </div>

      {dbConnected ? (
        <div className="synth-banner" style={{ background: '#d1fae5', color: '#166534', borderLeft: '3px solid #22c55e' }}>
          ✓ Connected to Supabase — Using real database metrics and camera occupancy telemetry.
        </div>
      ) : (
        <div className="synth-banner">⚠ SYNTHETIC demo data — no real meter readings. All cost, savings and emissions figures are estimates.</div>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Energy consumed</div>
          <div className="kpi-value">{fmt(totToday)} kWh</div>
          <div className="kpi-sub good">↓ 18% vs Sep baseline</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated wastage</div>
          <div className="kpi-value bad">{fmt(estWaste)} kWh</div>
          <div className="kpi-sub warn">12% of total consumption</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated energy cost</div>
          <div className="kpi-value">₹{fmt(totToday * RATE)}</div>
          <div className="kpi-sub">At an assumed ₹{RATE}/kWh</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated savings</div>
          <div className="kpi-value good">₹{fmt(estWaste * RATE)}</div>
          <div className="kpi-sub good">{fmt(estWaste)} kWh below baseline</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        {/* Trend */}
        <div className="card">
          <div className="card-header">
            <div><h2>Energy usage trend</h2><p>October 2026 · daily consumption</p></div>
            <span className="badge normal">kWh / day</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip formatter={v => [`${fmt(v)} kWh`, 'Usage']} />
                <Line type="monotone" dataKey="kWh" stroke="#2d6a4f" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted" style={{ marginTop: 8 }}>Daily energy consumption (kWh) · simulated values</p>
          </div>
        </div>

        {/* Building comparison */}
        <div className="card">
          <div className="card-header">
            <div><h2>Building comparison</h2><p>Monthly total, including estimated wastage</p></div>
          </div>
          <div className="card-body">
            {BUILDINGS.map(b => (
              <div key={b.id} className="progress-row">
                <div className="progress-label">
                  <span style={{ fontSize: '.82rem' }}>{b.name}</span>
                  <span style={{ fontSize: '.82rem', color: '#6b7f79' }}>{fmt(b.sepKwh)} kWh</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill green" style={{ width: `${(b.sepKwh / 9000) * 85}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <h2>Prioritised waste alerts</h2>
            <p>{alerts.length} unresolved alerts · {alerts.filter(a => a.sev === 'High').length} high priority · recommended next actions</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setPage('alerts')}>
            View all alerts <ArrowRight size={13} />
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Issue / location</th>
                <th>Priority</th>
                <th>Est. waste / day</th>
                <th>Status</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 5).map((a, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{a.name}</div>
                    <div className="text-xs text-muted">{a.zone}</div>
                  </td>
                  <td><span className={`badge ${a.sev === 'High' ? 'high' : 'medium'}`}>{a.sev}</span></td>
                  <td>{a.kwh.toFixed(1)} kWh</td>
                  <td><span className="badge open">Open</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setPage('alerts')}>View alert →</button></td>
                </tr>
              ))}
              {alerts.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7f79', padding: '20px' }}>No active alerts</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: '#fff', border: '1px solid #dde8e4', borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Start with Academic Block A</div>
          <div className="text-sm text-muted">34% of campus consumption and 1,260 kWh estimated wastage this month. Review empty-room cooling first.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setPage('buildings')}>
          Inspect classrooms <ArrowRight size={14} />
        </button>
      </div>

      {/* Footer */}
      <p className="text-xs text-muted" style={{ marginTop: 20, textAlign: 'center' }}>
        Campus Energy · Demo snapshot: 12 Oct 2026 · Consumption is simulated; all cost, savings and emissions figures are estimates.
      </p>
    </div>
  );
}
