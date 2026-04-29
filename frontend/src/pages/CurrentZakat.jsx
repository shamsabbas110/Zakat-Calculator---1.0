import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  CheckCircle2, 
  Info, 
  Loader2, 
  Wallet,
  BadgeDollarSign, 
  Calendar,
  Zap,
  TrendingUp,
  Landmark,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function CurrentZakat() {
  const navigate = useNavigate();

  // --- STATE ---
  const [marketData, setMarketData] = useState(null);
  const [hasHawl, setHasHawl] = useState(true);
  const [formData, setFormData] = useState({
    netCash: '',
    goldGm: '0',
    silverGm: '0'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  // --- INITIAL LOAD: Fetch Today's Rates & Nisab ---
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await API.get('/rates');
        if (res.data.success) {
          setMarketData(res.data);
        } else {
          setError("Market rates are currently unavailable.");
        }
      } catch (err) {
        setError("Connection failed. Could not reach the backend.");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchRates();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateZakat = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await API.post('/current', {
        isOneYearComplete: hasHawl,
        netCash: parseFloat(formData.netCash) || 0,
        goldGm: parseFloat(formData.goldGm) || 0,
        silverGm: parseFloat(formData.silverGm) || 0
      });

      if (response.data.success) {
        setResult(response.data);
        
        // --- AUTO-SAVE TO HISTORY ---
        try {
          await API.post('/save', {
            type: 'Current Zakat',
            totalWealth: response.data.totalWealth,
            zakatAmount: response.data.zakatAmount,
            dateCalculated: new Date().toISOString(),
            hijriDate: response.data.hijriDate,
            nextDueDateGregorian: response.data.nextDueDateGregorian,
            nextDueDateHijri: response.data.nextDueDateHijri
          });
        } catch (saveErr) {
          console.error("Auto-save failed:", saveErr);
        }
      } else {
        setError(response.data.message || 'Calculation failed');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatEnglishDate = (isoStr) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <Loader2 className="spinning" size={48} color="var(--primary)" />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Fetching latest market rates...</p>
      </div>
    );
  }

  if (error || !marketData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center', padding: '2rem' }}>
        <AlertCircle size={64} color="#f43f5e" style={{ marginBottom: '1.5rem' }} />
        <h2 style={{ marginBottom: '1rem' }}>Market Sync Required</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', marginBottom: '2rem' }}>
          {error || "Market rates are not yet initialized for today. Please update them in the Admin Panel or try again later."}
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Try Again</button>
            <button className="btn btn-secondary" onClick={() => navigate('/')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '4rem' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}>Zakat Calculator</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
            <Calendar size={16} color="var(--primary)" /> 
            <span style={{ fontWeight: 600 }}>{formatEnglishDate(marketData?.date)}</span> • <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{marketData?.hijriDate}</span>
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>Dashboard</button>
      </div>

      {/* Market Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <Wallet size={28} color="#f59e0b" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Gold Rate (1g)</p>
            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>
              {marketData?.goldRate ? `₹${marketData.goldRate.toLocaleString()}` : '--'}
            </h3>
          </div>
        </div>
        
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'rgba(148, 163, 184, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
            <Wallet size={28} color="#94a3b8" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Silver Rate (1g)</p>
            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>
              {marketData?.silverRate ? `₹${marketData.silverRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '--'}
            </h3>
          </div>
        </div>

        <div className="glass-card" style={{ 
          padding: '1.5rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          border: '1px solid var(--primary)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(30, 41, 59, 0.7) 100%)'
        }}>
          <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <TrendingUp size={28} color="#10b981" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Today's Nisab</p>
            <h3 style={{ margin: 0, color: 'var(--primary)' }}>
              {marketData?.nisab ? `₹${marketData.nisab.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--'}
            </h3>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left: Input Form */}
        <div className="glass-card" style={{ textAlign: 'left' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Landmark size={24} color="var(--primary)" /> Assets Information
          </h2>
          <p className="mb-6">Enter your current liquid assets below. We'll handle the conversion based on live market rates.</p>

          <form onSubmit={calculateZakat}>
            <div className="input-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BadgeDollarSign size={16} /> Total Net Cash
              </label>
              <input
                type="number"
                name="netCash"
                className="input-field"
                placeholder="₹ 0.00"
                value={formData.netCash}
                onChange={handleInputChange}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block' }}>
                Include savings, salary, and business cash. Subtract immediate debts.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="input-group">
                <label>Gold Owned (grams)</label>
                <input
                  type="number"
                  name="goldGm"
                  className="input-field"
                  placeholder="0.00g"
                  value={formData.goldGm}
                  onChange={handleInputChange}
                />
              </div>
              <div className="input-group">
                <label>Silver Owned (grams)</label>
                <input
                  type="number"
                  name="silverGm"
                  className="input-field"
                  placeholder="0.00g"
                  value={formData.silverGm}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="toggle-group mt-6" style={{ background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }} onClick={() => setHasHawl(!hasHawl)}>
              <div className={`checkbox-custom ${hasHawl ? 'checked' : ''}`} />
              <div>
                <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 500 }}>Hawl Requirement Met?</p>
                <p style={{ margin: 0, fontSize: '0.75rem' }}>I have held this wealth for 1 full lunar year.</p>
              </div>
            </div>

            {!hasHawl && (
              <div className="warning-banner mt-4">
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  <strong>Note:</strong> Since Hawl is not met, your Zakat obligation will be ₹0.00.
                </p>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full mt-6" disabled={loading}>
              {loading ? <Loader2 className="spinning" /> : <><Calculator size={20} /> Calculate My Zakat</>}
            </button>
          </form>
        </div>

        {/* Right: Results / Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {result ? (
            <div className="glass-card fade-in" style={{ 
              border: result.isEligible ? '1px solid var(--primary)' : '1px solid var(--accent)',
              background: result.isEligible ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                {result.isEligible ? (
                  <CheckCircle2 size={56} color="var(--primary)" style={{ margin: '0 auto' }} />
                ) : (
                  <Info size={56} color="var(--accent)" style={{ margin: '0 auto' }} />
                )}
              </div>

              <h3 style={{ marginBottom: '0.5rem' }}>{result.isEligible ? 'Zakat is Obligatory' : 'No Zakat Due'}</h3>
              
              <div style={{ 
                fontSize: '3rem', 
                fontWeight: 800, 
                color: result.isEligible ? 'var(--primary)' : 'var(--text-muted)',
                marginBottom: '1rem'
              }}>
                ₹{result.zakatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '16px', padding: '1.25rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Wealth</span>
                  <span style={{ fontWeight: 600 }}>₹{result.totalWealth.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Nisab Threshold</span>
                  <span style={{ fontWeight: 600 }}>₹{result.nisab.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              textAlign: 'center',
              borderStyle: 'dashed',
              background: 'transparent',
              padding: '3rem'
            }}>
              <Zap size={48} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <h3 style={{ color: 'var(--text-muted)' }}>Ready to Calculate</h3>
              <p style={{ fontSize: '0.875rem' }}>Enter your assets to see your obligation based on today's rates.</p>
            </div>
          )}

          <div className="glass-card" style={{ 
            background: 'rgba(245, 158, 11, 0.03)', 
            borderColor: 'rgba(245, 158, 11, 0.2)',
            textAlign: 'left'
          }}>
            <h4 style={{ color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={16} /> How is Nisab calculated?
            </h4>
            <p style={{ fontSize: '0.8125rem', margin: 0 }}>
              The Nisab is calculated as <strong>612.36g of Silver</strong>. 
              Today's silver rate is {marketData?.silverRate ? `₹${marketData.silverRate}/g` : '--'}, making the threshold {marketData?.nisab ? `₹${marketData.nisab.toLocaleString()}` : '--'}.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
