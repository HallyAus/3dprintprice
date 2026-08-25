'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCurrency, formatFileSize, formatDuration, formatDimensions } from '@printforge/shared';
import { ModelViewer } from '@/components/ModelViewer';

interface SubmissionDetail {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  material: string;
  colour: string;
  quantity: number;
  quality: string;
  infill: number;
  fileKey: string;
  fileName: string;
  fileSize: number;
  boundingBox: { x: number; y: number; z: number } | null;
  filamentGrams: number | null;
  printTimeSeconds: number | null;
  priceEstimateLow: number | null;
  priceEstimateHigh: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
}

const STATUS_OPTIONS = ['pending', 'processing', 'quoted', 'accepted', 'rejected', 'completed', 'cancelled'];

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const loadSubmission = useCallback(async () => {
    try {
      const data = await api.getSubmission(params.id);
      setSubmission(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  const handleStatusChange = async (newStatus: string) => {
    if (!submission) return;
    setUpdating(true);
    try {
      await api.updateSubmissionStatus(submission.id, newStatus);
      setSubmission({ ...submission, status: newStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!submission || !confirm('Are you sure you want to delete this submission? This cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteSubmission(submission.id);
      router.push('/submissions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete submission');
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--error)', marginBottom: 16 }}>{error || 'Submission not found'}</p>
        <button onClick={() => router.push('/submissions')} className="btn btn-secondary">
          Back to Submissions
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button onClick={() => router.push('/submissions')} className="btn btn-secondary" style={{ marginBottom: 12 }}>
            ← Back to Submissions
          </button>
          <h1 className="page-title">Submission Details</h1>
          <p className="page-subtitle">ID: {submission.id}</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select
            className="input"
            value={submission.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updating}
            style={{ width: 'auto' }}
          >
            {STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button onClick={handleDelete} className="btn btn-danger" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 12, marginBottom: 20, color: '#991b1b' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left column */}
        <div>
          {/* 3D Viewer */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Model Preview</h3>
            <ModelViewer downloadUrl={submission.downloadUrl} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div>
                <strong>{submission.fileName}</strong>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                  ({formatFileSize(submission.fileSize)})
                </span>
              </div>
              <a href={submission.downloadUrl} download className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
                Download
              </a>
            </div>
          </div>

          {/* Customer Info */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Customer Information</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Name</span>
                <div style={{ fontWeight: 500 }}>{submission.customerName}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Email</span>
                <div>
                  <a href={`mailto:${submission.customerEmail}`} style={{ color: 'var(--primary)' }}>
                    {submission.customerEmail}
                  </a>
                </div>
              </div>
              {submission.customerPhone && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Phone</span>
                  <div>
                    <a href={`tel:${submission.customerPhone}`} style={{ color: 'var(--primary)' }}>
                      {submission.customerPhone}
                    </a>
                  </div>
                </div>
              )}
              {submission.notes && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Notes</span>
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, marginTop: 4 }}>
                    {submission.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Price Estimate */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Price Estimate</h3>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--primary)' }}>
                {submission.priceEstimateLow && submission.priceEstimateHigh ? (
                  <>
                    {formatCurrency(submission.priceEstimateLow)} - {formatCurrency(submission.priceEstimateHigh)}
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>AUD (inc. GST)</div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
              <span className={`badge badge-${submission.status}`} style={{ fontSize: 14 }}>
                {submission.status}
              </span>
            </div>
          </div>

          {/* Print Details */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Print Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Material</span>
                <div style={{ fontWeight: 500 }}>{submission.material}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Colour</span>
                <div style={{ fontWeight: 500 }}>{submission.colour}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Quality</span>
                <div style={{ fontWeight: 500 }}>{submission.quality}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Infill</span>
                <div style={{ fontWeight: 500 }}>{submission.infill}%</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Quantity</span>
                <div style={{ fontWeight: 500 }}>{submission.quantity}</div>
              </div>
            </div>
          </div>

          {/* Slicing Results */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Slicing Analysis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Dimensions</span>
                <div style={{ fontWeight: 500 }}>
                  {submission.boundingBox
                    ? formatDimensions(submission.boundingBox.x, submission.boundingBox.y, submission.boundingBox.z)
                    : '—'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Print Time (est.)</span>
                <div style={{ fontWeight: 500 }}>
                  {submission.printTimeSeconds ? formatDuration(submission.printTimeSeconds) : '—'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Filament (est.)</span>
                <div style={{ fontWeight: 500 }}>
                  {submission.filamentGrams ? `${submission.filamentGrams.toFixed(1)}g` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Timeline</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Submitted</span>
                <div>{formatDate(submission.createdAt)}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Last Updated</span>
                <div>{formatDate(submission.updatedAt)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
