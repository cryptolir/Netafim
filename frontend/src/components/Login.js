import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import '../App.css';
import netafimLogo from '../netafim-logo.png';

export default function Login() {
  const { login } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      login(res.data.token);
      const [, payload] = res.data.token.split('.');
      const { role } = JSON.parse(atob(payload));
      window.location.href = role === 'admin' ? '/dashboard' : '/portal';
    } catch (err) {
      setError(t('invalid_credentials') || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src={netafimLogo} alt="Netafim" className="login-logo-img" />
          <p>Logistics &amp; Supply Chain Portal</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('username') || 'Username'}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>{t('password') || 'Password'}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : (t('login') || 'Sign In')}
          </button>
        </form>

        <div className="lang-toggle">
          <button
            className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
            onClick={() => i18n.changeLanguage('en')}
          >
            English
          </button>
          <button
            className={`lang-btn ${i18n.language === 'fr' ? 'active' : ''}`}
            onClick={() => i18n.changeLanguage('fr')}
          >
            Français
          </button>
        </div>
      </div>
    </div>
  );
}
