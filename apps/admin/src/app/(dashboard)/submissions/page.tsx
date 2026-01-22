'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency, formatFileSize } from '@printforge/shared';

interface Submission {
  id: string;
  customerName: string;
  customerEmail: string;
  material: string;
  colour: string;
  quantity: number;
  quality: string;
  fileName: string;
  fileSize: number;
  priceEstimateLow: number | null;
  priceEstimateHigh: number | null;
  status: string;
  createdAt: string;
}

interface Filters {
  status: string;
  material: string;
  search: string;
  page: number;
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    status: '',
    material: '',
    search: '',
    page: 1,
  });

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getSubmissions({
        status: filters.status || undefined,
        material: filters.material || undefined,
        search: filters.search || undefined,
        page: filters.page,
        limit: 20,
      });
      setSubmissions(result.submissions);
      setPagination(result.pagination);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleFilterChange = (key: keyof Filters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      ...(key !== 'page' ? { page: 1 } : {}),
    }));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Submissions</h1>
          <p className="page-subtitle">Manage quote requests from customers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Search</label>
            <input
              type="text"
              className="input"
              placeholder="Customer, email, or file..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="quoted">Quoted</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="label">Material</label>
            <select
              className="input"
              value={filters.material}
              onChange={(e) => handleFilterChange('material', e.target.value)}
            >
              <option value="">All materials</option>
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
              <option value="ASA">ASA</option>
              <option value="TPU">TPU</option>
              <option value="Nylon">Nylon</option>
              <option value="Resin">Resin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3>No submissions found</h3>
            <p>Try adjusting your filters or wait for new quote requests.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>File</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Estimate</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{sub.customerName}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {sub.customerEmail}
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.fileName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {formatFileSize(sub.fileSize)}
                        </div>
                      </td>
                      <td>
                        {sub.material}
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {sub.colour} • {sub.quality}
                        </div>
                      </td>
                      <td>{sub.quantity}</td>
                      <td>
                        {sub.priceEstimateLow && sub.priceEstimateHigh ? (
                          <>
                            {formatCurrency(sub.priceEstimateLow)} - {formatCurrency(sub.priceEstimateHigh)}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${sub.status}`}>{sub.status}</span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {formatDate(sub.createdAt)}
                      </td>
                      <td>
                        <Link href={`/submissions/${sub.id}`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => handleFilterChange('page', filters.page - 1)}
                disabled={filters.page === 1}
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
              </span>
              <button
                className="pagination-btn"
                onClick={() => handleFilterChange('page', filters.page + 1)}
                disabled={filters.page >= pagination.totalPages}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
