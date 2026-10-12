import React, { useState } from 'react';
import './index.css';
import { AppProvider, useApp } from './context/AppContext';
import { WelcomePage }       from './pages/WelcomePage';
import { AdminOverview }     from './pages/AdminOverview';
import { BuildingsPage }     from './pages/BuildingsPage';
import { AlertsPage }        from './pages/AlertsPage';
import { ReportsPage }       from './pages/ReportsPage';
import { FacultyDashboard }  from './pages/FacultyDashboard';
import { StudentDashboard }  from './pages/StudentDashboard';
import { CameraAlertsPage }  from './pages/CameraAlertsPage';
import { Sidebar }           from './components/Sidebar';
import { Topbar }            from './components/Topbar';

function Shell() {
  const { role } = useApp();
  const [page, setPage] = useState(null);

  if (!role) return <WelcomePage />;

  const defaultPage = role === 'admin'   ? 'overview'
                    : role === 'faculty' ? 'faculty-dash'
                    : 'student-dash';
  const activePage = page ?? defaultPage;

  const content = (() => {
    switch (activePage) {
      case 'overview':        return <AdminOverview   setPage={setPage} />;
      case 'buildings':       return <BuildingsPage   />;
      case 'alerts':          return <AlertsPage      />;
      case 'reports':         return <ReportsPage     />;
      case 'camera':          return <CameraAlertsPage />;
      case 'faculty-dash':    return <FacultyDashboard setPage={setPage} />;
      case 'faculty-rooms':   return <BuildingsPage   />;
      case 'faculty-reports': return <ReportsPage     />;
      case 'student-dash':    return <StudentDashboard />;
      case 'report-waste':    return <StudentDashboard />;
      case 'my-reports':      return <StudentDashboard />;
      case 'campus-impact':   return <ReportsPage     />;
      default:                return <AdminOverview   setPage={setPage} />;
    }
  })();

  return (
    <div className="app-shell">
      <Sidebar page={activePage} setPage={setPage} />
      <div className="main-area">
        <Topbar />
        {content}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
