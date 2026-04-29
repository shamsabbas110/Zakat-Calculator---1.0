import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Lock, 
  RefreshCw, 
  TrendingUp,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function Admin() {
  const navigate = useNavigate();
  const [step, setStep] = useState('auth'); 
  const [password, setPassword] = useState('');
  const [goldRate, setGoldRate] = useState('');
  const [silverRate, setSilverRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [marketData, setMarketData] = useState(null);

  useEffect(() => {
    if (step === 'form') fetchMarketData();
  }, [step]);

  const fetchMarketData = async () => {
    try {
      const res = await API.get('/rates');
      if (res.data.success) {
        setMarketData(res.data);
        setGoldRate(res.data.goldRate || '');
        setSilverRate(res.data.silverRate || '');
      }
    } catch (err) {}
  };

  const handleAuth = (e) => {
    e.preventDefault();
    if (password === 'admin110') setStep('form');
    else setMessage({ type: 'error', text: 'Incorrect Password' });
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    const today = new Date().toISOString().split('T')[0];
    try {
      await API.post('/admin/update-rates-manual', { 
        date: today, 
        goldRatePerGram: parseFloat(goldRate), 
        silverRatePerGram: parseFloat(silverRate) 
      });
      setMessage({ type: 'success', text: 'Rates Published Successfully' });
      fetchMarketData();
    } catch (err) { setMessage({ type: 'error', text: 'Failed to update' }); }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await API.post('/admin/update-rates');
      setMessage({ type: 'success', text: 'Synced' });
      fetchMarketData();
    } catch (err) { setMessage({ type: 'error', text: 'Market Not Ready' }); }
    setSyncLoading(false);
  };

  if (step === 'auth') {
    return (
      <div style={{ height: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', overflow: 'hidden' }}>
        <div className="glass-card" style={{ width: '400px', padding: '3rem', background: '#121214', borderRadius: '1.5rem', border: '1px solid #27272a', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                <Lock size={32} color="#10b981" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Admin Panel</h2>
            <p style={{ color: '#71717a', fontSize: '0.9rem', marginBottom: '2.5rem' }}>Enter password to continue</p>
            <form onSubmit={handleAuth}>
                <input type="password" placeholder="Password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ height: '50px', borderRadius: '0.75rem', textAlign: 'center', background: '#18181b', border: '1px solid #27272a' }} />
                <button className="btn btn-primary w-full mt-4" style={{ height: '50px', borderRadius: '0.75rem', fontWeight: 600 }}>Login</button>
            </form>
            {message.text && <p style={{ color: '#f43f5e', marginTop: '1.5rem', fontSize: '0.8rem' }}>{message.text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%', background: '#09090b', color: '#f4f4f5', display: 'flex', flexDirection: 'column', overflow: 'hidden', alignItems: 'center' }}>
      
      {/* HEADER - ABSOLUTE CENTERED CONTENT */}
      <div style={{ width: '100%', height: '70px', borderBottom: '1px solid #18181b', background: '#0c0c0e', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={24} color="#10b981" />
                <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Admin Dashboard</h1>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')} style={{ borderRadius: '6px', fontSize: '0.8rem' }}>
                <ArrowLeft size={14} /> Exit
            </button>
        </div>
      </div>

      {/* MAIN CONTENT - CENTERED VERTICALLY AND HORIZONTALLY */}
      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* STATUS BAR */}
            <div style={{ background: '#0c0c0e', padding: '15px 25px', borderRadius: '12px', border: '1px solid #18181b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <p style={{ margin: 0, fontSize: '0.6rem', color: '#52525b', fontWeight: 800, letterSpacing: '1px' }}>MARKET STATE ({syncLoading ? 'REFRESHING...' : (marketData?.hijriDate || '...')})</p>
                    <div style={{ display: 'flex', gap: '25px', marginTop: '5px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a1a1aa' }}>GOLD: <span style={{ color: '#10b981' }}>{syncLoading ? '...' : `₹${marketData?.goldRate || '--'}`}</span></span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a1a1aa' }}>SILVER: <span style={{ color: '#10b981' }}>{syncLoading ? '...' : `₹${marketData?.silverRate || '--'}`}</span></span>
                    </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncLoading} style={{ fontSize: '0.75rem', gap: '6px', background: '#18181b' }}>
                    {syncLoading ? <Loader2 size={12} className="spinning" /> : <RefreshCw size={12} />} Auto-Sync
                </button>
            </div>

            {/* INPUT BLOCKS */}
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    {/* GOLD BLOCK */}
                    <div style={{ background: '#121214', padding: '30px', borderRadius: '20px', border: '1px solid #18181b', textAlign: 'center' }}>
                        <div style={{ width: '40px', height: '40px', background: 'rgba(234, 179, 8, 0.05)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                            <TrendingUp size={20} color="#eab308" />
                        </div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#52525b', marginBottom: '15px', letterSpacing: '1px' }}>TODAY'S GOLD RATE (1G)</label>
                        <div style={{ position: 'relative', width: '100%', maxWidth: '240px', margin: '0 auto' }}>
                            <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#3f3f46' }}>₹</span>
                            <input type="number" step="0.01" value={goldRate} onChange={(e) => setGoldRate(e.target.value)} required placeholder="0.00" style={{ width: '100%', height: '55px', background: '#09090b', border: '1px solid #18181b', borderRadius: '12px', color: '#fff', fontSize: '1.5rem', textAlign: 'center', fontWeight: 800 }} />
                        </div>
                    </div>

                    {/* SILVER BLOCK */}
                    <div style={{ background: '#121214', padding: '30px', borderRadius: '20px', border: '1px solid #18181b', textAlign: 'center' }}>
                        <div style={{ width: '40px', height: '40px', background: 'rgba(161, 161, 170, 0.05)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                            <TrendingUp size={20} color="#a1a1aa" />
                        </div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#52525b', marginBottom: '15px', letterSpacing: '1px' }}>TODAY'S SILVER RATE (1G)</label>
                        <div style={{ position: 'relative', width: '100%', maxWidth: '240px', margin: '0 auto' }}>
                            <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#3f3f46' }}>₹</span>
                            <input type="number" step="0.01" value={silverRate} onChange={(e) => setSilverRate(e.target.value)} required placeholder="0.00" style={{ width: '100%', height: '55px', background: '#09090b', border: '1px solid #18181b', borderRadius: '12px', color: '#fff', fontSize: '1.5rem', textAlign: 'center', fontWeight: 800 }} />
                        </div>
                    </div>
                </div>

                {/* ACTION BUTTON */}
                <div style={{ textAlign: 'center' }}>
                    <button className="btn btn-primary" style={{ padding: '15px 60px', fontSize: '1rem', fontWeight: 800, borderRadius: '12px' }} disabled={loading}>
                        {loading ? <Loader2 className="spinning" /> : 'Publish New Rates'}
                    </button>
                    {message.text && (
                        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: message.type === 'error' ? '#f43f5e' : '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>
                            {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message.text}
                        </div>
                    )}
                </div>
            </form>

            {/* NISAB PREVIEW */}
            <div style={{ padding: '20px 0', borderTop: '1px solid #18181b', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px' }}>
                <span style={{ fontSize: '0.75rem', color: '#52525b', fontWeight: 800, letterSpacing: '1px' }}>PREDICTED NISAB</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981' }}>₹{(parseFloat(silverRate) * 612.36 || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>

        </div>
      </div>
    </div>
  );
}
