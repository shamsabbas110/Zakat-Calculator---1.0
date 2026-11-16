import axios from 'axios';

/* ═══════════════════════════════════════════════════════════════
   BACKEND API INSTANCES
   ─────────────────────────────────────────────────────────────
   Base URL is read from the Vite environment variable
   VITE_API_URL defined in frontend/.env
   ═══════════════════════════════════════════════════════════════ */
const rawApiBase = (import.meta.env.VITE_API_URL || '').trim();
// Normalize API base by trimming trailing slashes and accidental /api or /api/zakat suffixes
const API_BASE = rawApiBase.replace(/\/api(\/zakat)?\/?$/, '').replace(/\/+$/, '');

export const API = axios.create({
  baseURL: `${API_BASE}/api/zakat`,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
});

export const AUTH_API = axios.create({
  baseURL: `${API_BASE}/api/auth`,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
});

/* ─────────────────────────────────────────────────────────────
   JWT TOKEN INTERCEPTORS
   Automatically attaches Bearer token from localStorage to all requests.
   Gracefully handles 401 Unauthorized responses.
   ───────────────────────────────────────────────────────────── */
const setupInterceptors = (instance) => {
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('zakat_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        // Only clear and notify if this was not a login, register, or password-reset failure
        const url = error.config?.url || '';
        if (
          !url.includes('/login') && 
          !url.includes('/register') &&
          !url.includes('/forgot-password') &&
          !url.includes('/reset-password')
        ) {
          localStorage.removeItem('zakat_token');
          localStorage.removeItem('zakat_user');
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
      }
      return Promise.reject(error);
    }
  );
};

setupInterceptors(API);
setupInterceptors(AUTH_API);

/* ─────────────────────────────────────────────────────────────
   AUTHENTICATION ENDPOINTS
   ───────────────────────────────────────────────────────────── */

/**
 * Register with Email and Password
 * POST /api/auth/register
 */
export const registerUser = async (data) => {
  const response = await AUTH_API.post('/register', data);
  return response.data;
};

/**
 * Login with Email and Password
 * POST /api/auth/login
 */
export const loginUser = async (credentials) => {
  const response = await AUTH_API.post('/login', credentials);
  return response.data;
};

/**
 * Google OAuth Authentication
 * POST /api/auth/google
 * @param {string} credential - Google ID Token
 * @param {string} mode - 'login' | 'signup'
 */
export const googleAuthUser = async (credential, mode = 'login') => {
  const response = await AUTH_API.post('/google', { credential, mode });
  return response.data;
};

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
export const getMe = async () => {
  const response = await AUTH_API.get('/me');
  return response.data;
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateUserProfile = async (data) => {
  const response = await AUTH_API.put('/profile', data);
  return response.data;
};

/**
 * Request Password Reset Email
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (email) => {
  const response = await AUTH_API.post('/forgot-password', { email });
  return response.data;
};

/**
 * Reset Password with Token
 * POST /api/auth/reset-password/:token
 */
export const resetPassword = async (token, password) => {
  const response = await AUTH_API.post(`/reset-password/${token}`, { password });
  return response.data;
};

/* ─────────────────────────────────────────────────────────────
   ZAKAT BACKEND ENDPOINTS
   ───────────────────────────────────────────────────────────── */

/**
 * Save a Current-Year Zakat record.
 * POST /api/zakat/save
 */
export const saveCurrentZakat = async (payload) => {
  const body = {
    ...payload,
    goldValue:   payload.gold   ?? payload.goldValue,
    silverValue: payload.silver ?? payload.silverValue,
  };
  const response = await API.post('/save', body);
  return response.data;
};

/**
 * Fetch all Zakat history records from MongoDB.
 * GET /api/zakat/history
 * Scoped to currently authenticated user.
 */
export const getZakatHistory = async () => {
  const response = await API.get('/history');
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

/** Legacy alias kept so existing pages don't break */
export const saveZakat = saveCurrentZakat;

/* ─────────────────────────────────────────────────────────────
   ALADHAN API (free, no API key required)
   ───────────────────────────────────────────────────────────── */
const ALADHAN = axios.create({
  baseURL: 'https://api.aladhan.com/v1',
  headers: { 'Accept': 'application/json' },
});

export const gregorianToHijri = async (dateStr) => {
  const res = await ALADHAN.get(`/gToH?date=${dateStr}`);
  const h   = res.data.data.hijri;
  return {
    day:      h.day,
    monthNum: h.month.number,
    monthEn:  h.month.en,
    year:     h.year,
  };
};

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

export const getCurrentHijriYear = async () => {
  const now = new Date();
  const dd  = String(now.getDate()).padStart(2,'0');
  const mm  = String(now.getMonth() + 1).padStart(2,'0');
  const res = await ALADHAN.get(`/gToH?date=${dd}-${mm}-${now.getFullYear()}`);
  return parseInt(res.data.data.hijri.year, 10);
};

export const submitPastZakat = async (years) => {
  try {
    const response = await API.post('/calculate-past', { years });
    return {
      ...response.data,
      source: 'database',
    };
  } catch (err) {
    console.warn('Backend unavailable, falling back to local calculation.', err?.message);
    return {
      success:     true,
      source:      'local',
      grandTotal:  years.reduce((sum, y) => sum + (y.zakatDue || 0), 0),
      savedRecord: null,
    };
  }
};

export default API;
