import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// Context to hold authentication state and user information.
export const AuthContext = createContext();

/**
 * Decode a JWT token payload synchronously.
 * Returns null if the token is missing or malformed.
 */
function decodeToken(token) {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Check if a decoded JWT payload is expired.
 */
function isExpired(decoded) {
  if (!decoded || !decoded.exp) return false;
  return Date.now() >= decoded.exp * 1000;
}

export function AuthProvider({ children }) {
  const storedToken = localStorage.getItem('token');
  const decodedStored = decodeToken(storedToken);

  // If stored token is already expired, clear it immediately
  const initialToken = (storedToken && !isExpired(decodedStored)) ? storedToken : null;
  if (storedToken && isExpired(decodedStored)) {
    localStorage.removeItem('token');
  }

  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(() => initialToken ? decodedStored : null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(decodeToken(newToken));
    setSessionExpired(false);
  };

  const logout = (expired = false) => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    if (expired) setSessionExpired(true);
  };

  // Set up axios interceptor to catch 401/403 globally and auto-logout
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        const status = error.response?.status;
        const errMsg = error.response?.data?.error || '';
        if ((status === 401 || status === 403) && errMsg.toLowerCase().includes('token')) {
          logout(true);
          window.location.href = '/login?expired=1';
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, sessionExpired }}>
      {children}
    </AuthContext.Provider>
  );
}
