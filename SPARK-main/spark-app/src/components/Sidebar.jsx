import React from 'react';
import { LayoutDashboard, Building2, Bell, BarChart3, Leaf, Camera, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

const ADMIN_NAV = [
  { id: 'overview',  label: 'Overview',              icon: LayoutDashboard },
  { id: 'buildings', label: 'Buildings & Classrooms', icon: Building2       },
  { id: 'alerts',    label: 'Alerts & Actions',       icon: Bell            },
  { id: 'camera',    label: 'Camera / YOLO',           icon: Camera          },
  { id: 'reports',   label: 'Reports & Impact',        icon: BarChart3       },
];
const FACULTY_NAV = [
  { id: 'faculty-dash',    label: 'My dashboard',        icon: LayoutDashboard },
  { id: 'faculty-rooms',   label: 'Assigned classrooms',  icon: Building2       },
  { id: 'camera',          label: 'Camera / YOLO',         icon: Camera          },
  { id: 'faculty-reports', label: 'My reports',           icon: BarChart3       },
  { id: 'campus-impact',   label: 'Campus impact',        icon: Leaf            },
];
const STUDENT_NAV = [
  { id: 'student-dash',  label: 'My dashboard',   icon: LayoutDashboard },
  { id: 'report-waste',  label: 'Report wastage',  icon: Bell            },
  { id: 'my-reports',    label: 'My reports',      icon: BarChart3       },
  { id: 'campus-impact', label: 'Campus impact',   icon: Leaf            },
];

export function Sidebar({ page, setPage }) {
  const { role, setRole, occAlerts } = useApp();

  const navItems = role === 'admin'   ? ADMIN_NAV
                 : role === 'faculty' ? FACULTY_NAV
                 : STUDENT_NAV;

  const roleLabel = role === 'admin'   ? 'Campus Admin'
                  : role === 'faculty' ? 'Faculty'
                  : 'Student';

  // Count unacknowledged camera alerts for the badge
  const unreadCam = (occAlerts || []).filter(a => !a.acknowledged).length;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo">Campus Energy</div>
        <div className="sub">SPARK Campus</div>
      </div>
      <span className="sidebar-role">{roleLabel}</span>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          const showBadge = item.id === 'camera' && unreadCam > 0;
          return (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
              style={{ position: 'relative' }}
            >
              <Icon className="icon" size={16} />
              {item.label}
              {showBadge && (
                <span style={{
                  marginLeft: 'auto',
                  background: '#c0392b', color: '#fff',
                  borderRadius: 999, fontSize: '.65rem', fontWeight: 700,
                  padding: '1px 6px', lineHeight: '1.4',
                }}>{unreadCam > 9 ? '9+' : unreadCam}</span>
              )}
            </button>
          );
        })}

        <div className="nav-sep" />
        <button className="nav-item" onClick={() => { setRole(null); setPage(null); }}>
          <ArrowLeft size={16} className="icon" />
          Back to welcome
        </button>
      </nav>

      <div className="sidebar-foot">
        <div style={{ fontWeight: 600, color: '#8fa9a2', marginBottom: 4 }}>Demo workspace</div>
        Simulated consumption. No live meter connection.
      </div>
    </aside>
  );
}
