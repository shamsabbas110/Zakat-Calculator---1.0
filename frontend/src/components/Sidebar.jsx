import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calculator, 
  History, 
  MoonStar, 
  User, 
  LogOut, 
  Shield, 
  Menu, 
  X 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/Sidebar.css';

/**
 * Sidebar — dual-mode responsive navigation:
 * 1. Desktop: Fixed vertical sidebar (>= 769px) matching existing wireframe.
 * 2. Mobile: Sticky topbar with hamburger trigger + animated slide-out drawer (<= 768px).
 */
export default function Sidebar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer automatically when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Prevent background scrolling while drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/auth');
  };

  // Nav links collection
  const renderNavLinks = () => (
    <>
      <NavLink
        to="/"
        end
        onClick={() => setIsOpen(false)}
        className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
      >
        <LayoutDashboard size={18} />
        <span>Dashboard</span>
      </NavLink>

      <NavLink
        to="/current"
        onClick={() => setIsOpen(false)}
        className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
      >
        <Calculator size={18} />
        <span>Find Zakat</span>
      </NavLink>

      <NavLink
        to="/missed"
        onClick={() => setIsOpen(false)}
        className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
      >
        <History size={18} />
        <span>Find Past Zakat</span>
      </NavLink>

      {isAuthenticated && (
        <NavLink
          to="/profile"
          onClick={() => setIsOpen(false)}
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <User size={18} />
          <span>My Profile</span>
        </NavLink>
      )}

      <NavLink
        to="/admin"
        onClick={() => setIsOpen(false)}
        className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        style={{ marginTop: 'auto' }}
      >
        <Shield size={18} />
        <span>Admin Panel</span>
      </NavLink>
    </>
  );

  // User Profile card component
  const renderUserProfileCard = () => (
    isAuthenticated && user ? (
      <div style={{
        background: '#141414',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem'
      }}>
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name || 'User'}
            referrerPolicy="no-referrer"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1.5px solid #f59e0b'
            }}
          />
        ) : (
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: '#f59e0b',
            color: '#000',
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {user.name || 'Zakat User'}
          </p>
          <p style={{
            margin: 0,
            fontSize: '0.7rem',
            color: '#9ca3af',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {user.email}
          </p>
        </div>

        <button
          onClick={handleLogout}
          title="Sign Out"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
        >
          <LogOut size={16} />
        </button>
      </div>
    ) : (
      <NavLink
        to="/auth"
        onClick={() => setIsOpen(false)}
        className="btn-primary"
        style={{ textDecoration: 'none', justifyContent: 'center' }}
      >
        Sign In
      </NavLink>
    )
  );

  return (
    <>
      {/* ── 1. DESKTOP SIDEBAR (>= 769px) ── */}
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <MoonStar size={26} style={{ color: '#f59e0b' }} />
          <h2>Zakat<span style={{ color: '#f59e0b' }}>Calc</span></h2>
        </div>

        <nav className="sidebar-nav">
          {renderNavLinks()}
        </nav>

        {renderUserProfileCard()}

        <div className="sidebar-footer">
          <p className="footer-text">Purify your wealth<br />with precision.</p>
        </div>
      </aside>

      {/* ── 2. MOBILE TOPBAR (<= 768px) ── */}
      <header className="mobile-topbar">
        <button
          className="mobile-hamburger-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open Navigation Menu"
        >
          <Menu size={24} />
        </button>

        <NavLink to="/" className="mobile-brand">
          <MoonStar size={22} style={{ color: '#f59e0b' }} />
          <h2>Zakat<span style={{ color: '#f59e0b' }}>Calc</span></h2>
        </NavLink>

        {isAuthenticated && user ? (
          <NavLink to="/profile" style={{ display: 'flex', alignItems: 'center' }}>
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User'}
                referrerPolicy="no-referrer"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1.5px solid #f59e0b'
                }}
              />
            ) : (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#f59e0b',
                color: '#000',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
          </NavLink>
        ) : (
          <NavLink
            to="/auth"
            className="btn-primary btn-sm"
            style={{ textDecoration: 'none', padding: '0.35rem 0.85rem' }}
          >
            Sign In
          </NavLink>
        )}
      </header>

      {/* ── 3. MOBILE BACKDROP OVERLAY ── */}
      <div 
        className={`mobile-drawer-backdrop ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* ── 4. MOBILE SLIDE-OUT DRAWER ── */}
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div className="mobile-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MoonStar size={22} style={{ color: '#f59e0b' }} />
            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, color: '#fff' }}>
              Zakat<span style={{ color: '#f59e0b' }}>Calc</span>
            </h2>
          </div>
          <button
            className="mobile-drawer-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {renderNavLinks()}
        </nav>

        {renderUserProfileCard()}

        <div className="sidebar-footer">
          <p className="footer-text">Purify your wealth<br />with precision.</p>
        </div>
      </div>
    </>
  );
}
