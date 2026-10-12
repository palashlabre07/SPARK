import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Camera, Wifi, Clock, User, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { OpenCvCameraDetector } from '../components/OpenCvCameraDetector';

const SEV_COLOR = { High: '#c0392b', Medium: '#b45309', Low: '#2563eb', Info: '#2d6a4f' };
const SEV_BG    = { High: '#fde8e8', Medium: '#fef3c7', Low: '#eff6ff', Info: '#d1fae5' };

const ALERT_ICONS = {
  EMPTY_ROOM_POWER_ON: '💡',
  NO_DETECTION:        '👁️',
  LOW_OCCUPANCY:       '👥',
};

export function CameraAlertsPage() {
  const { occAlerts, acknowledgeAlert, liveOcc, dbConnected } = useApp();
  const [filter, setFilter] = useState('all');   // all | unread | high

  const filtered = (occAlerts || []).filter(a => {
    if (filter === 'unread') return !a.acknowledged;
    if (filter === 'high')   return a.severity === 'High';
    return true;
  });

  const unread = (occAlerts || []).filter(a => !a.acknowledged).length;
  const highCount = (occAlerts || []).filter(a => a.severity === 'High').length;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Camera occupancy & alerts</h1>
          <p>Live YOLO person-detection feed. Alerts fire when a zone is empty but power is on.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', padding: '5px 12px', borderRadius: 999,
            background: dbConnected ? '#d1fae5' : '#fef3c7',
            color:      dbConnected ? '#2d6a4f' : '#b45309',
          }}>
            <Wifi size={13} />
            {dbConnected ? 'Live · Supabase connected' : 'Demo mode · Supabase offline'}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total alerts</div>
          <div className="kpi-value">{(occAlerts || []).length}</div>
          <div className="kpi-sub">from YOLO camera agent</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unacknowledged</div>
          <div className={`kpi-value ${unread > 0 ? 'bad' : ''}`}>{unread}</div>
          <div className="kpi-sub warn">{unread > 0 ? 'Need attention' : 'All clear'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">High severity</div>
          <div className={`kpi-value ${highCount > 0 ? 'bad' : ''}`}>{highCount}</div>
          <div className="kpi-sub">After-hours empty room</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Live zone readings</div>
          <div className="kpi-value">{Object.keys(liveOcc || {}).length}</div>
          <div className="kpi-sub">zones with camera data</div>
        </div>
      </div>

      {/* Option A: Browser-based OpenCV.js Person Detection & Empty Room Alert */}
      <OpenCvCameraDetector />

      {/* Live occupancy grid */}
      {Object.keys(liveOcc || {}).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h2>Live zone occupancy</h2>
            <span className="badge normal">YOLO · refreshes every 30s</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {Object.entries(liveOcc).map(([zoneId, reading]) => {
                const empty = reading.people === 0;
                return (
                  <div key={zoneId} style={{
                    background: empty ? '#fff5f5' : '#f0fdf4',
                    border: `1.5px solid ${empty ? '#fca5a5' : '#86efac'}`,
                    borderRadius: 10, padding: '14px 16px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '.75rem', color: '#6b7f79', fontWeight: 600, marginBottom: 8 }}>
                      {zoneId.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '2rem' }}>{empty ? '⚠️' : '👤'}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.4rem', fontFamily: "'Bricolage Grotesque',sans-serif", color: empty ? '#c0392b' : '#2d6a4f', marginTop: 4 }}>
                      {reading.people}
                    </div>
                    <div style={{ fontSize: '.72rem', color: '#6b7f79', marginTop: 2 }}>
                      {empty ? 'EMPTY' : 'people'}
                    </div>
                    <div style={{ fontSize: '.68rem', color: '#94a3b8', marginTop: 4 }}>
                      {new Date(reading.ts).toLocaleTimeString('en-IN')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        {[['all','All alerts'],['unread','Unacknowledged'],['high','High severity']].map(([key, label]) => (
          <button key={key} className={`filter-chip ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
        <span className="spacer" />
        <span className="text-sm text-muted">{filtered.length} alerts shown</span>
      </div>

      {/* Alerts list */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '40px', color: '#6b7f79' }}>
            <Camera size={32} style={{ opacity: .3, marginBottom: 12 }} />
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No camera alerts</div>
            <div style={{ fontSize: '.85rem' }}>
              {dbConnected
                ? 'Alerts appear here when the YOLO agent detects an empty zone with power on.'
                : 'Start the YOLO agent to generate real alerts: python yolo_agent.py --zone lab'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(alert => (
            <div
              key={alert.id}
              className="alert-card"
              style={{
                background:  alert.acknowledged ? '#f9fafb' : SEV_BG[alert.severity] || '#fff',
                borderLeftColor: alert.acknowledged ? '#dde8e4' : SEV_COLOR[alert.severity] || '#dde8e4',
                opacity: alert.acknowledged ? 0.75 : 1,
              }}
            >
              <div className="alert-title">
                <span style={{ fontSize: '1.1rem' }}>{ALERT_ICONS[alert.alert_type] || '📷'}</span>
                <span style={{ color: SEV_COLOR[alert.severity], fontWeight: 700 }}>
                  [{alert.severity}]
                </span>
                {alert.alert_type?.replace(/_/g, ' ')}
                <span className="badge normal" style={{ marginLeft: 6, fontSize: '.7rem' }}>
                  Zone: {alert.zone_id}
                </span>
                {alert.acknowledged && (
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.75rem', color: '#2d6a4f' }}>
                    <CheckCircle2 size={13} /> Acknowledged
                  </span>
                )}
              </div>

              <div className="alert-body" style={{ marginBottom: 10 }}>
                {alert.message || `${alert.people_count} person(s) detected in zone ${alert.zone_id}.`}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '.78rem', color: '#94a3b8', marginBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> {new Date(alert.ts || alert.created_at).toLocaleString('en-IN')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} /> {alert.people_count} people detected
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={12} /> Source: YOLO v8
                </span>
              </div>

              <div className="alert-footer">
                {!alert.acknowledged && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    <CheckCircle2 size={13} /> Acknowledge
                  </button>
                )}
                <span className="text-xs text-muted">
                  {alert.alert_type === 'EMPTY_ROOM_POWER_ON'
                    ? 'Empty room detected after hours with equipment likely on.'
                    : 'No person detected for extended period — verify before acting.'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Setup guide */}
      {!dbConnected && (
        <div style={{ marginTop: 28, background: '#f9fbfa', border: '1px solid #dde8e4', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>📷 YOLO Camera Agent setup</div>
          <div style={{ fontSize: '.85rem', color: '#6b7f79', lineHeight: 1.7 }}>
            <p><strong>1. Install dependencies:</strong></p>
            <pre style={{ background: '#1e2a26', color: '#a8d8c0', borderRadius: 8, padding: '10px 14px', fontSize: '.8rem', overflowX: 'auto', marginBottom: 10 }}>
{`pip install ultralytics opencv-python-headless python-dotenv`}
            </pre>
            <p><strong>2. Add your Supabase anon key to spark-app/.env</strong></p>
            <p><strong>3. Run the agent:</strong></p>
            <pre style={{ background: '#1e2a26', color: '#a8d8c0', borderRadius: 8, padding: '10px 14px', fontSize: '.8rem', overflowX: 'auto' }}>
{`# Webcam (Computer Lab 2)
python yolo_agent.py --zone lab

# IP camera (Library)
python yolo_agent.py --zone lib --source rtsp://cam.local/stream

# Headless (no display window)
python yolo_agent.py --zone aud --no-window`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
