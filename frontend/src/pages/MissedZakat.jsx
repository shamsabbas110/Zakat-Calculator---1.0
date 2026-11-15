import { useState } from 'react';
import { 
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import '../styles/MissedZakat.css';

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
    } catch {
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
    setAccumulatedZakat(prev => prev + (result.totalPendingZakat || 0));
    setPastBreakdowns(prev => [...prev, ...result.yearlyBreakdown]);

    const remaining = yearsCount - result.brokenAtYear;
    const finalNewCount = remaining > 0 ? remaining : 1;
    
    setYearsCount(finalNewCount);
    fetchDates(finalNewCount);
  };

  const handleFullReset = () => {
    setStep('setup');
    setAccumulatedZakat(0);
    setPastBreakdowns([]);
    setResult(null);
    setWealthArray([{ cash: '', goldGm: '', silverGm: '' }]);
  };

  return (
    <div className="missed-zakat-container fade-in">
      
      {/* --- HEADER --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>Zakat Time Machine</h2>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertTriangle size={13} /> Rates supported: 2021 - {new Date().getFullYear()}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Dashboard
        </button>
      </div>

      {/* --- STEPPER --- */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginBottom: '1.75rem', fontSize: '0.85rem' }}>
        <div style={{ opacity: step === 'setup' ? 1 : 0.45, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: step === 'setup' ? '#10b981' : '#333', color: 'white', textAlign: 'center', lineHeight: '22px', fontSize: '0.75rem', fontWeight: 700 }}>1</div>
          <span style={{ fontWeight: step === 'setup' ? 700 : 500 }}>Setup</span>
        </div>
        <div style={{ opacity: step === 'wealth' ? 1 : 0.45, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: step === 'wealth' ? '#10b981' : '#333', color: 'white', textAlign: 'center', lineHeight: '22px', fontSize: '0.75rem', fontWeight: 700 }}>2</div>
          <span style={{ fontWeight: step === 'wealth' ? 700 : 500 }}>Wealth</span>
        </div>
        <div style={{ opacity: step === 'result' ? 1 : 0.45, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: step === 'result' ? '#10b981' : '#333', color: 'white', textAlign: 'center', lineHeight: '22px', fontSize: '0.75rem', fontWeight: 700 }}>3</div>
          <span style={{ fontWeight: step === 'result' ? 700 : 500 }}>Result</span>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div>
        
        {step === 'setup' && (
          <div className="glass-card fade-in" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}
            <div className="input-group">
              <label style={{ fontSize: '0.85rem' }}>Duration (Years Pending)</label>
              <select className="input-field" value={yearsCount} onChange={handleYearsChange} style={{ height: '46px' }}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} Year{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Initial Nisab Date</label>
              <input 
                type="date" 
                className="input-field" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                max={new Date().toISOString().split('T')[0]}
                required 
                style={{ height: '46px' }} 
              />
            </div>
            <button className="btn btn-primary w-full mt-6" style={{ height: '48px' }} onClick={() => fetchDates()} disabled={!startDate || loading}>
              {loading ? <Loader2 className="spinning" size={18} /> : <>Next Step <ArrowRight size={18} /></>}
            </button>
          </div>
        )}

        {step === 'wealth' && (
          <div style={{ maxWidth: '850px', margin: '0 auto' }}>
            {accumulatedZakat > 0 && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem', border: '1px solid #10b981', fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                    <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Already Saved: ₹{accumulatedZakat.toLocaleString()} from previous years.
                </div>
            )}
            <form onSubmit={handleCalculate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {yearDates.map((dateObj, index) => (
                  <div key={index} className="glass-card missed-year-card fade-in">
                    <div className="missed-year-badge">
                       <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#10b981', textTransform: 'uppercase' }}>YEAR {index + 1}</div>
                       <div>
                         <div style={{ fontSize: '0.75rem', color: '#ffffff', marginTop: '0.15rem' }}>{forceEnglishNumerals(dateObj.hijri)}</div>
                         <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>({forceEnglishNumerals(dateObj.gregorian)})</div>
                       </div>
                    </div>
                    <div className="missed-year-inputs">
                      {dateObj.isFuture ? (
                        <div style={{ gridColumn: '1 / -1', background: 'rgba(245, 158, 11, 0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed #f59e0b', color: '#f59e0b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                          <Loader2 size={16} className="spinning" /> Wait for some time to be eligible for this year.
                        </div>
                      ) : (
                        <>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <input type="number" className="input-field" placeholder="Cash ₹" value={wealthArray[index]?.cash || ''} onChange={(e) => handleFieldChange(index, 'cash', e.target.value)} required style={{ height: '42px', fontSize: '0.9rem' }} />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <input type="number" className="input-field" placeholder="Gold (g)" value={wealthArray[index]?.goldGm || ''} onChange={(e) => handleFieldChange(index, 'goldGm', e.target.value)} required style={{ height: '42px', fontSize: '0.9rem' }} />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <input type="number" className="input-field" placeholder="Silver (g)" value={wealthArray[index]?.silverGm || ''} onChange={(e) => handleFieldChange(index, 'silverGm', e.target.value)} required style={{ height: '42px', fontSize: '0.9rem' }} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep('setup')} style={{ flex: 1, minHeight: '46px' }}>Back</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, minHeight: '46px' }} disabled={loading}>
                  {loading ? <Loader2 className="spinning" size={18} /> : 'Calculate Zakat'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'result' && result && (
          <div style={{ maxWidth: '850px', margin: '0 auto' }}>
            <div className="glass-card mb-4" style={{ padding: '1.75rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981' }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 2.75rem)', color: '#10b981', fontWeight: 900 }}>
                ₹{(accumulatedZakat + (result.totalPendingZakat || 0)).toLocaleString()}
              </h1>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600 }}>Total Pending Zakat</p>
              {accumulatedZakat > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.5rem', opacity: 0.9 }}>
                  (Cycle 1: ₹{accumulatedZakat.toLocaleString()} + Current Cycle: ₹{(result.totalPendingZakat || 0).toLocaleString()})
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {[...pastBreakdowns, ...result.yearlyBreakdown].map((year, idx) => (
                <div key={idx} className="glass-card missed-result-item" style={{ opacity: idx < pastBreakdowns.length ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, background: year.status === 'Eligible' ? '#10b981' : '#ef4444', color: 'white', padding: '0.35rem 0.75rem', borderRadius: '6px' }}>
                      YEAR {idx+1}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{forceEnglishNumerals(year.hijriDate) || year.status}</h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>
                        ({forceEnglishNumerals(year.gregorianDate ? year.gregorianDate.split('T')[0].split('-').reverse().join('-') : '')})
                      </p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                        Wealth: ₹{(year.userWealth || 0).toLocaleString()} • Nisab: ₹{(year.nisab || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <h3 className="missed-result-amount" style={{ color: year.status === 'Eligible' ? '#f59e0b' : '#6b7280' }}>
                    ₹{(year.zakatAmount || 0).toLocaleString()}
                  </h3>
                </div>
              ))}
              
              {result.cycleBroken && (
                <div className="glass-card" style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', padding: '1.25rem', marginTop: '0.75rem' }}>
                  <p style={{ color: '#ef4444', margin: '0 0 0.75rem', fontSize: '0.85rem' }}>
                    <strong>Cycle Broken!</strong> Wealth fell below Nisab in Year {pastBreakdowns.length + result.brokenAtYear}. 
                    Select a new start date to continue:
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)} 
                      style={{ height: '40px', fontSize: '0.85rem', flex: 1, minWidth: '180px', border: '1px solid #ef4444' }} 
                    />
                    <button 
                      className="btn btn-primary"
                      disabled={!startDate || loading}
                      onClick={handleRestart}
                      style={{ background: '#ef4444', border: 'none', height: '40px', fontSize: '0.85rem', padding: '0 1rem' }}
                    >
                      Restart Journey
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingBottom: '2rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={handleFullReset} style={{ flex: 1, minHeight: '46px' }}>Full Reset</button>
              <button className="btn btn-primary" onClick={() => navigate('/')} style={{ flex: 1, minHeight: '46px' }}>Dashboard</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
