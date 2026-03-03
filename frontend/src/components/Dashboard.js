import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import OrdersTable from './OrdersTable';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { token, logout } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get('/api/orders', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setOrders(res.data);
      } catch (err) {
        setError('Failed to load orders');
      }
    };
    fetchOrders();
  }, [token]);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>{t('dashboard')}</h2>
      <button onClick={logout}>{t('logout')}</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <OrdersTable orders={orders} />
    </div>
  );
}