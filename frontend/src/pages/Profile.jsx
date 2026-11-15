import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getZakatHistory, deleteZakatRecord } from '../services/api';
import { 
  Mail, 
  LogOut, 
  Calendar, 
  ShieldCheck, 
  Loader2, 
  Trash2, 
  Coins, 
  TrendingUp, 
  ArrowLeft 
} from 'lucide-react';
import '../styles/Profile.css';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deleteId, setDeleteId] = useState(null);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const records = await getZakatHistory();
      setHistory(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error('Failed to load profile history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this calculation record?')) return;
    setDeleteId(id);
    try {
      await deleteZakatRecord(id);
      setHistory(prev => prev.filter(r => (r._id || r.id) !== id));
    } catch {
      alert('Failed to delete calculation record.');
    } finally {
      setDeleteId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  };

  // Stats derived from user's history
  const totalCalculatedZakat = history.reduce((sum, r) => sum + (r.zakatAmount || 0), 0);
  const totalAssessedWealth = history.reduce((sum, r) => sum + (r.totalWealth || 0), 0);

  return (
    <div className="profile-container fade-up">
      
      {/* Top back button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button 
          className="btn-secondary" 
          onClick={() => navigate('/')}
          style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      {/* Hero Card: User Info */}
      <div className="profile-hero-card">
        <div className="profile-avatar-row">
          {user?.avatar ? (
            <img 
              src={user.avatar} 
              alt={user.name || 'User'} 
              className="profile-avatar"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="profile-avatar-placeholder">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}

          <div>
            <h1 className="profile-name">{user?.name || 'Zakat Payer'}</h1>
            <p className="profile-email">
              <Mail size={16} /> {user?.email}
            </p>
            <div className="profile-badge">
              <ShieldCheck size={14} /> 
              <span>{user?.authProvider === 'google' ? 'Google Account' : 'Verified Email Account'}</span>
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Personal Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-card__icon">
            <Coins size={20} style={{ color: '#f59e0b' }} />
          </div>
          <p className="stat-card__label">Total Zakat Calculated</p>
          <h2 className="stat-card__value">₹{totalCalculatedZakat.toFixed(2)}</h2>
          <p className="stat-card__note">Across all your assessments</p>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">
            <TrendingUp size={20} style={{ color: '#10b981' }} />
          </div>
          <p className="stat-card__label">Total Wealth Evaluated</p>
          <h2 className="stat-card__value">₹{totalAssessedWealth.toFixed(2)}</h2>
          <p className="stat-card__note">Private to your account</p>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">
            <Calendar size={20} style={{ color: '#a78bfa' }} />
          </div>
          <p className="stat-card__label">Total Calculations</p>
          <h2 className="stat-card__value">{history.length}</h2>
          <p className="stat-card__note">Permanent records</p>
        </div>
      </div>

      {/* History Table */}
      <div className="profile-history-card">
        <div className="profile-section-title">
          <span>Personal Calculation Records</span>
          <button className="btn-secondary" onClick={fetchHistory} style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>
            Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <Loader2 size={28} className="spinning" style={{ margin: '0 auto 1rem', color: '#f59e0b' }} />
            <p>Fetching your personal history...</p>
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <p>No calculation records found in your account.</p>
            <button 
              className="btn-primary" 
              onClick={() => navigate('/current')}
              style={{ margin: '1rem auto 0' }}
            >
              Perform First Calculation
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Assessed Wealth</th>
                  <th>Zakat Owed</th>
                  <th>Hawl Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => {
                  const id = record._id || record.id;
                  return (
                    <tr key={id}>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        {record.type || 'Current Zakat'}
                      </td>
                      <td style={{ color: '#9ca3af' }}>
                        {formatDate(record.createdAt)}
                      </td>
                      <td style={{ color: '#e5e7eb' }}>
                        ₹{(record.totalWealth || 0).toLocaleString()}
                      </td>
                      <td style={{ color: '#f59e0b', fontWeight: 700 }}>
                        ₹{(record.zakatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ color: '#a78bfa', fontSize: '0.85rem' }}>
                        {record.nextDueDateGregorian || '--'}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(id)}
                          disabled={deleteId === id}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '0.35rem',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Delete record"
                        >
                          {deleteId === id ? <Loader2 size={16} className="spinning" /> : <Trash2 size={16} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
