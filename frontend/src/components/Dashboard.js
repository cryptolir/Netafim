import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import '../App.css';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return dateStr; }
}

function getStatusClass(status) {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (s.includes('process') || s.includes('open')) return 'processing';
  if (s.includes('ship') || s.includes('transit')) return 'shipped';
  if (s.includes('deliver') || s.includes('complet') || s.includes('close')) return 'delivered';
  return 'pending';
}

export default function Dashboard() {
  const { token, logout } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setOrders(Array.isArray(res.data) ? res.data : res.data.orders || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load orders');
        setLoading(false);
      });
  }, [token]);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    return !q ||
      String(o.id || o.SalesOrder || '').toLowerCase().includes(q) ||
      String(o.customer || o.SoldToParty || '').toLowerCase().includes(q) ||
      String(o.status || o.OverallSDProcessStatus || '').toLowerCase().includes(q);
  });

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <div className="nav-brand">
          <span className="anchor-icon">⚓</span>
          Netafim Logistics
        </div>
        <div className="nav-spacer" />
        <div className="nav-user">
          <span>Admin Dashboard</span>
          <button className="btn-logout" onClick={logout}>Sign Out</button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage('en')}
              style={{ padding: '3px 10px', fontSize: 11 }}
            >EN</button>
            <button
              className={`lang-btn ${i18n.language === 'fr' ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage('fr')}
              style={{ padding: '3px 10px', fontSize: 11 }}
            >FR</button>
          </div>
        </div>
      </nav>

      <div className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <div className="dashboard-title">Sales Orders</div>
            <div className="dashboard-subtitle">Live data from SAP S/4HANA · {orders.length} orders</div>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search orders..."
            style={{
              padding: '8px 14px',
              border: '1.5px solid var(--gray-200)',
              borderRadius: 8,
              fontSize: 13,
              outline: 'none',
              width: 220
            }}
          />
        </div>

        <div className="section-card">
          {loading && (
            <div className="loading-state" style={{ padding: '32px 24px' }}>
              <div className="spinner" /> Loading orders from SAP...
            </div>
          )}
          {error && <div className="error-state" style={{ margin: 20 }}>⚠️ {error}</div>}
          {!loading && !error && (
            <div style={{ overflowX: 'auto' }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Delivery Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                        No orders found
                      </td>
                    </tr>
                  ) : filtered.map((o, i) => {
                    const orderId = o.id || o.SalesOrder || `ORD-${i}`;
                    const customer = o.customer || o.SoldToParty || '—';
                    const date = formatDate(o.date || o.SalesOrderDate || o.CreationDate);
                    const amount = o.amount || o.TotalNetAmount || '—';
                    const currency = o.currency || o.TransactionCurrency || 'USD';
                    const status = o.status || o.OverallSDProcessStatus || 'Pending';
                    const delivery = formatDate(o.deliveryDate || o.RequestedDeliveryDate);
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--navy)' }}>{orderId}</td>
                        <td>{customer}</td>
                        <td>{date}</td>
                        <td style={{ fontWeight: 600 }}>{typeof amount === 'number' ? amount.toLocaleString() : amount}</td>
                        <td style={{ color: 'var(--gray-500)' }}>{currency}</td>
                        <td>
                          <span className={`order-status ${getStatusClass(status)}`}>{status}</span>
                        </td>
                        <td>{delivery}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
