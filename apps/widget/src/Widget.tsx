import React, { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { StlViewer } from './components/StlViewer';
import { QuoteForm } from './components/QuoteForm';
import { QuoteResult } from './components/QuoteResult';
import { SuccessView } from './components/SuccessView';
import { useApi } from './hooks/useApi';
import type { PublicConfig, QuoteResponse } from '@printforge/shared';

type Step = 'upload' | 'configure' | 'result' | 'success';

interface UploadedFile {
  file: File;
  fileKey: string;
  sessionId: string;
  dimensions?: { x: number; y: number; z: number };
}

interface WidgetProps {
  shopId: string;
  apiUrl: string;
}

export function Widget({ shopId, apiUrl }: WidgetProps) {
  const [step, setStep] = useState<Step>('upload');
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const api = useApi(apiUrl);

  // Load public config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const publicConfig = await api.getPublicConfig(shopId);
        setConfig(publicConfig);
      } catch (err) {
        console.error('Failed to load config:', err);
        setError('Failed to load widget configuration. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [api, shopId]);

  const handleFileUploaded = useCallback((file: File, fileKey: string, sessionId: string) => {
    setUploadedFile({ file, fileKey, sessionId });
    setStep('configure');
    setError(null);
  }, []);

  const handleDimensionsLoaded = useCallback((dimensions: { x: number; y: number; z: number }) => {
    setUploadedFile(prev => prev ? { ...prev, dimensions } : null);
  }, []);

  const handleQuoteSubmitted = useCallback((response: QuoteResponse) => {
    setQuoteResponse(response);
    setStep('result');
  }, []);

  const handleConfirm = useCallback(() => {
    setStep('success');
  }, []);

  const handleReset = useCallback(() => {
    setStep('upload');
    setUploadedFile(null);
    setQuoteResponse(null);
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'configure') {
      setStep('upload');
      setUploadedFile(null);
    } else if (step === 'result') {
      setStep('configure');
    }
  }, [step]);

  if (loading) {
    return (
      <div className="pf-widget">
        <div className="pf-container">
          <div className="pf-loading">
            <div className="pf-spinner" />
            <p className="pf-loading-text">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="pf-widget">
        <div className="pf-container">
          <div className="pf-error-container">
            <h3 className="pf-error-title">Error</h3>
            <p className="pf-error-message">{error}</p>
          </div>
          <button className="pf-btn pf-btn-primary pf-btn-full" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div className="pf-widget">
      <div className="pf-container">
        <div className="pf-header">
          <h1 className="pf-title">Get a 3D Print Quote</h1>
          <p className="pf-subtitle">Upload your model and receive an instant estimate</p>
        </div>

        {/* Step indicator */}
        <div className="pf-steps">
          <div className={`pf-step ${step === 'upload' ? 'active' : uploadedFile ? 'completed' : ''}`}>
            <span className="pf-step-number">{uploadedFile ? '✓' : '1'}</span>
            <span>Upload</span>
          </div>
          <div className="pf-step-divider" />
          <div className={`pf-step ${step === 'configure' ? 'active' : quoteResponse ? 'completed' : ''}`}>
            <span className="pf-step-number">{quoteResponse ? '✓' : '2'}</span>
            <span>Configure</span>
          </div>
          <div className="pf-step-divider" />
          <div className={`pf-step ${step === 'result' || step === 'success' ? 'active' : ''}`}>
            <span className="pf-step-number">3</span>
            <span>Quote</span>
          </div>
        </div>

        {error && (
          <div className="pf-error-container">
            <h3 className="pf-error-title">Error</h3>
            <p className="pf-error-message">{error}</p>
          </div>
        )}

        {step === 'upload' && (
          <FileUpload
            apiUrl={apiUrl}
            shopId={shopId}
            config={config}
            onFileUploaded={handleFileUploaded}
            onError={setError}
          />
        )}

        {step === 'configure' && uploadedFile && (
          <>
            <div className="pf-viewer-container">
              <StlViewer
                file={uploadedFile.file}
                onDimensionsLoaded={handleDimensionsLoaded}
              />
              <div className="pf-file-info">
                <div className="pf-file-name">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                  {uploadedFile.file.name}
                  <span className="pf-file-size">
                    ({(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                {uploadedFile.dimensions && (
                  <div className="pf-dimensions">
                    {uploadedFile.dimensions.x.toFixed(1)} × {uploadedFile.dimensions.y.toFixed(1)} × {uploadedFile.dimensions.z.toFixed(1)} mm
                  </div>
                )}
              </div>
            </div>

            <QuoteForm
              apiUrl={apiUrl}
              shopId={shopId}
              config={config}
              fileKey={uploadedFile.fileKey}
              sessionId={uploadedFile.sessionId}
              fileName={uploadedFile.file.name}
              fileSize={uploadedFile.file.size}
              onSubmit={handleQuoteSubmitted}
              onBack={handleBack}
              onError={setError}
            />
          </>
        )}

        {step === 'result' && quoteResponse && uploadedFile && (
          <QuoteResult
            response={quoteResponse}
            fileName={uploadedFile.file.name}
            onConfirm={handleConfirm}
            onBack={handleBack}
          />
        )}

        {step === 'success' && quoteResponse && (
          <SuccessView
            submissionId={quoteResponse.submissionId}
            onNewQuote={handleReset}
          />
        )}

        <p className="pf-disclaimer">
          * This is an estimated quote. Final pricing may vary based on detailed review of your model.
          All prices are in AUD and include GST.
        </p>
      </div>
    </div>
  );
}
