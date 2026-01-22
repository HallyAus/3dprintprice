'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const [shopName, setShopName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMe().then((data) => {
      setShopName(data.shop.name);
      setOwnerEmail(user?.email || '');
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      await api.updateShop({ name: shopName, ownerEmail });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your shop settings</p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 12, marginBottom: 20, color: '#991b1b' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: 12, marginBottom: 20, color: '#166534' }}>
          Settings saved successfully!
        </div>
      )}

      <div className="card" style={{ maxWidth: 600 }}>
        <h3 style={{ marginBottom: 20 }}>Shop Information</h3>

        <div className="form-group">
          <label className="label">Shop Name</label>
          <input
            type="text"
            className="input"
            value={shopName}
            onChange={(e) => {
              setShopName(e.target.value);
              setSuccess(false);
            }}
            placeholder="Your Shop Name"
          />
          <span className="form-hint">This name appears in emails and notifications</span>
        </div>

        <div className="form-group">
          <label className="label">Notification Email</label>
          <input
            type="email"
            className="input"
            value={ownerEmail}
            onChange={(e) => {
              setOwnerEmail(e.target.value);
              setSuccess(false);
            }}
            placeholder="owner@example.com"
          />
          <span className="form-hint">Quote notifications will be sent to this email</span>
        </div>

        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 600, marginTop: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Widget Embed Code</h3>
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
          Add this code to your Shopify page to embed the 3D print quote widget:
        </p>
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 6, fontFamily: 'monospace', fontSize: 13, overflowX: 'auto' }}>
          <code>
            {`<div id="printforge-quote-widget" data-shop-id="${user?.email?.split('@')[0] || 'your-shop'}.myshopify.com"></div>
<script src="${typeof window !== 'undefined' ? window.location.origin.replace(':3002', ':3000') : 'https://yourdomain.com'}/widget.js" defer></script>`}
          </code>
        </div>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
          In Shopify Admin: Go to Online Store → Pages → Add Custom Liquid block and paste this code.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 600, marginTop: 20 }}>
        <h3 style={{ marginBottom: 20, color: 'var(--error)' }}>Danger Zone</h3>
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
          Export or delete your data. These actions cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">Export All Data</button>
          <button className="btn btn-danger">Delete All Data</button>
        </div>
      </div>
    </div>
  );
}
