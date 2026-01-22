import React from 'react';

interface SuccessViewProps {
  submissionId: string;
  onNewQuote: () => void;
}

export function SuccessView({ submissionId, onNewQuote }: SuccessViewProps) {
  return (
    <div className="pf-success-container">
      <svg className="pf-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>

      <h2 className="pf-success-title">Quote Request Submitted!</h2>

      <p className="pf-success-message">
        Thank you for your request. We've sent a confirmation to your email address.
        Our team will review your model and get back to you within 1-2 business days
        with a final quote.
      </p>

      <div className="pf-submission-id">
        Reference: {submissionId}
      </div>

      <button
        type="button"
        className="pf-btn pf-btn-secondary"
        onClick={onNewQuote}
        style={{ marginTop: 24 }}
      >
        Submit Another Quote
      </button>
    </div>
  );
}
