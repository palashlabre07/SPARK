import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { STUDENT_REPORTS, RATE, EF } from '../data/seed';

const BASE_KWH = 30000;
const SEP_KWH  = 24600;
const DELTA    = BASE_KWH - SEP_KWH;

export function StudentDashboard() {
  const { addReport } = useApp();
  const [building, setBuilding] = useState('Academic Block A');
  const [room, setRoom]         = useState('');
  const [issueType, setIssueType] = useState('Lights left on');
  const [details, setDetails]   = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    addReport(building, issueType, details);
    setSubmitted(true);
    setDetails(''); setRoom('');
    setTimeout(() => setSubmitted(false), 3000);
  }

  const pct = Math.round((DELTA / BASE_KWH) * 100);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Every switch-off counts</h1>
          <p>Hi Aarav. Spot wastage, report it clearly and follow the action taken.</p>
        </div>
        <span className="badge normal" style={{ padding: '5px 14px' }}>Student participant</span>
      </div>

      <div className="filter-bar">
        <div className="filter-chip active">September 2026</div>
        <div className="filter-chip active">SPARK campus</div>
        <span className="spacer" />
        <span className="text-sm text-muted">Your reports and shared campus progress</span>
      </div>

      <div className="synth-banner">⚠ SYNTHETIC demo data — campus usage data is simulated.</div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">My wastage reports</div>
          <div className="kpi-value">4</div>
          <div className="kpi-sub">2 resolved · 1 in progress · 1 open</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Student participation</div>
          <div className="kpi-value" style={{ color: '#2d6a4f' }}>186 reports</div>
          <div className="kpi-sub">Submitted by 124 student participants</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Campus usage reduction</div>
          <div className="kpi-value good">{pct}%</div>
          <div className="kpi-sub good">{DELTA.toLocaleString()} kWh below August baseline</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated campus savings</div>
          <div className="kpi-value good">₹{(DELTA * RATE / 1000).toFixed(1)}k</div>
          <div className="kpi-sub">Shared campus total, not personal savings</div>
        </div>
      </div>

      {/* Two col */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        {/* Report form */}
        <div className="card">
          <div className="card-header"><h2>Report energy wastage</h2><p>See lights or cooling left on? Tell us where.</p></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Building</label>
                  <select className="form-control" value={building} onChange={e => setBuilding(e.target.value)}>
                    <option>Academic Block A</option><option>Academic Block B</option><option>Library</option><option>Labs</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Room / location</label>
                  <input className="form-control" placeholder="Select room" value={room} onChange={e => setRoom(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">What did you notice?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Lights left on','AC / fan running','Other'].map(opt => (
                    <button type="button" key={opt}
                      className={`btn btn-sm ${issueType === opt ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setIssueType(opt)}>{opt}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Details</label>
                <textarea className="form-control" rows={3} placeholder="Describe the issue, when you noticed it and whether the room was empty."
                  value={details} onChange={e => setDetails(e.target.value)} />
              </div>

              <p className="text-xs text-muted" style={{ marginBottom: 12 }}>Sent to the campus facilities team</p>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Submit report</button>
              {submitted && <div className="text-sm" style={{ color: '#2d6a4f', marginTop: 10, background: '#d1fae5', padding: '8px 12px', borderRadius: 8 }}>✓ Report submitted. Thank you!</div>}
              <p className="text-xs text-muted" style={{ marginTop: 10 }}>Do not touch electrical panels or damaged equipment. Report safety hazards to campus security.</p>
            </form>
          </div>
        </div>

        {/* Impact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-header"><h2>A campus effort, a shared impact</h2><p>September demo progress</p></div>
            <div className="card-body">
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{pct}% less energy used</span>
                  <span className="text-xs" style={{ background: '#f9fbfa', padding: '2px 8px', borderRadius: 4, color: '#6b7f79' }}>Target: 15%</span>
                </div>
                <div className="progress-track" style={{ height: 12 }}>
                  <div className="progress-fill green" style={{ width: `${Math.min(pct / 20 * 100, 100)}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span className="text-xs text-muted">0% reduction</span>
                  <span className="text-xs text-muted">20% reduction</span>
                </div>
              </div>
              <p className="text-sm text-muted" style={{ marginBottom: 12 }}>Campus target exceeded by 3 percentage points.</p>
              <p className="text-sm text-muted" style={{ marginBottom: 16 }}>142 of 186 student reports resolved this month. Your four reports are part of that shared effort.</p>
              <div style={{ background: '#d1fae5', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>🌱</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#065f46' }}>{(DELTA * EF / 1000).toFixed(2)} t estimated CO₂ avoided</div>
                  <div className="text-xs text-muted">{DELTA.toLocaleString()} kWh reduced × {EF} kg CO₂/kWh</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2>Spot it. Report it. Stay safe.</h2></div>
            <div className="card-body">
              <p className="text-sm text-muted" style={{ marginBottom: 10 }}>Look for empty classrooms with lights, fans or AC still running. Include the building, room number and time.</p>
              <p style={{ fontSize: '.84rem', fontWeight: 700, color: '#111f1b', marginBottom: 8 }}>Never touch wiring or electrical panels.</p>
              <p className="text-sm text-muted">Reports help the facilities team prioritise checks. They do not directly measure individual savings.</p>
            </div>
          </div>
        </div>
      </div>

      {/* My report status */}
      <div className="card">
        <div className="card-header">
          <h2>My report status</h2>
          <button className="btn btn-outline btn-sm">View all reports</button>
        </div>
        <p className="text-sm text-muted" style={{ padding: '8px 22px 0' }}>Track what happened after you reported an issue.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Report / issue</th><th>Location</th><th>Submitted</th><th>Status</th><th>Latest update</th><th>Action</th></tr>
            </thead>
            <tbody>
              {STUDENT_REPORTS.map(r => (
                <tr key={r.id}>
                  <td><span style={{ fontWeight: 600, fontSize: '.84rem' }}>{r.id}</span><br /><span className="text-sm text-muted">{r.issue}</span></td>
                  <td className="text-sm">{r.location}</td>
                  <td className="text-sm text-muted">{r.submitted}</td>
                  <td><span className={`badge ${r.status === 'Resolved' ? 'resolved' : r.status === 'In progress' ? 'progress' : 'open'}`}>{r.status}</span></td>
                  <td className="text-sm text-muted">{r.update}</td>
                  <td><button className="btn btn-ghost btn-sm">View →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted" style={{ padding: '12px 22px', borderTop: '1px solid #eee' }}>
          Impact is illustrative: Sep 24,600 kWh vs Aug 30,000 kWh; ₹8/kWh assumed tariff. Full-month totals are not adjusted for days or occupancy.
        </p>
      </div>
    </div>
  );
}
