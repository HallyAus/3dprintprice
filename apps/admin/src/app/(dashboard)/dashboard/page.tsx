'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCurrency } from '@printforge/shared';
import type { DashboardStats } from '@printforge/shared';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed', '#0891b2'];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--error)' }}>{error || 'Failed to load stats'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your 3D print quote business</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Total Submissions</p>
          <p className="stat-value">{stats.totalSubmissions}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Revenue</p>
          <p className="stat-value success">{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Average Estimate</p>
          <p className="stat-value primary">{formatCurrency(stats.averageEstimate)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Conversion Rate</p>
          <p className="stat-value">{(stats.conversionRate * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Submissions chart */}
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Submissions Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.submissionsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" name="Submissions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown */}
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.statusBreakdown}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ status, percentage }) => `${status} (${(percentage * 100).toFixed(0)}%)`}
              >
                {stats.statusBreakdown.map((entry, index) => (
                  <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top materials */}
      <div className="card">
        <h3 style={{ marginBottom: 20 }}>Top Materials</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {stats.topMaterials.map((m, i) => (
            <div
              key={m.material}
              style={{
                flex: '1 1 150px',
                padding: 16,
                background: 'var(--bg-secondary)',
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {['🔵', '🟢', '🔴', '🟡', '🟣'][i] || '⚪'}
              </div>
              <div style={{ fontWeight: 600 }}>{m.material}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {m.count} orders ({(m.percentage * 100).toFixed(0)}%)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
