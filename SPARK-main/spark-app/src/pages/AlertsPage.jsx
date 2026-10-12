import React, { useMemo, useState } from 'react';
import { Plus, Search, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildEnergyData, ZONES, RATE, EF, N } from '../data/seed';
import { analyse } from '../data/rules';

const fmt = n => Math.round(n).toLocaleString('en-IN');

export function AlertsPage() {
  const { campus, actions, reports, occOverrides, createAction, updateAction } = useApp();
  const zones = useMemo(() => buildEnergyData(campus), [campus]);
  const { alerts, expected } = useMemo(() => analyse(zones, occOverrides, reports), [zones, occOverrides, reports]);

  const [selected, setSelected] = useState(null);
  const [noteInputs, setNoteInputs] = useState({});
  const [search, setSearch]  = useState('');

  const openActs  = actions.filter(a => a.status !== 'Resolved').length;
  const highActs  = actions.filter(a => a.pri === 'High' && a.status !== 'Resolved').length;
  const resolved  = actions.filter(a => a.status === 'Resolved').length;
  const totalWaste= alerts.reduce((a, x) => a + x.kwh, 0);

  const filteredAlerts = alerts.filter(a =>
    search === '' || a.name.toLowerCase().includes(search.toLowerCase()) || a.zone.toLowerCase().includes(search.toLowerCase())
  );

  const sel = selected != null ? alerts[selected] : null;
  const selAction = sel ? actions.find(a => a.zone === sel.zone && a.rule === sel.rule) : null;

  function handleCreate(idx) {
    const a = alerts[idx];
    createAction({ zone: a.zone, rule: a.rule, title: `Investigate ${a.name} — ${a.zone}` });
    setSelected(idx);
  }

  function handleStatus(id, status) {
    const note = noteInputs[id] || '';
    if (status === 'Resolved' && !note) { alert('Please add a resolution note.'); return; }
    updateAction(id, { status, ...(status === 'Resolved' ? { note, resolvedAt: new Date().toISOString() } : {}) });
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Alerts &amp; actions</h1>
          <p>Turn waste signals into owned actions, then confirm the outcome.</p>
        </div>
        <button className="btn btn-primary"><Plus size={15} /> Create action</button>
      </div>

      <div className="filter-bar">
        <div className="filter-chip active">October 2026</div>
        <div className="filter-chip active">All buildings</div>
        <div className="filter-chip active">All severities</div>
        <div className="filter-chip active">All unresolved</div>
        <span className="spacer" />
        <span className="text-sm text-muted">{alerts.length} unresolved alerts</span>
      </div>

      <div className="synth-banner">⚠ SYNTHETIC demo data — all values are simulated, not from real meter readings.</div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Unresolved alerts</div>
          <div className="kpi-value">{alerts.length}</div>
          <div className="kpi-sub">{openActs} open · {actions.filter(a=>a.status==='In progress').length} in progress</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">High priority</div>
          <div className="kpi-value bad">{highActs}</div>
          <div className="kpi-sub warn">{actions.filter(a=>a.due && new Date(a.due) < new Date() && a.status!=='Resolved').length} action overdue</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Resolved this month</div>
          <div className="kpi-value">{resolved}</div>
          <div className="kpi-sub">Of {actions.length} demo waste alerts</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Estimated avoidable use</div>
          <div className="kpi-value warn">{totalWaste.toFixed(1)} kWh</div>
          <div className="kpi-sub warn">Per day across unresolved alerts</div>
        </div>
      </div>

      {/* Main area */}
      <div className="two-col" style={{ alignItems: 'flex-start' }}>
        {/* Alert list */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2>Action queue</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={14} style={{ color: '#6b7f79' }} />
                <input className="form-control" style={{ width: 140, padding: '5px 10px', fontSize: '.8rem' }} placeholder="Search alerts…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Alert / location</th><th>Severity</th><th>Est. waste/day</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((a, i) => {
                    const act = actions.find(x => x.zone === a.zone && x.rule === a.rule);
                    return (
                      <tr key={i} style={{ cursor: 'pointer', background: selected === i ? '#f0f9f4' : 'transparent' }} onClick={() => setSelected(i)}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '.84rem' }}>{a.name}</div>
                          <div className="text-xs text-muted">{a.zone}</div>
                        </td>
                        <td><span className={`badge ${a.sev === 'High' ? 'high' : 'medium'}`}>{a.sev}</span></td>
                        <td className="text-sm">{a.kwh.toFixed(1)} kWh</td>
                        <td><span className={`badge ${act ? (act.status === 'Resolved' ? 'resolved' : act.status === 'In progress' ? 'progress' : 'open') : 'open'}`}>{act ? act.status : 'Open'}</span></td>
                        <td><button className="btn btn-ghost btn-sm">View →</button></td>
                      </tr>
                    );
                  })}
                  {filteredAlerts.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#6b7f79' }}>No alerts match your filters</td></tr>}
                </tbody>
              </table>
            </div>
            {/* Expected (R4 / suppressed R2) */}
            {expected.length > 0 && (
              <div style={{ padding: '12px 22px', borderTop: '1px solid #eee' }}>
                <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: 8, color: '#2d6a4f' }}>Expected high use (no alert raised)</div>
                {expected.map((a, i) => (
                  <div key={i} className="alert-card info" style={{ marginBottom: 8 }}>
                    <div className="alert-title"><span className="badge good">{a.rule}</span> {a.zone}: {a.name}</div>
                    <div className="alert-body">{a.why}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {sel ? (
            <div className="card">
              <div className="card-header" style={{ background: '#f9fbfa' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge ${sel.sev === 'High' ? 'high' : 'medium'}`}>{sel.sev} priority</span>
                  </div>
                  <h2 style={{ fontSize: '.95rem' }}>{sel.zone}: {sel.name}</h2>
                  <p className="text-xs">Rule {sel.rule} · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="card-body">
                {/* Why */}
                <p style={{ fontSize: '.85rem', color: '#374151', lineHeight: 1.65, marginBottom: 14 }}>{sel.why}</p>

                {sel.kwh > 0 && (
                  <div style={{ background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: '.84rem', marginBottom: 2 }}>Potential avoidable (estimate until verified)</div>
                    <div style={{ fontSize: '.9rem' }}>
                      <strong>{sel.kwh.toFixed(1)} kWh</strong> ·
                      ₹{fmt(sel.kwh * RATE)} ·
                      {(sel.kwh * EF).toFixed(1)} kg CO₂
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted" style={{ marginBottom: 16, padding: '8px 0', borderTop: '1px solid #eee' }}>
                  <strong>Possible false positive:</strong> {sel.fp}
                </div>

                {/* Action buttons */}
                {selAction ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.85rem', marginBottom: 8 }}>Action: {selAction.title}</div>
                    <div className="text-sm text-muted" style={{ marginBottom: 10 }}>Owner: {selAction.owner} · Due: {selAction.due} · <span className={`badge ${selAction.status === 'Resolved' ? 'resolved' : selAction.status === 'In progress' ? 'progress' : 'open'}`}>{selAction.status}</span></div>
                    {selAction.status !== 'Resolved' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Resolution note</label>
                          <input
                            className="form-control"
                            placeholder="What was done?"
                            value={noteInputs[selAction.id] || ''}
                            onChange={e => setNoteInputs(p => ({ ...p, [selAction.id]: e.target.value }))}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {selAction.status === 'Open' && <button className="btn btn-outline btn-sm" onClick={() => updateAction(selAction.id, { status: 'In progress' })}>Start action</button>}
                          <button className="btn btn-primary btn-sm" onClick={() => handleStatus(selAction.id, 'Resolved')}>Mark resolved</button>
                          <button className="btn btn-ghost btn-sm">Reassign</button>
                        </div>
                      </>
                    )}
                    {selAction.status === 'Resolved' && (
                      <div className="text-sm" style={{ color: '#2d6a4f', background: '#d1fae5', padding: '8px 12px', borderRadius: 8 }}>
                        ✓ Resolved: {selAction.note}
                      </div>
                    )}
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={() => handleCreate(selected)}>Create action</button>
                )}

                {/* Resolution tracking */}
                <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: '.85rem', marginBottom: 10 }}>Resolution tracking</div>
                  {[
                    { label: 'Reported', done: true, detail: `${new Date().toLocaleDateString('en-IN')} · Alert detected` },
                    { label: 'Assigned', done: !!selAction, detail: selAction ? `Assigned to ${selAction.owner}` : 'Pending' },
                    { label: 'Action & review', done: selAction?.status === 'Resolved', detail: selAction?.status === 'Resolved' ? selAction.note : 'Pending room check and resolution note' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: s.done ? '#2d6a4f' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', color: '#fff', flexShrink: 0, marginTop: 2 }}>{s.done ? '✓' : '•'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '.82rem' }}>{s.label}</div>
                        <div className="text-xs text-muted">{s.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: '#6b7f79' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚡</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Select an alert</div>
              <p className="text-sm">Click any alert in the table to see details and create an action.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
