import axios from 'axios';

/* ═══════════════════════════════════════════════════════════════
   BACKEND API INSTANCE
   ─────────────────────────────────────────────────────────────
   Base URL is read from the Vite environment variable
   VITE_API_URL defined in frontend/.env

   In development:  Vite's proxy forwards /api → http://localhost:5000
                    so VITE_API_URL can be left empty or set to ''
   In production:   Set VITE_API_URL=https://your-production-domain.com
   ═══════════════════════════════════════════════════════════════ */
const API = axios.create({
  // import.meta.env.VITE_API_URL is '' in dev (proxy handles it)
  // and the full domain URL in production
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api/zakat`,

  // Always send/receive JSON
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
});

/* ─────────────────────────────────────────────────────────────
   BACKEND ENDPOINTS
   ───────────────────────────────────────────────────────────── */

/**
 * Save a Current-Year Zakat record.
 * POST /api/zakat/current
 *
 * Field names MUST match what zakatController.js reads:
 *   cash, goldValue, silverValue (NOT gold/silver)
 */
export const saveCurrentZakat = async (payload) => {
  // Remap frontend field names → backend expected names
  const body = {
    ...payload,
    goldValue:   payload.gold   ?? payload.goldValue,
    silverValue: payload.silver ?? payload.silverValue,
  };
  const response = await API.post('/current', body);
  return response.data;
};

/**
 * Fetch all Zakat history records from MongoDB.
 * GET /api/zakat/history
 * Backend returns: { success: true, data: [...] }
 */
export const getZakatHistory = async () => {
  const response = await API.get('/history');
  // Controller returns { success, data: [...] } — extract the array
  return response.data.data ?? response.data;
};

/**
 * Delete a single Zakat record by its MongoDB _id.
 * DELETE /api/zakat/:id
 */
export const deleteZakatRecord = async (id) => {
  const response = await API.delete(`/${id}`);
  return response.data;
};

/** Legacy alias kept so other pages don't break */
export const saveZakat = saveCurrentZakat;


/* ─────────────────────────────────────────────────────────────
   ALADHAN API  (free, no API key required)
   Separate axios instance — never proxied through the backend
   ───────────────────────────────────────────────────────────── */
const ALADHAN = axios.create({
  baseURL: 'https://api.aladhan.com/v1',
  headers: { 'Accept': 'application/json' },
});

/**
 * Convert a Gregorian date → Hijri date.
 * @param {string} dateStr  Format: "DD-MM-YYYY"
 * @returns {{ day, monthNum, monthEn, year }}
 */
export const gregorianToHijri = async (dateStr) => {
  const res = await ALADHAN.get(`/gToH?date=${dateStr}`);
  const h   = res.data.data.hijri;
  return {
    day:      h.day,           // "09"
    monthNum: h.month.number, // 9
    monthEn:  h.month.en,     // "Ramaḍān"
    year:     h.year,         // "1438"
  };
};

/**
 * Convert a Hijri date → approximate Gregorian date.
 * @param {string} day      Hijri day  "09"
 * @param {number} monthNum Hijri month number  9
 * @param {number} year     Hijri year  1438
 * @returns {{ month, year, display }}
 */
export const hijriToGregorian = async (day, monthNum, year) => {
  const ddmm = `${String(day).padStart(2,'0')}-${String(monthNum).padStart(2,'0')}-${year}`;
  const res  = await ALADHAN.get(`/hToG?date=${ddmm}`);
  const g    = res.data.data.gregorian;
  return {
    month:   g.month.en,
    year:    g.year,
    display: `${g.month.en} ${g.year}`,
  };
};

/**
 * Get the current Hijri year by converting today's Gregorian date.
 * @returns {number}  e.g. 1447
 */
export const getCurrentHijriYear = async () => {
  const now = new Date();
  const dd  = String(now.getDate()).padStart(2,'0');
  const mm  = String(now.getMonth() + 1).padStart(2,'0');
  const res = await ALADHAN.get(`/gToH?date=${dd}-${mm}-${now.getFullYear()}`);
  return parseInt(res.data.data.hijri.year, 10);
};

/* ─────────────────────────────────────────────────────────────
   SUBMIT PAST ZAKAT
   POSTs the full timeline array to the backend as strict JSON.
   Returns the backend's response (including savedRecord + grandTotal).
   ───────────────────────────────────────────────────────────── */

/**
 * @param {Array}  years     - Array of yearly wealth records
 * @returns {{ success, grandTotal, savedRecord, source }}
 *   source = 'database' if saved to MongoDB, 'local' if offline fallback
 */
export const submitPastZakat = async (years) => {
  try {
    // Strict JSON body: { years: [...] }
    const response = await API.post('/calculate-past', { years });

    // Expected backend response shape:
    // { success: true, grandTotal: 1234.56, savedRecord: { _id, ... } }
    return {
      ...response.data,
      source: 'database',
    };

  } catch (err) {
    // Backend is offline or returned an error — use localStorage fallback
    console.warn('Backend unavailable, falling back to local storage.', err?.message);
    console.error('Backend exact error:', err?.response?.data);
    return {
      success:     true,
      source:      'local',
      grandTotal:  years.reduce((sum, y) => sum + (y.zakatDue || 0), 0),
      savedRecord: null,
    };
  }
};

export default API;
