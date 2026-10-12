import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function BuildingsPage() {
  const { buildings, rooms: allRooms, dbConnected } = useApp();
  const [selectedBuilding, setSelectedBuilding] = useState('Academic Block A');
  const [search, setSearch] = useState('');

  const totalKwh   = (buildings || []).reduce((a, b) => a + (b.sepKwh || 0), 0);
  const totalWaste = (buildings || []).reduce((a, b) => a + (b.wastage || 0), 0);
  const totalRooms = (buildings || []).reduce((a, b) => a + (b.rooms || 0), 0);
  const needAttn   = (allRooms || []).filter(r => r.assessment === 'High waste' || r.assessment === 'Review').length;

  const rooms = (allRooms || []).filter(r =>
    r.building === selectedBuilding &&
    (search === '' || r.id.toLowerCase().includes(search.toLowerCase()) || (r.issue || '').toLowerCase().includes(search.toLowerCase()))
  );

  const maxUsage = Math.max(...(buildings || []).map(b => b.baseKwh || 0), 1);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Buildings &amp; classrooms</h1>
          <p>Locate avoidable electricity use, from building totals to individual rooms.</p>
        </div>
        <button className="btn btn-outline"><Download size={15} /> Export room data</button>
      </div>

      <div className="filter-bar">
        <div className="filter-chip active">12 Oct 2026</div>
        <div className="filter-chip active">{selectedBuilding}</div>
        <div className="filter-chip active">All floors</div>
        <div className="filter-chip active">All room states</div>
        <span className="spacer" />
        <span className="text-sm text-muted">Daily room snapshot · 4:00 pm</span>
      </div>

      {dbConnected ? (
        <div className="synth-banner" style={{ background: '#d1fae5', color: '#166534', borderLeft: '3px solid #22c55e' }}>
          ✓ Connected to Supabase — Loaded real buildings, classrooms, and energy records from database.
        </div>
      ) : (
        <div className="synth-banner">⚠ SYNTHETIC demo data — occupancy and schedules are simulated, not sensor-confirmed.</div>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Building usage · October</div>
          <div className="kpi-value">{totalKwh.toLocaleString()} kWh</div>
          <div className="kpi-sub">Campus consumption</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated monthly wastage</div>
          <div className="kpi-value bad">{totalWaste.toLocaleString()} kWh</div>
          <div className="kpi-sub warn">Calculated from room telemetry</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Rooms monitored</div>
          <div className="kpi-value">{totalRooms} rooms</div>
          <div className="kpi-sub">Classrooms and seminar halls</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Rooms needing attention</div>
          <div className="kpi-value warn">{needAttn} of {(allRooms || []).length}</div>
          <div className="kpi-sub warn">{needAttn > 0 ? `${needAttn} flagged for review` : 'All normal'}</div>
        </div>
      </div>

      {/* Two col */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        {/* Building comparison */}
        <div className="card">
          <div className="card-header"><h2>Building usage comparison</h2><p>October vs September baseline (kWh)</p></div>
          <div className="card-body">
            {(buildings || []).map(b => (
              <div key={b.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: 3 }}>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: b.name === selectedBuilding ? 700 : 400, color: b.name === selectedBuilding ? '#2d6a4f' : '#111f1b' }}
                    onClick={() => setSelectedBuilding(b.name)}
                  >
                    {b.name}
                  </button>
                  <span style={{ color: '#6b7f79' }}>{b.baseKwh.toLocaleString()} → {b.sepKwh.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  <div style={{ height: 8, borderRadius: 4, background: '#dde8e4', flex: b.baseKwh }} />
                  <div style={{ height: 8, borderRadius: 4, background: '#2d6a4f', flex: b.sepKwh - b.baseKwh + 10000 }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted" style={{ marginTop: 8 }}>Click a building name to filter rooms below</p>
          </div>
        </div>

        {/* Wastage breakdown */}
        <div className="card">
          <div className="card-header"><h2>Where is energy being wasted?</h2><p>{selectedBuilding} · October estimated wastage</p></div>
          <div className="card-body">
            {[
              { label: 'Cooling in empty rooms', kwh: 756, pct: 60 },
              { label: 'Lights outside class hours', kwh: 378, pct: 30 },
              { label: 'Fans in unoccupied rooms', kwh: 126, pct: 10 },
            ].map(w => (
              <div key={w.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                <span style={{ fontSize: '.84rem' }}>{w.label}</span>
                <span style={{ color: '#b45309', fontWeight: 700, fontSize: '.84rem' }}>{w.kwh} kWh · {w.pct}%</span>
              </div>
            ))}
            <p className="text-xs text-muted" style={{ marginTop: 12 }}>Prioritise cooling checks before changing lighting schedules.</p>
          </div>
        </div>
      </div>

      {/* Room monitoring table */}
      <div className="card">
        <div className="card-header">
          <div><h2>Room-level monitoring</h2><p>{selectedBuilding} · selected daily usage · estimated wastage highlighted</p></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={15} style={{ color: '#6b7f79' }} />
            <input
              className="form-control" style={{ width: 160, padding: '6px 10px' }}
              placeholder="Search room…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Room</th><th>Usage today</th><th>Est. wastage</th><th>Occupancy / schedule</th><th>Waste indicator</th><th>Assessment</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(r => (
                <tr key={r.id}>
                  <td><span style={{ fontWeight: 600 }}>{r.id}</span><br /><span className="text-xs text-muted">{r.building}</span></td>
                  <td>{r.usageToday} kWh</td>
                  <td style={{ color: r.waste > 0 ? '#b45309' : '#6b7f79' }}>{r.waste > 0 ? r.waste + ' kWh' : '–'}</td>
                  <td className="text-sm">{r.occupancy}</td>
                  <td className="text-sm text-muted">{r.issue}</td>
                  <td>
                    <span className={`badge ${r.assessment === 'High waste' ? 'high' : r.assessment === 'Review' ? 'medium' : 'good'}`}>
                      {r.assessment}
                    </span>
                  </td>
                  <td><button className="btn btn-ghost btn-sm">{r.assessment === 'Normal' ? 'View room →' : 'Inspect →'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-xs text-muted">Showing {rooms.length} of {(allRooms || []).length} rooms · Sorted by room number</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm">Previous</button>
            <button className="btn btn-outline btn-sm">Page 1</button>
            <button className="btn btn-outline btn-sm">Next</button>
          </div>
        </div>
        <div style={{ padding: '14px 22px', background: '#f9fbfa', borderTop: '1px solid #eee', fontSize: '.8rem', color: '#6b7f79', display: 'flex', gap: 8 }}>
          <span style={{ color: '#2d6a4f' }}>ℹ</span>
          How wastage is estimated: Demo device load × time running outside the room schedule. Occupancy and schedules are simulated, not sensor-confirmed.
        </div>
      </div>
    </div>
  );
}
