import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, googleAuthUser, getMe } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('zakat_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Persist Session Helper
   */
  const saveSession = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('zakat_token', newToken);
    localStorage.setItem('zakat_user', JSON.stringify(userData));
    setAuthError(null);
  };

  /**
   * Clear Session Helper (Logout)
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('zakat_token');
    localStorage.removeItem('zakat_user');
    setAuthError(null);
  }, []);

  /**
   * Session Restoration on Initial Load / Page Refresh
   */
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('zakat_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await getMe();
        if (response.success && response.user) {
          setUser(response.user);
          setToken(storedToken);
        } else {
          logout();
        }
      } catch (err) {
        // If 401 or invalid token, clean up session
        if (err.response?.status === 401) {
          logout();
        } else {
          // If network error, use cached user object if available
          const cachedUser = localStorage.getItem('zakat_user');
          if (cachedUser) {
            try {
              setUser(JSON.parse(cachedUser));
            } catch {
              logout();
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();

    // Listen to unauthorized event dispatched by Axios interceptor
    window.addEventListener('auth:unauthorized', logout);
    return () => {
      window.removeEventListener('auth:unauthorized', logout);
    };
  }, [logout]);

  /**
   * Email/Password Login
   */
  const login = async (email, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await loginUser({ email, password });
      if (res.success && res.token) {
        saveSession(res.token, res.user);
        return { success: true, user: res.user };
      }
      throw new Error(res.message || 'Login failed.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid credentials.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Email/Password Registration
   */
  const register = async (name, email, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await registerUser({ name, email, password });
      if (res.success && res.token) {
        saveSession(res.token, res.user);
        return { success: true, user: res.user };
      }
      throw new Error(res.message || 'Registration failed.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Google OAuth Authentication (Separate Login and Sign Up flows)
   * @param {string} credential - Google ID Token
   * @param {string} mode - 'login' | 'signup'
   */
  const googleLogin = async (credential, mode = 'login') => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await googleAuthUser(credential, mode);
      if (res.success && res.token) {
        saveSession(res.token, res.user);
        return { success: true, user: res.user };
      }
      throw new Error(res.message || 'Google authentication failed.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Google authentication failed.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update Profile in context
   */
  const updateUserData = (newUserData) => {
    setUser((prev) => ({ ...prev, ...newUserData }));
    localStorage.setItem('zakat_user', JSON.stringify({ ...user, ...newUserData }));
  };

  const value = {
    user,
    token,
    loading,
    authError,
    isAuthenticated: !!token && !!user,
    login,
    register,
    googleLogin,
    logout,
    updateUserData,
    setAuthError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
