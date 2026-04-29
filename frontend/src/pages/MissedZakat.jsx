import React, { useState } from 'react';
import { 
  History, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  TrendingUp,
  Calendar,
  Wallet,
  ArrowRight,
  ArrowLeft,
  Coins,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

// Helper to force English numerals (scrub any Arabic/Urdu digits)
const forceEnglishNumerals = (str) => {
  if (!str) return '';
  const map = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return str.replace(/[٠-٩]/g, (d) => map[d]);
};

export default function MissedZakat() {
  const navigate = useNavigate();

  // --- STATE ---
  const [step, setStep] = useState('setup'); 
  const [yearsCount, setYearsCount] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [wealthArray, setWealthArray] = useState([{ cash: '', goldGm: '', silverGm: '' }]);
  const [yearDates, setYearDates] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  
  // Accumulated history for multi-part journeys
  const [accumulatedZakat, setAccumulatedZakat] = useState(0);
  const [pastBreakdowns, setPastBreakdowns] = useState([]);

  // --- HANDLERS ---
  const handleYearsChange = (e) => {
    const count = parseInt(e.target.value);
    setYearsCount(count);
    const newArray = [...wealthArray];
    if (count > wealthArray.length) {
      for (let i = wealthArray.length; i < count; i++) {
        newArray.push({ cash: '', goldGm: '', silverGm: '' });
      }
    } else {
      newArray.length = count;
    }
    setWealthArray(newArray);
  };

  const handleFieldChange = (index, field, value) => {
    setWealthArray(prev => {
      const newArray = [...prev];
      if (!newArray[index]) {
        newArray[index] = { cash: '', goldGm: '', silverGm: '' };
      }
      newArray[index] = { ...newArray[index], [field]: value };
      return newArray;
    });
  };

  const fetchDates = async (countOverride = null) => {
    if (!startDate) return;
    const finalCount = countOverride !== null ? countOverride : yearsCount;
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/past-dates', { startDate, yearsCount: finalCount });
      if (res.data.success) {
        if (res.data.dates.length === 0) {
            setError('The dates for this period are in the future. Please pick an older start date.');
            setLoading(false);
            return;
        }
        
        const validDates = res.data.dates;
        setYearDates(validDates);
        
        // --- ROBUST SYNC: Ensure wealthArray matches validDates length ---
        setWealthArray(prev => {
            let newArr = [...prev];
            if (newArr.length < validDates.length) {
                for (let i = newArr.length; i < validDates.length; i++) {
                    newArr.push({ cash: '', goldGm: '', silverGm: '' });
                }
            } else {
                newArr = newArr.slice(0, validDates.length);
            }
            return newArr;
        });

        setStep('wealth');
      }
    } catch (err) {
      setError('Could not calculate dates. Please check your start date.');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await API.post('/past-bulk', {
        startDate,
        yearsCount: yearDates.length, 
        wealthArray
      });

      if (response.data.success) {
        setResult(response.data);
        setStep('result');
        // --- DELAYED SAVE: Only save to DB if the journey is complete (no cycle break) ---
        if (!response.data.cycleBroken) {
          try {
            // Calculate total cumulative wealth across all years (past segments + current segment)
            const combinedBreakdown = [...pastBreakdowns, ...response.data.yearlyBreakdown];
            const cumulativeWealth = combinedBreakdown.reduce((sum, y) => sum + (y.userWealth || 0), 0);

            await API.post('/save', {
              type: 'Missed Zakat (Bulk)',
              totalWealth: cumulativeWealth,
              zakatAmount: (accumulatedZakat + (response.data.totalPendingZakat || 0)),
              dateCalculated: new Date().toISOString(),
              hijriDate: response.data.yearlyBreakdown[response.data.yearlyBreakdown.length - 1]?.hijriDate || ''
            });
          } catch (saveErr) {
            console.error("Final save failed:", saveErr);
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    // 1. Accumulate previous Zakat and breakdown
    setAccumulatedZakat(prev => prev + (result.totalPendingZakat || 0));
    setPastBreakdowns(prev => [...prev, ...result.yearlyBreakdown]);

    // 2. Calculate remaining years
    const remaining = yearsCount - result.brokenAtYear;
    const finalNewCount = remaining > 0 ? remaining : 1;
    
    // 3. Update yearsCount state and fetch new dates
    setYearsCount(finalNewCount);
    fetchDates(finalNewCount); // Pass directly to avoid async state delay
  };

  const handleFullReset = () => {
    setStep('setup');
    setAccumulatedZakat(0);
    setPastBreakdowns([]);
    setResult(null);
    setWealthArray([{ cash: '', goldGm: '', silverGm: '' }]);
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 40px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* --- HEADER --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Zakat Time Machine</h2>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.2rem' }}>
            <AlertTriangle size={12} /> Rates supported: 2021 - {new Date().getFullYear()}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Dashboard
        </button>
      </div>

      {/* --- STEPPER --- */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
        <div style={{ opacity: step === 'setup' ? 1 : 0.5, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: step === 'setup' ? 'var(--primary)' : 'var(--border)', color: 'white', textAlign: 'center', lineHeight: '20px', fontSize: '0.7rem' }}>1</div>
          <span>Setup</span>
        </div>
        <div style={{ opacity: step === 'wealth' ? 1 : 0.5, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: step === 'wealth' ? 'var(--primary)' : 'var(--border)', color: 'white', textAlign: 'center', lineHeight: '20px', fontSize: '0.7rem' }}>2</div>
          <span>Wealth</span>
        </div>
        <div style={{ opacity: step === 'result' ? 1 : 0.5, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: step === 'result' ? 'var(--primary)' : 'var(--border)', color: 'white', textAlign: 'center', lineHeight: '20px', fontSize: '0.7rem' }}>3</div>
          <span>Result</span>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scroll">
        
        {step === 'setup' && (
          <div className="glass-card fade-in" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}
            <div className="input-group">
              <label style={{ fontSize: '0.85rem' }}>Duration (Years Pending)</label>
              <select className="input-field" value={yearsCount} onChange={handleYearsChange} style={{ height: '45px' }}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} Year{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ marginTop: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Initial Nisab Date</label>
              <input 
                type="date" 
                className="input-field" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                max={new Date().toISOString().split('T')[0]}
                required 
                style={{ height: '45px' }} 
              />
            </div>
            <button className="btn btn-primary w-full mt-6" style={{ height: '50px' }} onClick={() => fetchDates()} disabled={!startDate || loading}>
              {loading ? <Loader2 className="spinning" /> : <>Next Step <ArrowRight size={18} /></>}
            </button>
          </div>
        )}

        {step === 'wealth' && (
          <div style={{ maxWidth: '850px', margin: '0 auto' }}>
            {accumulatedZakat > 0 && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--accent)', fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>
                    <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Already Saved: ₹{accumulatedZakat.toLocaleString()} from previous years.
                </div>
            )}
            <form onSubmit={handleCalculate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {yearDates.map((dateObj, index) => (
                  <div key={index} className="glass-card fade-in" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ width: '160px' }}>
                       <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)', textTransform: 'uppercase' }}>YEAR {index + 1}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>{forceEnglishNumerals(dateObj.hijri)}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>({forceEnglishNumerals(dateObj.gregorian)})</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', flex: 1 }}>
                      {dateObj.isFuture ? (
                        <div style={{ gridColumn: 'span 3', background: 'rgba(245, 158, 11, 0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed #f59e0b', color: '#f59e0b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                          <Loader2 size={16} className="spinning" /> Wait for some time to be eligible for this year.
                        </div>
                      ) : (
                        <>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <input type="number" className="input-field" placeholder="Cash ₹" value={wealthArray[index]?.cash || ''} onChange={(e) => handleFieldChange(index, 'cash', e.target.value)} required style={{ height: '40px', fontSize: '0.9rem' }} />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <input type="number" className="input-field" placeholder="Gold (g)" value={wealthArray[index]?.goldGm || ''} onChange={(e) => handleFieldChange(index, 'goldGm', e.target.value)} required style={{ height: '40px', fontSize: '0.9rem' }} />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <input type="number" className="input-field" placeholder="Silver (g)" value={wealthArray[index]?.silverGm || ''} onChange={(e) => handleFieldChange(index, 'silverGm', e.target.value)} required style={{ height: '40px', fontSize: '0.9rem' }} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary w-full" onClick={() => setStep('setup')} style={{ height: '45px' }}>Back</button>
                <button type="submit" className="btn btn-primary w-full" style={{ height: '45px' }} disabled={loading}>
                  {loading ? <Loader2 className="spinning" /> : 'Calculate Zakat'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'result' && result && (
          <div style={{ maxWidth: '850px', margin: '0 auto' }}>
            <div className="glass-card mb-4" style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent)' }}>
              <h1 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--accent)' }}>₹{(accumulatedZakat + (result.totalPendingZakat || 0)).toLocaleString()}</h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Pending Zakat</p>
              {accumulatedZakat > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.5rem', opacity: 0.8 }}>
                  (Cycle 1: ₹{accumulatedZakat.toLocaleString()} + Current Cycle: ₹{(result.totalPendingZakat || 0).toLocaleString()})
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Show past breakdowns if any */}
              {[...pastBreakdowns, ...result.yearlyBreakdown].map((year, idx) => (
                <div key={idx} className="glass-card" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: idx < pastBreakdowns.length ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, background: year.status === 'Eligible' ? 'var(--primary)' : '#ef4444', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>YEAR {idx+1}</div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>{forceEnglishNumerals(year.hijriDate) || year.status}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        ({forceEnglishNumerals(year.gregorianDate ? year.gregorianDate.split('T')[0].split('-').reverse().join('-') : '')})
                      </p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Wealth: ₹{(year.userWealth || 0).toLocaleString()} • Nisab: ₹{(year.nisab || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <h3 style={{ margin: 0, color: year.status === 'Eligible' ? 'var(--accent)' : 'var(--text-muted)', fontSize: '1.5rem' }}>₹{(year.zakatAmount || 0).toLocaleString()}</h3>
                </div>
              ))}
              
              {result.cycleBroken && (
                <div className="glass-card" style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', marginTop: '0.5rem' }}>
                  <p style={{ color: '#ef4444', margin: '0 0 0.75rem', fontSize: '0.85rem' }}>
                    <strong>Cycle Broken!</strong> Wealth fell below Nisab in Year {pastBreakdowns.length + result.brokenAtYear}. 
                    Select a new start date to continue:
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)} 
                      style={{ height: '35px', fontSize: '0.8rem', flex: 1, border: '1px solid #ef4444' }} 
                    />
                    <button 
                      className="btn btn-primary"
                      disabled={!startDate || loading}
                      onClick={handleRestart}
                      style={{ background: '#ef4444', border: 'none', height: '35px', fontSize: '0.8rem', padding: '0 1rem' }}
                    >
                      Restart Journey
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingBottom: '2rem' }}>
              <button className="btn btn-secondary w-full" onClick={handleFullReset}>Full Reset</button>
              <button className="btn btn-primary w-full" onClick={() => navigate('/')}>Dashboard</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
