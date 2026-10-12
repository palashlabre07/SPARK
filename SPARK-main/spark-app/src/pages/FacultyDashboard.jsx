import React, { useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FACULTY_ROOMS, RATE } from '../data/seed';

export function FacultyDashboard({ setPage }) {
  const { addReport, rooms, dbConnected } = useApp();
  const [building, setBuilding] = useState('Academic Block A');
  const [room, setRoom]         = useState('A-204');
  const [issueType, setIssueType] = useState('Lights left on');
  const [details, setDetails]   = useState('');
  const [submitted, setSubmitted] = useState(false);

  const facultyRooms = dbConnected && rooms && rooms.length > 0
    ? rooms.slice(0, 3).map(r => ({
        id: r.id,
        building: r.building,
        usage: r.usageToday || 0,
        waste: r.waste || 0,
        issue: r.issue || 'Within schedule',
        lastClass: r.lastClass || '3:00 pm',
        owner: r.owner || 'Dr. Priya Sharma',
        status: r.status || 'Normal'
      }))
    : FACULTY_ROOMS;

  const totUsage = facultyRooms.reduce((a, r) => a + r.usage, 0);
  const totWaste = facultyRooms.reduce((a, r) => a + r.waste, 0);
  const issues   = facultyRooms.filter(r => r.status !== 'Normal').length;

  function handleSubmit(e) {
    e.preventDefault();
    addReport(room.toLowerCase().replace('-',''), issueType, details);
    setSubmitted(true);
    setDetails('');
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>My classroom dashboard</h1>
          <p>Good afternoon, Dr. Sharma. Two assigned classrooms need a quick check.</p>
        </div>
        <button className="btn btn-primary" onClick={() => document.getElementById('report-form').scrollIntoView({ behavior: 'smooth' })}>
          <Plus size={15} /> Report wastage
        </button>
      </div>

      <div className="filter-bar">
        <div className="filter-chip active">Today · 12 Oct 2026</div>
        <div className="filter-chip active">Academic Block A</div>
        <div className="filter-chip active">My assigned rooms</div>
        <span className="spacer" />
        <span className="text-sm text-muted">Teaching day snapshot · 4:00 pm</span>
      </div>

      <div className="synth-banner">⚠ SYNTHETIC demo data — energy and occupancy shown here are simulated.</div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">My assigned classrooms</div>
          <div className="kpi-value">3</div>
          <div className="kpi-sub">A-204 · A-206 · A-208</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Daily consumption</div>
          <div className="kpi-value">{totUsage.toFixed(1)} kWh</div>
          <div className="kpi-sub good">↓ 8.8% vs yesterday (64.0 kWh)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated wastage today</div>
          <div className="kpi-value bad">{totWaste.toFixed(1)} kWh</div>
          <div className="kpi-sub warn">₹{Math.round(totWaste * RATE).toLocaleString()} estimated avoidable cost</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Room issues to act on</div>
          <div className="kpi-value">{issues}</div>
          <div className="kpi-sub">1 open · 1 in progress</div>
        </div>
      </div>

      {/* Assigned classrooms table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h2>Assigned classrooms</h2><p>Check unoccupied rooms first. Energy and occupancy shown here are simulated.</p></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Classroom</th><th>Usage today</th><th>Est. waste</th><th>Current issue</th><th>Owner</th><th>Status</th><th>Next action</th></tr>
            </thead>
            <tbody>
              {facultyRooms.map(r => (
                <tr key={r.id}>
                  <td><span style={{ fontWeight: 600 }}>{r.id}</span><br /><span className="text-xs text-muted">{r.building}</span></td>
                  <td>{r.usage} kWh</td>
                  <td style={{ color: r.waste > 0 ? '#b45309' : '#6b7f79' }}>{r.waste > 0 ? r.waste + ' kWh' : '—'}</td>
                  <td className="text-sm">
                    {r.issue}<br />
                    <span className="text-xs text-muted">Last class ended {r.lastClass}</span>
                  </td>
                  <td className="text-sm">{r.owner}</td>
                  <td><span className={`badge ${r.status === 'Normal' ? 'good' : r.status === 'In progress' ? 'progress' : 'open'}`}>{r.status}</span></td>
                  <td><button className="btn btn-ghost btn-sm">{r.status === 'Open' ? 'Request room check →' : r.status === 'In progress' ? 'Add update →' : 'View usage →'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two col: report form + room usage */}
      <div className="two-col">
        {/* Report form */}
        <div className="card" id="report-form">
          <div className="card-header"><h2>Report energy wastage</h2><p>Add a clear location and details so the team can act.</p></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Building</label>
                  <select className="form-control" value={building} onChange={e => setBuilding(e.target.value)}>
                    <option>Academic Block A</option><option>Academic Block B</option><option>Library</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Room / location</label>
                  <select className="form-control" value={room} onChange={e => setRoom(e.target.value)}>
                    {['A-204','A-206','A-208','A-210','A-212'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">What did you notice?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Lights left on','AC / fan running','Other'].map(opt => (
                    <button
                      type="button" key={opt}
                      className={`btn btn-sm ${issueType === opt ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setIssueType(opt)}
                    >{opt}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Details</label>
                <textarea
                  className="form-control" rows={3} maxLength={200}
                  placeholder="Lights and AC were still on after the 2:00 pm class ended. The room is empty."
                  value={details} onChange={e => setDetails(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted" style={{ marginBottom: 12 }}>Sent to the campus facilities team</p>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Submit report</button>
              {submitted && <div className="text-sm" style={{ color: '#2d6a4f', marginTop: 10, background: '#d1fae5', padding: '8px 12px', borderRadius: 8 }}>✓ Report submitted successfully.</div>}
              <p className="text-xs text-muted" style={{ marginTop: 10 }}>Do not touch electrical panels or damaged equipment. Report safety hazards to campus security.</p>
            </form>
          </div>
        </div>

        {/* Room consumption + checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-header"><h2>Today's room consumption</h2><p>Useful usage and estimated wastage · kWh</p></div>
            <div className="card-body">
              {FACULTY_ROOMS.map(r => (
                <div key={r.id} className="progress-row">
                  <div className="progress-label">
                    <span style={{ fontSize: '.82rem', fontWeight: 500 }}>{r.id}</span>
                    <span style={{ fontSize: '.82rem', color: '#6b7f79' }}>{r.usage} kWh</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill green" style={{ width: `${((r.usage - r.waste) / 40) * 100}%` }} />
                    {r.waste > 0 && <div className="progress-fill amber" style={{ width: `${(r.waste / 40) * 100}%`, marginLeft: 2 }} />}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', color: '#6b7f79' }}><div style={{ width: 10, height: 10, background: '#2d6a4f', borderRadius: 2 }} /> Useful usage</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', color: '#6b7f79' }}><div style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }} /> Est. wastage</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2>Before leaving a classroom</h2><p>Small checks that make a difference</p></div>
            <div className="card-body">
              {['Turn off lights, fans and AC when the room is empty.','Check the next class before switching equipment off.','Report persistent issues; do not repair equipment.'].map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ marginTop: 3 }} />
                  <span style={{ fontSize: '.84rem' }}>{t}</span>
                </label>
              ))}
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#f9fbfa', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: '.8rem' }}>
                <span style={{ fontWeight: 600 }}>My September reports</span>
                <span style={{ color: '#2d6a4f' }}>3 submitted · 1 resolved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
