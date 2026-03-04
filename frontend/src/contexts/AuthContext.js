import React, { createContext, useState } from 'react';

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

export function AuthProvider({ children }) {
  const storedToken = localStorage.getItem('token');
  const [token, setToken] = useState(storedToken);
  // Initialize user synchronously so ProtectedRoute doesn't flash to /login
  const [user, setUser] = useState(() => decodeToken(storedToken));

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(decodeToken(newToken));
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
