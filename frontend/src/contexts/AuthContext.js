import React, { createContext, useState, useEffect } from 'react';

// Context to hold authentication state and user information.
export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  // Decode token to get user info (very naive; use jwt-decode library in prod)
  useEffect(() => {
    if (token) {
      try {
        const [, payload] = token.split('.');
        const decoded = JSON.parse(atob(payload));
        setUser(decoded);
      } catch {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, [token]);

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}