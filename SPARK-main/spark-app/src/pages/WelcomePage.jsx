import React from 'react';
import { Building2, BarChart3, Leaf, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function WelcomePage() {
  const { setRole } = useApp();

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f6', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '18px 40px', borderBottom: '1px solid #dde8e4', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: '1.2rem', color: '#111f1b' }}>SPARK</div>
          <div style={{ fontSize: '.82rem', color: '#6b7f79', fontWeight: 600 }}>SPARK - Smart Power Analytics and Resource Kontrol</div>
        </div>
        <span className="badge-sim">SPARK PLATFORM</span>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px 48px' }}>
        <div style={{ textAlign: 'center', maxWidth: 660, marginBottom: 52 }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#2d6a4f', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
            Smart Campus Sustainability Platform
          </div>
          <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 'clamp(2.6rem,6.5vw,4rem)', fontWeight: 800, color: '#111f1b', lineHeight: 1.05, marginBottom: 12 }}>
            SPARK
          </h1>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: '#2d6a4f', marginBottom: 12 }}>
            SPARK - Smart Power Analytics and Resource Kontrol
          </p>
          <p style={{ color: '#6b7f79', fontSize: '.95rem', lineHeight: 1.65 }}>
            Identify and eliminate electricity wastage with real-time OpenCV/YOLO occupancy detection,
            optimise resource utilisation, and track measurable carbon reduction across campus.
          </p>
        </div>

        {/* Role chooser */}
        <div style={{ width: '100%', maxWidth: 960 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111f1b' }}>Choose your workspace</div>
            <div style={{ fontSize: '.82rem', color: '#6b7f79' }}>Three core sustainability modules</div>
          </div>
          <div className="role-grid">
            <RoleCard
              icon={Building2}
              title="Energy Management"
              desc="Monitor campus-wide electricity consumption, verify empty-room waste with OpenCV/YOLO, and prioritise actions."
              features="Monitor buildings · Assign actions · Live OpenCV camera"
              onClick={() => setRole('admin')}
            />
            <RoleCard
              icon={BarChart3}
              title="Resource Management"
              desc="Manage classrooms, track canteen food waste reduction, meal production, and resource inventory."
              features="Check classrooms · Food waste audit · Resource tracking"
              onClick={() => setRole('faculty')}
            />
            <RoleCard
              icon={Leaf}
              title="Carbon Emission and Waste Management"
              desc="Calculate campus CO₂ emissions, report equipment/material wastage, and track verified campus impact."
              features="Report wastage · Carbon emissions · Verify impact"
              onClick={() => setRole('student')}
            />
          </div>
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 24, maxWidth: 700, marginTop: 52, width: '100%' }}>
          {[
            { icon: '⬛', label: 'See the usage', desc: 'Clear building and room-level energy data.' },
            { icon: '✓',  label: 'Act on wastage', desc: 'Give each issue an owner and a next step.' },
            { icon: '📉', label: 'Measure the change', desc: 'Compare usage, estimated cost and impact.' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.1rem', marginTop: 2 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 3 }}>{f.label}</div>
                <div style={{ color: '#6b7f79', fontSize: '.82rem' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: '14px 40px', borderTop: '1px solid #dde8e4', background: '#fff', display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: '#94a3b8', flexWrap: 'wrap', gap: 8 }}>
        <span>SPARK Campus · Campus sustainability initiative</span>
        <span>Illustrative data only. No live hardware integrations or verified savings.</span>
      </footer>
    </div>
  );
}

function RoleCard({ icon: Icon, title, desc, features, onClick }) {
  return (
    <div className="role-card" onClick={onClick} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="icon-wrap"><Icon size={22} /></div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="features">{features}</div>
      <button className="btn btn-primary btn-enter">
        {title} <ArrowRight size={15} />
      </button>
    </div>
  );
}
