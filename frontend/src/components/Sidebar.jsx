import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calculator, History, MoonStar, User } from 'lucide-react';
import '../styles/Sidebar.css';

/**
 * Sidebar — vertical navigation matching the wireframe.
 * Each nav item is a bordered card on a dark background.
 */
export default function Sidebar() {
  return (
    <aside className="sidebar">

      {/* ── LOGO ── */}
      <div className="sidebar-brand">
        <MoonStar size={26} style={{ color: '#f59e0b' }} />
        <h2>Zakat<span style={{ color: '#f59e0b' }}>Calc</span></h2>
      </div>

      {/* ── NAV LINKS (bordered card style) ── */}
      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/current"
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <Calculator size={18} />
          <span>Find Zakat</span>
        </NavLink>

        <NavLink
          to="/missed"
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <History size={18} />
          <span>Find Past Zakat</span>
        </NavLink>

        <NavLink
          to="/admin"
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          style={{ marginTop: 'auto' }}
        >
          <Calculator size={18} />
          <span>Admin Panel</span>
        </NavLink>
      </nav>

      {/* ── FOOTER ── */}
      <div className="sidebar-footer">
        <p className="footer-text">Purify your wealth<br />with precision.</p>
      </div>

    </aside>
  );
}
