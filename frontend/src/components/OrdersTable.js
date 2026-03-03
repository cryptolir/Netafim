import React from 'react';
import { useTranslation } from 'react-i18next';

export default function OrdersTable({ orders }) {
  const { t } = useTranslation();
  return (
    <table border="1" cellPadding="8" style={{ width: '100%', marginTop: '1rem' }}>
      <thead>
        <tr>
          <th>{t('order_id')}</th>
          <th>{t('customer')}</th>
          <th>{t('status')}</th>
          <th>{t('total')}</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>{order.id}</td>
            <td>{order.customer}</td>
            <td>{order.status}</td>
            <td>{order.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}