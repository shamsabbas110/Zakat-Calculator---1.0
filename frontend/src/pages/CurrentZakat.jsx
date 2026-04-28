import React, { useState } from 'react';
import { Calculator, Loader2, CalendarDays, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gregorianToHijri, hijriToGregorian, saveCurrentZakat } from '../services/api';
import '../styles/Forms.css';

/**
 * CurrentZakat — Calculates current-year Zakat obligation.
 *
 * NEW FEATURES:
 *  1. Date picker — "When did your wealth reach Nisab?"
 *  2. AlAdhan gToH — converts that date to a Hijri date
 *  3. Computes the next Hawl due date (Hijri year + 1, day - 1) via hToG
 *  4. Shows a rich success message with both next Gregorian + Hijri dates
 *  5. POSTs all data to /api/zakat/current
 */
export default function CurrentZakat() {
  const navigate = useNavigate();

  /* ── FORM INPUTS ── */
  const [nisabDate, setNisabDate]     = useState('');   // "YYYY-MM-DD" from <input type="date">
  const [savings, setSavings]         = useState('');
  const [goldValue, setGoldValue]     = useState('');
  const [silverValue, setSilverValue] = useState('');

  /* ── RESULT STATE ── */
  const [calculatedZakat, setCalculatedZakat] = useState(null);
  const [nextDueInfo, setNextDueInfo]         = useState(null);  // { gregorian, hijri }

  /* ── UI STATE ── */
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [savedToDB, setSavedToDB] = useState(false);

  /* ═══════════════════════════════════════════════════════
     HELPER: convert "YYYY-MM-DD" (HTML date input)
             → "DD-MM-YYYY" (AlAdhan API format)
  ═══════════════════════════════════════════════════════ */
  const toApiFormat = (iso) => {
    const [yyyy, mm, dd] = iso.split('-');
    return `${dd}-${mm}-${yyyy}`;
  };

  /* ═══════════════════════════════════════════════════════
     HANDLE CALCULATE + SAVE
  ═══════════════════════════════════════════════════════ */
  const handleCalculate = async (e) => {
    e.preventDefault();
    setError('');
    setSavedToDB(false);
    setNextDueInfo(null);
    setCalculatedZakat(null);

    if (!nisabDate) {
      setError('Please select the date your wealth reached Nisab.');
      return;
    }

    const s   = parseFloat(savings)     || 0;
    const g   = parseFloat(goldValue)   || 0;
    const sil = parseFloat(silverValue) || 0;
    const totalWealth  = s + g + sil;
    const zakatAmount  = totalWealth * 0.025;

    setLoading(true);

    try {
      /* ── STEP 1: Gregorian → Hijri for the Nisab date ── */
      const apiDate  = toApiFormat(nisabDate);
      const hijriNow = await gregorianToHijri(apiDate);

      // hijriNow = { day: "09", monthNum: 9, monthEn: "Ramaḍān", year: "1438" }
      const currentHijriDay   = parseInt(hijriNow.day,  10);
      const currentHijriMonth = hijriNow.monthNum;
      const currentHijriYear  = parseInt(hijriNow.year, 10);

      /* ── STEP 2: Next Hawl date = Hijri year + 1, day - 1 ── */
      // Subtracting 1 day is the traditional scholarly opinion for the Hawl
      // completion date (one full lunar year has elapsed).
      const nextHijriYear = currentHijriYear + 1;
      const nextHijriDay  = currentHijriDay > 1 ? currentHijriDay - 1 : 1;

      /* ── STEP 3: Convert next Hijri due date → Gregorian ── */
      const nextGreg = await hijriToGregorian(nextHijriDay, currentHijriMonth, nextHijriYear);

      // e.g. { month: "June", year: "2018", display: "June 2018" }
      const nextHijriDisplay = `${nextHijriDay} ${hijriNow.monthEn} ${nextHijriYear} AH`;

      setNextDueInfo({ gregorian: nextGreg.display, hijri: nextHijriDisplay });
      setCalculatedZakat(zakatAmount);

      /* ── STEP 4: Build payload and POST to backend ── */
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });

      const payload = {
        // Wealth breakdown
        cash:        s,
        gold:        g,
        silver:      sil,
        totalWealth,
        zakatAmount,
        type:        'Current Zakat',

        // 🟢 CORRECTED: These exact names are required by MongoDB
        hijriDate: `${hijriNow.day} ${hijriNow.monthEn} ${currentHijriYear} AH`,
        gregorianDate: nisabDate,

        // Next due date (Hawl anniversary)
        nextDueDateHijri:     nextHijriDisplay,
        nextDueDateGregorian: nextGreg.display,

        dateCalculated: today,
      };

      try {
        // 🔍 DEBUG — Open browser Console (F12) to see the exact payload
        console.log('FINAL PAYLOAD:', JSON.stringify(payload, null, 2));
        await saveCurrentZakat(payload);
        setSavedToDB(true);
      } catch (backendErr) {
        // Backend offline — still show result, log warning
        console.warn('Backend save failed, using localStorage fallback.', backendErr?.message);
        console.error('Backend error details:', backendErr?.response?.data);
      }

      /* ── localStorage fallback (always runs) ── */
      const record = {
        id:                  Date.now(),
        type:                'Current Zakat',
        totalWealth,
        zakatAmount,
        dateCalculated:      today,
        nextDueDateGregorian: nextGreg.display,
        nextDueDateHijri:    nextHijriDisplay,
      };
      const existing = JSON.parse(localStorage.getItem('zakatHistory') || '[]');
      localStorage.setItem('zakatHistory', JSON.stringify([record, ...existing]));

    } catch (err) {
      console.error(err);
      setError('Could not fetch Hijri dates from AlAdhan API. Check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="form-page-container">

      {/* Header */}
      <div className="form-header">
        <h1>Current Year Zakat ({new Date().getFullYear()})</h1>
        <p>Enter your wealth details and Nisab date to calculate your obligation and next due date.</p>
      </div>

      <div className="form-card">
        <form onSubmit={handleCalculate}>

          {/* ── Date Picker ── */}
          <div className="input-group">
            <label htmlFor="nisab-date">
              <CalendarDays size={14} style={{ display:'inline', marginRight:'0.4rem', verticalAlign:'middle' }} />
              When did your wealth first reach Nisab?
            </label>
            <input
              id="nisab-date"
              type="date"
              className="input-field"
              value={nisabDate}
              onChange={e => setNisabDate(e.target.value)}
              max={(() => {
                // Use LOCAL timezone — toISOString() returns UTC which can be
                // yesterday's date for users east of UTC (e.g. IST = UTC+5:30)
                const t = new Date();
                return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
              })()}
              required
            />
            <span className="field-hint">
              This date starts your Hawl (1-year lunar cycle). We'll calculate your next due date automatically.
            </span>
          </div>

          {/* ── Wealth Inputs ── */}
          <div className="input-group">
            <label htmlFor="savings">Cash &amp; Savings (after expenses) ₹</label>
            <input
              id="savings"
              type="number"
              className="input-field"
              placeholder="e.g. 50000"
              value={savings}
              min="0" step="0.01"
              onChange={e => setSavings(e.target.value)}
            />
          </div>

          <div className="input-row">
            <div className="input-group half">
              <label htmlFor="gold">Gold Value (current market) ₹</label>
              <input
                id="gold"
                type="number"
                className="input-field"
                placeholder="e.g. 25000"
                value={goldValue}
                min="0" step="0.01"
                onChange={e => setGoldValue(e.target.value)}
              />
            </div>
            <div className="input-group half">
              <label htmlFor="silver">Silver Value (current market) ₹</label>
              <input
                id="silver"
                type="number"
                className="input-field"
                placeholder="e.g. 8000"
                value={silverValue}
                min="0" step="0.01"
                onChange={e => setSilverValue(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full mt-4"
            disabled={loading}
          >
            {loading
              ? <><Loader2 size={16} className="spinning" />&nbsp; Fetching Hijri Dates...</>
              : <><Calculator size={16} />&nbsp; Calculate &amp; Save Zakat</>
            }
          </button>
        </form>

        {/* ── Error Banner ── */}
        {error && (
          <div className="form-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Result Box ── */}
        {calculatedZakat !== null && (
          <div className="result-box mt-6">
            <h3>Your Zakat Obligation</h3>
            <div className="result-amount">₹{calculatedZakat.toFixed(2)}</div>
            <p className="result-note">2.5% of total entered wealth</p>
          </div>
        )}

        {/* ── Success + Next Due Date Banner ── */}
        {nextDueInfo && (
          <div className="form-success-banner">
            <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
            <div>
              <strong>
                {savedToDB ? 'Saved to Database! ✓' : 'Calculated! (Saved Locally)'}
              </strong>
              <p>
                Your next Zakat will be due on{' '}
                <span className="highlight-gold">{nextDueInfo.gregorian}</span>
                {' '}/ <span className="highlight-gold">{nextDueInfo.hijri}</span>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="form-nav">
        <button className="btn-secondary" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
        <button className="btn-secondary" onClick={() => navigate('/missed')}>
          Calculate Missed Zakat →
        </button>
      </div>

    </div>
  );
}
