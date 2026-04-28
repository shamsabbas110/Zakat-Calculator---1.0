import React, { useState } from 'react';
import { gregorianToHijri, hijriToGregorian, getCurrentHijriYear, submitPastZakat } from '../services/api';
import '../styles/MissedZakat.css';

/**
 * MissedZakat — Time-Travel Past Zakat Wizard
 *
 * FLOW:
 *  Step 1 → User picks the Gregorian date wealth first hit Nisab
 *  Step 2 → API converts it to Hijri; we loop through each anniversary
 *           year and let the user enter their wealth for that date
 *  Step 3 → Results: total missed Zakat + yearly breakdown
 */
export default function MissedZakat() {

  /* ── STEP STATE ── */
  const [step, setStep] = useState(1);          // 1 | 2 | 3

  /* ── STEP 1 STATE ── */
  const [nisabDate, setNisabDate]   = useState(''); // HTML date input = "YYYY-MM-DD"
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  /* ── STEP 2 STATE ── */
  // Array of yearly cards generated after API calls
  const [yearCards, setYearCards] = useState([]);

  /* ── STEP 3 STATE ── */
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);

  /* ═══════════════════════════════════════════════
     HELPER: convert "YYYY-MM-DD" → "DD-MM-YYYY"
     (AlAdhan API expects DD-MM-YYYY format)
  ═══════════════════════════════════════════════ */
  const toApiFormat = (isoDate) => {
    const [yyyy, mm, dd] = isoDate.split('-');
    return `${dd}-${mm}-${yyyy}`;
  };

  /* ═══════════════════════════════════════════════
     STEP 1 → STEP 2
     1. Convert the user's Gregorian date to Hijri.
     2. Get the current Hijri year.
     3. For every Hijri anniversary (year+1, year+2 …),
        call hToG to find the approx Gregorian equivalent.
     4. Build the yearCards array.
  ═══════════════════════════════════════════════ */
  const handleStartJourney = async (e) => {
    e.preventDefault();
    if (!nisabDate) return;

    setLoading(true);
    setError('');

    try {
      /* ── API CALL 1: Gregorian → Hijri ── */
      const apiDate  = toApiFormat(nisabDate);
      const startH   = await gregorianToHijri(apiDate);
      const startYear = parseInt(startH.year, 10);

      /* ── API CALL 2: Get current Hijri year ── */
      const currentHijriYear = await getCurrentHijriYear();

      const yearsCount = currentHijriYear - startYear;
      if (yearsCount < 0) {
        setError('The selected date must be in the past. Please choose an earlier date.');
        setLoading(false);
        return;
      }

      /* ── LOOP ──────────────────────────────────────────────────
         i = 0  → User's EXACT input date (Year 1, no offset)
         i = 1  → One Hijri year later
         ...
         i = yearsCount → Current Hijri year (last card)

         Change from previous: was i=1..yearsCount+1 (skipped the
         user's year). Now i=0..yearsCount includes it as Year 1.
      ─────────────────────────────────────────────────────────── */
      const cards = [];

      for (let i = 0; i <= yearsCount; i++) {
        // i=0 → same Hijri year as user's date (no increment)
        const anniversaryHijriYear = startYear + i;
        const isCurrentYear        = (i === yearsCount); // true only on the last card

        let gregDisplay;

        if (i === 0) {
          // Year 1 — we already know the Gregorian date: it's the user's input.
          // Format "YYYY-MM-DD" → "Month YYYY" for display (e.g. "March 2019")
          const [yyyy, mm] = nisabDate.split('-');
          const monthName  = new Date(`${yyyy}-${mm}-01`)
            .toLocaleString('en-US', { month: 'long' });
          gregDisplay = `${monthName} ${yyyy}`;
        } else {
          // Subsequent years — fetch from AlAdhan hToG
          gregDisplay = `~${anniversaryHijriYear - 579}`; // rough fallback
          try {
            const greg  = await hijriToGregorian(startH.day, startH.monthNum, anniversaryHijriYear);
            gregDisplay = greg.display;
          } catch {
            // Keep rough estimate if sub-call fails
          }
        }

        cards.push({
          id:               i,            // 0-indexed internally
          yearLabel:        `Year ${i + 1}`,  // display as Year 1, Year 2 …
          isCurrentYear,
          hijriDay:         startH.day,
          hijriMonthNum:    startH.monthNum,
          hijriMonthEn:     startH.monthEn,
          hijriYear:        anniversaryHijriYear,
          gregorianApprox:  gregDisplay,
          totalWealth:      '',           // user fills this in Step 2
          droppedBelowNisab: false,       // toggle in Step 2
        });
      }

      setYearCards(cards);
      setStep(2);

    } catch (err) {
      console.error(err);
      setError('Could not fetch Hijri dates from the AlAdhan API. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════
     Update a specific field on a specific year card
  ═══════════════════════════════════════════════ */
  const updateCard = (id, field, value) => {
    setYearCards(prev =>
      prev.map(card => card.id === id ? { ...card, [field]: value } : card)
    );
  };

  /* ═══════════════════════════════════════════════
     STEP 2 → STEP 3: Calculate & Submit
  ═══════════════════════════════════════════════ */
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      // Build payload — 2.5% Zakat, 0 if wealth dropped below Nisab
      const payload = yearCards.map(card => ({
        yearLabel:         card.yearLabel,
        hijriYear:         card.hijriYear,
        hijriMonth:        card.hijriMonthEn,
        gregorianApprox:   card.gregorianApprox,
        totalWealth:       parseFloat(card.totalWealth) || 0,
        droppedBelowNisab: card.droppedBelowNisab,
        // Calculate 2.5% — zero if wealth dropped below Nisab
        zakatDue: card.droppedBelowNisab
          ? 0
          : (parseFloat(card.totalWealth) || 0) * 0.025,
      }));

      // Frontend total (used as fallback if backend is offline)
      const frontendTotal = payload.reduce((sum, y) => sum + y.zakatDue, 0);

      /* ── Save to localStorage for Dashboard ── */
      const historyRecord = {
        id:             Date.now(),
        type:           'Missed Zakat',
        totalWealth:    payload.reduce((s, y) => s + y.totalWealth, 0),
        zakatAmount:    frontendTotal,
        dateCalculated: new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
        }),
        years: payload,
      };
      const existing = JSON.parse(localStorage.getItem('zakatHistory') || '[]');
      localStorage.setItem('zakatHistory', JSON.stringify([historyRecord, ...existing]));

      /* ── POST full JSON payload to backend ── */
      // submitPastZakat sends: POST /api/zakat/calculate-past
      // Body: { years: [...] }
      // Returns: { success, grandTotal, savedRecord, source }
      const backendRes = await submitPastZakat(payload);

      // Use grandTotal from backend if DB save succeeded,
      // otherwise fall back to the frontend-calculated total
      const finalTotal  = backendRes.grandTotal ?? frontendTotal;
      const savedToDB   = backendRes.source === 'database' && backendRes.success;

      setResult({ totalMissed: finalTotal, payload, savedToDB });
      setStep(3);

    } catch (err) {
      console.error(err);
      setError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ═══════════════════════════════════════════════
     RESET — go back to Step 1
  ═══════════════════════════════════════════════ */
  const handleReset = () => {
    setStep(1);
    setNisabDate('');
    setYearCards([]);
    setResult(null);
    setError('');
  };

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <div className="wizard">

      {/* ── PAGE HEADER ── */}
      <div className="wizard__header">
        <h1 className="wizard__title">Time-Travel Zakat Wizard</h1>
        <p className="wizard__sub">
          Calculate your missed Zakat obligations year by year using the Islamic Hijri calendar.
        </p>
      </div>

      {/* ── STEP PROGRESS INDICATOR ── */}
      <div className="wizard__progress">
        {['Select Date', 'Enter Wealth', 'Results'].map((label, i) => (
          <React.Fragment key={i}>
            <div className={`wizard__prog-step ${step > i ? 'done' : ''} ${step === i + 1 ? 'active' : ''}`}>
              <div className="wizard__prog-num">
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className="wizard__prog-label">{label}</span>
            </div>
            {/* Connector line between steps */}
            {i < 2 && <div className={`wizard__prog-line ${step > i + 1 ? 'done' : ''}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* ── GLOBAL ERROR BANNER ── */}
      {error && (
        <div className="wizard__error-banner">
          ⚠ {error}
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 1 — Date Input
      ════════════════════════════════════════ */}
      {step === 1 && (
        <div className="wizard__card fade-up">
          <h2 className="wizard__card-title">When did your wealth first reach Nisab?</h2>
          <p className="wizard__card-desc">
            Select the approximate Gregorian date when your total wealth (cash, gold, silver) 
            first crossed the Nisab threshold. This starts your Hawl (1-year Zakat cycle).
          </p>

          <form onSubmit={handleStartJourney}>
            <div className="input-group">
              <label htmlFor="nisab-date">Date Wealth Reached Nisab</label>
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
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading || !nisabDate}
            >
              {loading ? (
                <span className="wizard__loading-row">
                  <span className="wizard__spinner" />
                  Fetching Hijri Dates from AlAdhan API...
                </span>
              ) : (
                'Begin Time-Travel Journey →'
              )}
            </button>
          </form>

          {/* Educational Nisab info */}
          <div className="wizard__info-box">
            <p className="wizard__info-title">💡 What is Nisab?</p>
            <p>
              The Nisab is the minimum amount of wealth that makes Zakat obligatory.
              It is equivalent to <strong>87.48g of gold</strong> or <strong>612.36g of silver</strong> — 
              whichever is lower. Once your wealth surpasses this for a full Hijri year (Hawl), 
              Zakat of 2.5% becomes due.
            </p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 2 — Year-by-Year Wealth Entry
      ════════════════════════════════════════ */}
      {step === 2 && (
        <div className="fade-up">

          {/* Islamic ruling notice */}
          <div className="wizard__notice">
            <strong>☪ Important Islamic Ruling (Hawl Reset):</strong>
            <p>
              If your wealth dropped to <strong>zero or below Nisab</strong> during any Hijri year, 
              your Zakat obligation for that year is <strong>paused</strong>. The one-year Hawl cycle 
              restarts fresh when your wealth returns above the Nisab threshold.
            </p>
          </div>

          {/* Timeline of yearly cards */}
          <div className="wizard__timeline">
            {yearCards.map((card, index) => (
              <div
                key={card.id}
                className={`wizard__year-card ${card.droppedBelowNisab ? 'wizard__year-card--paused' : ''}`}
                style={{ animationDelay: `${index * 0.07}s` }}
              >
                {/* Vertical timeline connector */}
                <div className="wizard__connector">
                  <div className={`wizard__conn-dot ${card.droppedBelowNisab ? 'paused' : ''}`} />
                  {index < yearCards.length - 1 && <div className="wizard__conn-line" />}
                </div>

                {/* Card body */}
                <div className="wizard__year-body">
                  {/* Year header */}
                  <div className="wizard__year-header">
                    <div>
                      {/* Year badge — shows "Current Year" on the last card */}
                      <div className="wizard__badge-row">
                        <span className="wizard__year-badge">{card.yearLabel}</span>
                        {card.isCurrentYear && (
                          <span className="wizard__current-badge">Current Year</span>
                        )}
                      </div>
                      <h3 className="wizard__year-title">
                        {card.hijriDay} {card.hijriMonthEn} {card.hijriYear} AH
                      </h3>
                      <p className="wizard__year-greg">≈ {card.gregorianApprox}</p>
                    </div>
                    {card.droppedBelowNisab && (
                      <span className="wizard__paused-tag">Paused</span>
                    )}
                  </div>

                  {/* Wealth input with ₹ prefix */}
                  <div className="input-group">
                    <label>Total Net Wealth on this date</label>
                    <div className="wizard__rupee-wrap">
                      <span className="wizard__rupee-sym">₹</span>
                      <input
                        type="number"
                        className="input-field wizard__rupee-field"
                        placeholder="0.00"
                        value={card.totalWealth}
                        onChange={e => updateCard(card.id, 'totalWealth', e.target.value)}
                        disabled={card.droppedBelowNisab}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {/* Nisab drop toggle */}
                  <label className="wizard__toggle">
                    <div className="wizard__toggle-track" data-checked={card.droppedBelowNisab}>
                      <input
                        type="checkbox"
                        className="wizard__toggle-input"
                        checked={card.droppedBelowNisab}
                        onChange={e => updateCard(card.id, 'droppedBelowNisab', e.target.checked)}
                      />
                      <div className="wizard__toggle-thumb" />
                    </div>
                    <span className="wizard__toggle-text">
                      Wealth dropped to zero / below Nisab this year — Zakat paused
                    </span>
                  </label>

                  {/* Live 2.5% Zakat preview */}
                  {!card.droppedBelowNisab && card.totalWealth !== '' && parseFloat(card.totalWealth) > 0 && (
                    <div className="wizard__preview">
                      Estimated Zakat (2.5%):&nbsp;
                      <strong>₹{(parseFloat(card.totalWealth) * 0.025).toFixed(2)}</strong>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="wizard__nav">
            <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <span className="wizard__loading-row">
                  <span className="wizard__spinner" /> Calculating...
                </span>
              ) : 'Calculate Past Zakat →'}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 3 — Results
      ════════════════════════════════════════ */}
      {step === 3 && result && (
        <div className="wizard__results fade-up">

          {/* ── DB Save Status Banner ── */}
          {result.savedToDB ? (
            // Backend responded with success — record is in MongoDB
            <div className="wizard__db-banner wizard__db-banner--success">
              <span className="wizard__db-icon">✓</span>
              <div>
                <strong>Successfully Saved to Database!</strong>
                <p>Your Zakat history has been stored in MongoDB and will persist across sessions.</p>
              </div>
            </div>
          ) : (
            // Backend was offline — data is saved locally only
            <div className="wizard__db-banner wizard__db-banner--local">
              <span className="wizard__db-icon">⚡</span>
              <div>
                <strong>Saved Locally</strong>
                <p>Backend is offline. Your data is saved in browser storage. Connect your backend to persist it to the database.</p>
              </div>
            </div>
          )}

          {/* Total amount hero */}
          <div className="wizard__result-hero">
            <p className="wizard__result-label">Total Missed Zakat Due</p>
            <h2 className="wizard__result-amount">₹{result.totalMissed.toFixed(2)}</h2>
            <p className="wizard__result-sub">
              Across {result.payload.filter(y => !y.droppedBelowNisab).length} active Zakat year(s)
            </p>
          </div>

          {/* Year-by-year breakdown */}
          <div className="wizard__breakdown">
            <h3 className="wizard__breakdown-title">Yearly Breakdown</h3>
            {result.payload.map(year => (
              <div key={year.hijriYear} className="wizard__breakdown-row">
                <div>
                  <p className="wizard__breakdown-year">{year.hijriMonth} {year.hijriYear} AH</p>
                  <p className="wizard__breakdown-greg">≈ {year.gregorianApprox}</p>
                  <p className="wizard__breakdown-wealth">Wealth: ₹{year.totalWealth.toFixed(2)}</p>
                </div>
                <div className="wizard__breakdown-zakat">
                  {year.droppedBelowNisab
                    ? <span className="wizard__paused-tag">Paused</span>
                    : <span className="wizard__zakat-due">₹{year.zakatDue.toFixed(2)}</span>
                  }
                </div>
              </div>
            ))}
          </div>

          <button className="btn-secondary w-full" onClick={handleReset}>
            ← Start Over
          </button>
        </div>
      )}

    </div>
  );
}
