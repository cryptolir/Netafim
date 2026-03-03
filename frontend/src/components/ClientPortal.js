import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../contexts/AuthContext';
import ChatAgent from './ChatAgent';

export default function ClientPortal() {
  const { token, logout } = useContext(AuthContext);
  const { t } = useTranslation();
  const [containerId, setContainerId] = useState('');
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [scheduleParams, setScheduleParams] = useState({ portFrom: '', portTo: '', date: '' });
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState(null);

  const fetchTracking = async () => {
    setError(null);
    try {
      const res = await axios.get(`/api/containers/${containerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrackingInfo(res.data);
    } catch (err) {
      setError('Failed to fetch tracking information');
    }
  };

  const fetchSchedules = async () => {
    setError(null);
    try {
      const params = {};
      if (scheduleParams.portFrom) params.portFrom = scheduleParams.portFrom;
      if (scheduleParams.portTo) params.portTo = scheduleParams.portTo;
      if (scheduleParams.date) params.date = scheduleParams.date;
      const res = await axios.get('/api/containers', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setSchedules(res.data.schedules || res.data);
    } catch (err) {
      setError('Failed to fetch schedules');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>{t('client_portal')}</h2>
      <button onClick={logout}>{t('logout')}</button>

      {/* Container Tracking */}
      <section style={{ marginTop: '1rem' }}>
        <h3>{t('container_tracking')}</h3>
        <input
          type="text"
          placeholder={t('container_id')}
          value={containerId}
          onChange={(e) => setContainerId(e.target.value)}
        />
        <button onClick={fetchTracking}>{t('track')}</button>
        {trackingInfo && (
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
            {JSON.stringify(trackingInfo, null, 2)}
          </pre>
        )}
      </section>

      {/* Ship Schedules */}
      <section style={{ marginTop: '1rem' }}>
        <h3>{t('ship_schedules')}</h3>
        <input
          type="text"
          placeholder={t('port_from')}
          value={scheduleParams.portFrom}
          onChange={(e) => setScheduleParams({ ...scheduleParams, portFrom: e.target.value })}
        />
        <input
          type="text"
          placeholder={t('port_to')}
          value={scheduleParams.portTo}
          onChange={(e) => setScheduleParams({ ...scheduleParams, portTo: e.target.value })}
        />
        <input
          type="date"
          value={scheduleParams.date}
          onChange={(e) => setScheduleParams({ ...scheduleParams, date: e.target.value })}
        />
        <button onClick={fetchSchedules}>{t('search')}</button>
        {schedules && schedules.length > 0 && (
          <ul>
            {schedules.map((schedule, idx) => (
              <li key={idx}>{JSON.stringify(schedule)}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Chat Assistant */}
      <section style={{ marginTop: '1rem' }}>
        <h3>{t('chat_with_agent')}</h3>
        <ChatAgent />
      </section>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}