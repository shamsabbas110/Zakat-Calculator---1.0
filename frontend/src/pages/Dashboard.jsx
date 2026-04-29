import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, TrendingUp, Calendar, ArrowUpRight,
  BookOpen, Loader2, Trash2, Bell, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Marquee from '../components/Marquee';
import { getZakatHistory, deleteZakatRecord } from '../services/api';
import '../styles/Dashboard.css';

/**
 * Dashboard — reads history from MongoDB (with localStorage fallback).
 *
 * Features:
 *  • GET /api/zakat/history on mount → populate history list & stat cards
 *  • DELETE /api/zakat/:id → remove record from UI + DB
 *  • Notification banner if any record's nextDueDateGregorian ≤ today
 *  • Navigation buttons to Calculate Zakat and Missed Zakat pages
 */
export default function Dashboard() {
  const navigate = useNavigate();

  /* ── HISTORY STATE ── */
  const [history, setHistory]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [deleteId, setDeleteId]       = useState(null);   // id currently being deleted
  const [notification, setNotification] = useState(null); // string | null

  /* ── DERIVED STAT TOTALS (computed from history) ── */
  const totalPayable = history.reduce((s, r) => s + (r.zakatAmount  || 0), 0);
  const totalWealth  = history.reduce((s, r) => s + (r.totalWealth  || 0), 0);
  
  // Format dates properly. If no history exists, default to today's date + time.
  const getFormattedDate = (record) => {
    if (!record || !record.createdAt) {
      const d = new Date();
      return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    }
    
    const d = new Date(record.createdAt);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    return `${day}-${month}-${year} • ${time}`;
  };
  
  const convertNumerals = (str) => {
    if (!str) return '';
    const numerals = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    return str.split('').map(char => numerals[char] || char).join('');
  };

  const lastCalc = history.length > 0 ? getFormattedDate(history[0]) : getFormattedDate(null);

  /* ═══════════════════════════════════════════════════
     LOAD HISTORY — tries backend first, localStorage fallback
  ═══════════════════════════════════════════════════ */
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      // getZakatHistory() now returns the array directly (unwrapped in api.js)
      const records = await getZakatHistory();
      const list = Array.isArray(records) ? records : [];
      setHistory(list);
      checkNotifications(list);
    } catch {
      // Backend offline — fall back to localStorage
      const local = JSON.parse(localStorage.getItem('zakatHistory') || '[]');
      setHistory(local);
      checkNotifications(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  /* ═══════════════════════════════════════════════════
     NOTIFICATION CHECK
     Fires if any record's nextDueDateGregorian is today or in the past.
     The date format from the backend / localStorage is e.g. "June 2018"
     so we compare year+month only (most practical for Hijri approximations).
  ═══════════════════════════════════════════════════ */
  const checkNotifications = (records) => {
    const now = new Date();
    const overdue = records.find(r => {
      if (!r.nextDueDateGregorian) return false;
      const cleanDate = convertNumerals(r.nextDueDateGregorian);
      const due = new Date(cleanDate);
      return !isNaN(due.getTime()) && due <= now;
    });
    if (overdue) {
      const cleanDate = convertNumerals(overdue.nextDueDateGregorian);
      const d = new Date(cleanDate);
      let fmt = cleanDate;
      
      if (!isNaN(d.getTime())) {
        fmt = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
      }
      
      setNotification(
        `🚨 Your Zakat cycle has completed! Your Hawl anniversary was ${fmt}. Please recalculate your current wealth.`
      );
    }
  };

  /* ═══════════════════════════════════════════════════
     DELETE RECORD
  ═══════════════════════════════════════════════════ */
  const handleDelete = async (record) => {
    // Use MongoDB _id if available, otherwise the local id
    const id = record._id || record.id;
    setDeleteId(id);

    try {
      // Try backend delete
      await deleteZakatRecord(id);
    } catch {
      // Backend offline — just remove from localStorage
      console.warn('Backend delete failed, removing from local storage only.');
    }

    // Always remove from UI state + localStorage
    setHistory(prev => prev.filter(r => (r._id || r.id) !== id));
    const local = JSON.parse(localStorage.getItem('zakatHistory') || '[]');
    localStorage.setItem(
      'zakatHistory',
      JSON.stringify(local.filter(r => (r._id || r.id) !== id))
    );

    setDeleteId(null);
  };

  /* ═══════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════ */
  return (
    <div className="dash fade-up">

      {/* ══ NOTIFICATION BANNER (Hawl due alert) ══ */}
      {notification && (
        <div className="glass-card fade-in" style={{ 
          marginBottom: '2rem', 
          border: '1px solid var(--accent)', 
          background: 'rgba(245, 158, 11, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1.5rem'
        }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)' }}>
            <Bell size={24} color="var(--accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: 'var(--accent)', fontSize: '1.1rem' }}>Hawl Cycle Complete!</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>{notification}</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/current')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Calculate Now
          </button>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* ══ ROW 1 — Hero Header ══ */}
      <header className="dash__hero">
        <div>
          <h1 className="dash__heading">
            ZAKAT<br />CALCULATOR
          </h1>
          <p className="dash__sub">
            Track, calculate, and purify your wealth — in one place.
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/current')}>
          Calculate Now <ArrowUpRight size={16} />
        </button>
      </header>

      {/* ══ ROW 2 — Stat Cards (3 columns) ══ */}
      <section className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>

        <div className="stat-card">
          <div className="stat-card__icon">
            <Wallet size={20} style={{ color: '#f59e0b' }} />
          </div>
          <p className="stat-card__label">Total Payable Zakat</p>
          <h2 className="stat-card__value">₹{totalPayable.toFixed(2)}</h2>
          <p className="stat-card__note">2.5% of total wealth</p>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">
            <TrendingUp size={20} style={{ color: '#10b981' }} />
          </div>
          <p className="stat-card__label">Total Wealth Assessed</p>
          <h2 className="stat-card__value">₹{totalWealth.toFixed(2)}</h2>
          <p className="stat-card__note">Cash + Gold + Silver</p>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">
            <Calendar size={20} style={{ color: '#a78bfa' }} />
          </div>
          <p className="stat-card__label">Last Calculated</p>
          <h2 className="stat-card__value stat-card__value--sm">{lastCalc}</h2>
          <p className="stat-card__note">Most recent entry</p>
        </div>

      </section>

      {/* ══ ROW 3 — Bottom grid (2 columns) ══ */}
      <div className="dashboard-grid">

        {/* ── LEFT: Recent Calculations History ── */}
        <div className="dash__recent">
          <div className="dash__section-row">
            <h3 className="dash__section-title">Recent Calculations</h3>
            <button
              className="dash__nav-btn"
              onClick={() => navigate('/missed')}
            >
              Missed Zakat →
            </button>
          </div>

          {/* Loading spinner */}
          {loading && (
            <div className="dash__loading">
              <Loader2 size={20} className="spinning" style={{ color: '#f59e0b' }} />
              <span>Fetching from database...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && history.length === 0 && (
            <div className="dash__empty">
              <p>No calculations yet.</p>
              <p>
                Click{' '}
                <em onClick={() => navigate('/current')} style={{ cursor:'pointer', color:'#9ca3af' }}>
                  Calculate Now
                </em>{' '}
                to get started.
              </p>
            </div>
          )}

          {/* History list with delete */}
          {!loading && history.length > 0 && (
            <div className="recent-calculations-list">
              <ul className="dash__history-list">
                {history.slice(0, 6).map(record => {
                  const id = record._id || record.id;
                  return (
                    <li key={id} className="dash__history-item">
                      <span className="dash__history-dot" />
                      <div className="dash__history-body">
                        <p className="dash__history-label">
                          {record.type || 'Zakat'}
                          {record.nextDueDateGregorian && (
                            <span className="dash__due-badge">
                              Due: {(() => {
                                const cleanDate = convertNumerals(record.nextDueDateGregorian);
                                const d = new Date(cleanDate);
                                if (isNaN(d.getTime())) return cleanDate; 
                                
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = d.getFullYear();
                                return `${day}-${month}-${year}`;
                              })()}
                            </span>
                          )}
                        </p>
                        <p className="dash__history-value">
                          <span style={{ color: '#f59e0b' }}>
                            ₹{(record.zakatAmount || 0).toFixed(2)}
                          </span>
                          <span className="dash__history-date">
                            {getFormattedDate(record)}
                          </span>
                        </p>
                      </div>
                      {/* Delete button */}
                      <button
                        className="dash__delete-btn"
                        onClick={() => handleDelete(record)}
                        disabled={deleteId === id}
                        aria-label="Delete record"
                        title="Delete this record"
                      >
                        {deleteId === id
                          ? <Loader2 size={14} className="spinning" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* ── RIGHT: Image + Quote card ── */}
        <div
          className="dash__quote-card"
          style={{ backgroundImage: `url('https://plus.unsplash.com/premium_photo-1678556964714-39b99891ff05?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')` }}
        >
          <div className="dash__quote-overlay">
            <BookOpen size={22} style={{ color: '#f59e0b' }} />
            <p className="dash__quote-text">
              "Take from their wealth a charity by which you purify them
              and cause them increase..."
            </p>
            <span className="dash__quote-source">— Quran 9:103</span>
          </div>
        </div>

      </div>

      {/* ══ MARQUEE — full width, outside the grid ══ */}
      <Marquee />

    </div>
  );
}
