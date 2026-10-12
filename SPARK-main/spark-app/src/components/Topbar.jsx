import React, { useState } from 'react';
import { Bell, Database, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { campuses } from '../data/seed';

export function Topbar() {
  const { role, campus, dbConnected, dbLoading, occAlerts, acknowledgeAlert } = useApp();
  const [showAlerts, setShowAlerts] = useState(false);

  const initials  = role === 'admin'   ? 'AK' : role === 'faculty' ? 'PS' : 'AV';
  const name      = role === 'admin'   ? 'Ananya Kapoor'
                  : role === 'faculty' ? 'Dr. Priya Sharma' : 'Aarav Verma';
  const workspace = role === 'admin'   ? 'Campus operations'
                  : role === 'faculty' ? 'Faculty workspace' : 'Student workspace';

  const unreadAlerts = (occAlerts || []).filter(a => !a.acknowledged);

  return (
    <header className="topbar" style={{ position: 'relative' }}>
      <div className="topbar-left">
        <span>{workspace}</span>
        <span style={{ color: '#ccc' }}>/</span>
        <span>{campuses[campus]?.name || 'SPARK Campus'}</span>
      </div>

      <div className="topbar-right">
        {/* DB status pill */}
        {dbLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', color: '#94a3b8' }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…
          </span>
        ) : dbConnected ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', color: '#2d6a4f', background: '#d1fae5', padding: '3px 10px', borderRadius: 999 }}>
            <CheckCircle2 size={12} /> Supabase connected
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', color: '#b45309', background: '#fef3c7', padding: '3px 10px', borderRadius: 999 }}>
            <Database size={12} /> Demo mode (DB offline)
          </span>
        )}

        {dbConnected ? (
          <span className="badge-sim" style={{ background: '#d1fae5', color: '#166534', border: '1px solid #86efac', fontWeight: 700 }}>
            ● LIVE SUPABASE DATA
          </span>
        ) : (
          <span className="badge-sim">SIMULATED DATA</span>
        )}

        {/* Bell with YOLO alert badge */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowAlerts(s => !s)}
            title={`${unreadAlerts.length} camera alerts`}
          >
            <Bell size={17} />
            {unreadAlerts.length > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#c0392b', color: '#fff',
                fontSize: '.6rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{unreadAlerts.length > 9 ? '9+' : unreadAlerts.length}</span>
            )}
          </button>

          {/* Dropdown panel */}
          {showAlerts && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 200,
              width: 360, background: '#fff', border: '1px solid #dde8e4',
              borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f4f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Camera alerts</span>
                <span style={{ fontSize: '.75rem', color: '#94a3b8' }}>YOLO · OpenCV</span>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {occAlerts && occAlerts.length > 0 ? (
                  occAlerts.slice(0, 15).map(a => (
                    <div key={a.id} style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid #f8fafa',
                      background: a.acknowledged ? '#f9fafb' : a.severity === 'High' ? '#fff5f5' : '#fffbeb',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <AlertTriangle size={15} style={{ color: a.severity === 'High' ? '#c0392b' : '#b45309', flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.82rem', color: a.acknowledged ? '#94a3b8' : '#111' }}>
                          {a.alert_type?.replace(/_/g, ' ')} — {a.zone_id}
                        </div>
                        <div style={{ fontSize: '.75rem', color: '#6b7f79', marginTop: 2 }}>
                          {a.message || `${a.people_count} person(s) detected · ${a.severity}`}
                        </div>
                        <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 2 }}>
                          {new Date(a.ts || a.created_at).toLocaleString('en-IN')}
                        </div>
                      </div>
                      {!a.acknowledged && (
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ flexShrink: 0, fontSize: '.72rem', padding: '3px 8px' }}
                          onClick={() => acknowledgeAlert(a.id)}
                        >
                          Ack
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '.85rem' }}>
                    No camera alerts.<br />
                    <span style={{ fontSize: '.75rem' }}>Alerts appear when YOLO detects an empty zone with power on.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="avatar">{initials}</div>
          <span style={{ fontSize: '.85rem', fontWeight: 600 }}>{name}</span>
        </div>
      </div>

      {/* Click-outside to close */}
      {showAlerts && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          onClick={() => setShowAlerts(false)}
        />
      )}
    </header>
  );
}
