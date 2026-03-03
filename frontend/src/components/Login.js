import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      login(res.data.token);
      // After login, navigate based on role.  Decode token or call /auth/me in real app.
      const [, payload] = res.data.token.split('.');
      const { role } = JSON.parse(atob(payload));
      if (role === 'admin') navigate('/dashboard');
      else navigate('/client');
    } catch (err) {
      setError(t('invalid_credentials'));
    }
  };

  const changeLanguage = (lng) => i18n.changeLanguage(lng);

  return (
    <div className="login-container" style={{ padding: '2rem' }}>
      <h2>{t('login')}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>{t('username')}:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>{t('password')}:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">{t('login')}</button>
      </form>
      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => changeLanguage('en')}>English</button>
        <button onClick={() => changeLanguage('fr')}>Français</button>
      </div>
    </div>
  );
}