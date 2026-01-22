import React from 'react';
import { formatCurrency, formatDuration } from '@printforge/shared';
import type { QuoteResponse } from '@printforge/shared';

interface QuoteResultProps {
  response: QuoteResponse;
  fileName: string;
  onConfirm: () => void;
  onBack: () => void;
}

export function QuoteResult({ response, fileName, onConfirm, onBack }: QuoteResultProps) {
  const { breakdown, estimateLow, estimateHigh, leadTimeDays } = response;

  return (
    <div>
      <div className="pf-estimate">
        <p className="pf-estimate-header">Estimated Price</p>
        <div className="pf-estimate-price">
          {formatCurrency(estimateLow)} - {formatCurrency(estimateHigh)}
          <span className="pf-estimate-currency"> AUD</span>
        </div>

        <div className="pf-estimate-details">
          <div className="pf-estimate-item">
            <p className="pf-estimate-item-label">Material</p>
            <p className="pf-estimate-item-value">{formatCurrency(breakdown.materialCost)}</p>
          </div>
          <div className="pf-estimate-item">
            <p className="pf-estimate-item-label">Machine Time</p>
            <p className="pf-estimate-item-value">{formatCurrency(breakdown.timeCost)}</p>
          </div>
          <div className="pf-estimate-item">
            <p className="pf-estimate-item-label">Setup</p>
            <p className="pf-estimate-item-value">{formatCurrency(breakdown.labourCost)}</p>
          </div>
          <div className="pf-estimate-item">
            <p className="pf-estimate-item-label">Lead Time</p>
            <p className="pf-estimate-item-value">{leadTimeDays} days</p>
          </div>
        </div>

        {breakdown.quantityDiscount > 0 && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#dcfce7', borderRadius: 4, fontSize: 14 }}>
            <strong>Quantity discount applied:</strong> -{formatCurrency(breakdown.quantityDiscount)}
          </div>
        )}
      </div>

      <div className="pf-file-info" style={{ marginBottom: 24 }}>
        <div className="pf-file-name">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          {fileName}
        </div>
      </div>

      <div className="pf-btn-group">
        <button
          type="button"
          className="pf-btn pf-btn-secondary"
          onClick={onBack}
        >
          ← Modify Options
        </button>
        <button
          type="button"
          className="pf-btn pf-btn-primary"
          onClick={onConfirm}
          style={{ flex: 1 }}
        >
          Submit Quote Request →
        </button>
      </div>
    </div>
  );
}
