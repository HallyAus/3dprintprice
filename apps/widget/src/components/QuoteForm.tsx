import React, { useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import type { PublicConfig, QuoteResponse, QualityProfile } from '@printforge/shared';

interface QuoteFormProps {
  apiUrl: string;
  shopId: string;
  config: PublicConfig;
  fileKey: string;
  sessionId: string;
  fileName: string;
  fileSize: number;
  onSubmit: (response: QuoteResponse) => void;
  onBack: () => void;
  onError: (error: string) => void;
}

interface FormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  material: string;
  colour: string;
  quantity: number;
  quality: QualityProfile;
  infill: number;
}

interface FormErrors {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  material?: string;
  colour?: string;
  quantity?: string;
}

export function QuoteForm({
  apiUrl,
  shopId,
  config,
  fileKey,
  sessionId,
  fileName,
  fileSize,
  onSubmit,
  onBack,
  onError,
}: QuoteFormProps) {
  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: '',
    material: config.materials[0]?.material || 'PLA',
    colour: config.materials[0]?.colours[0] || 'White',
    quantity: 1,
    quality: 'Standard',
    infill: 20,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const api = useApi(apiUrl);

  const selectedMaterial = config.materials.find(m => m.material === formData.material);
  const availableColours = selectedMaterial?.colours || [];

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Name is required';
    }

    if (!formData.customerEmail.trim()) {
      newErrors.customerEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'Invalid email address';
    }

    if (formData.customerPhone && !/^(\+61|0)[2-478](\d{8}|\d{4}\s?\d{4})$/.test(formData.customerPhone.replace(/\s/g, ''))) {
      newErrors.customerPhone = 'Invalid Australian phone number';
    }

    if (!formData.material) {
      newErrors.material = 'Please select a material';
    }

    if (!formData.colour) {
      newErrors.colour = 'Please select a colour';
    }

    if (formData.quantity < 1 || formData.quantity > 1000) {
      newErrors.quantity = 'Quantity must be between 1 and 1000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));

    // Clear error when field is modified
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleMaterialChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const material = e.target.value;
    const materialConfig = config.materials.find(m => m.material === material);
    setFormData(prev => ({
      ...prev,
      material,
      colour: materialConfig?.colours[0] || '',
    }));
  }, [config.materials]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    onError('');

    try {
      const response = await api.submitQuote({
        shopId,
        sessionId,
        customerName: formData.customerName.trim(),
        customerEmail: formData.customerEmail.trim(),
        customerPhone: formData.customerPhone.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        material: formData.material,
        colour: formData.colour,
        quantity: formData.quantity,
        quality: formData.quality,
        infill: formData.infill,
        fileKey,
        fileName,
        fileSize,
      });

      onSubmit(response);
    } catch (err) {
      console.error('Quote submission failed:', err);
      onError(err instanceof Error ? err.message : 'Failed to submit quote. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [api, shopId, sessionId, formData, fileKey, fileName, fileSize, validateForm, onSubmit, onError]);

  return (
    <form className="pf-form" onSubmit={handleSubmit}>
      {/* Contact details */}
      <div className="pf-form-row">
        <div className="pf-form-group">
          <label className="pf-label" htmlFor="customerName">Name *</label>
          <input
            type="text"
            id="customerName"
            name="customerName"
            className={`pf-input ${errors.customerName ? 'error' : ''}`}
            value={formData.customerName}
            onChange={handleInputChange}
            placeholder="Your name"
            disabled={submitting}
          />
          {errors.customerName && <span className="pf-error-text">{errors.customerName}</span>}
        </div>

        <div className="pf-form-group">
          <label className="pf-label" htmlFor="customerEmail">Email *</label>
          <input
            type="email"
            id="customerEmail"
            name="customerEmail"
            className={`pf-input ${errors.customerEmail ? 'error' : ''}`}
            value={formData.customerEmail}
            onChange={handleInputChange}
            placeholder="you@example.com"
            disabled={submitting}
          />
          {errors.customerEmail && <span className="pf-error-text">{errors.customerEmail}</span>}
        </div>
      </div>

      <div className="pf-form-group">
        <label className="pf-label" htmlFor="customerPhone">Phone (optional)</label>
        <input
          type="tel"
          id="customerPhone"
          name="customerPhone"
          className={`pf-input ${errors.customerPhone ? 'error' : ''}`}
          value={formData.customerPhone}
          onChange={handleInputChange}
          placeholder="04XX XXX XXX"
          disabled={submitting}
        />
        {errors.customerPhone && <span className="pf-error-text">{errors.customerPhone}</span>}
        <span className="pf-hint">Australian mobile or landline</span>
      </div>

      {/* Print options */}
      <div className="pf-form-row">
        <div className="pf-form-group">
          <label className="pf-label" htmlFor="material">Material *</label>
          <select
            id="material"
            name="material"
            className={`pf-select ${errors.material ? 'error' : ''}`}
            value={formData.material}
            onChange={handleMaterialChange}
            disabled={submitting}
          >
            {config.materials.map(m => (
              <option key={m.material} value={m.material}>{m.material}</option>
            ))}
          </select>
          {errors.material && <span className="pf-error-text">{errors.material}</span>}
        </div>

        <div className="pf-form-group">
          <label className="pf-label" htmlFor="colour">Colour *</label>
          <select
            id="colour"
            name="colour"
            className={`pf-select ${errors.colour ? 'error' : ''}`}
            value={formData.colour}
            onChange={handleInputChange}
            disabled={submitting}
          >
            {availableColours.map(colour => (
              <option key={colour} value={colour}>{colour}</option>
            ))}
          </select>
          {errors.colour && <span className="pf-error-text">{errors.colour}</span>}
        </div>
      </div>

      <div className="pf-form-row">
        <div className="pf-form-group">
          <label className="pf-label" htmlFor="quality">Quality</label>
          <select
            id="quality"
            name="quality"
            className="pf-select"
            value={formData.quality}
            onChange={handleInputChange}
            disabled={submitting}
          >
            <option value="Draft">Draft (0.28mm) - Fastest</option>
            <option value="Standard">Standard (0.20mm) - Balanced</option>
            <option value="Fine">Fine (0.12mm) - Best detail</option>
          </select>
        </div>

        <div className="pf-form-group">
          <label className="pf-label" htmlFor="quantity">Quantity *</label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            className={`pf-input ${errors.quantity ? 'error' : ''}`}
            value={formData.quantity}
            onChange={handleInputChange}
            min={1}
            max={1000}
            disabled={submitting}
          />
          {errors.quantity && <span className="pf-error-text">{errors.quantity}</span>}
        </div>
      </div>

      <div className="pf-form-group">
        <label className="pf-label" htmlFor="infill">Infill: {formData.infill}%</label>
        <input
          type="range"
          id="infill"
          name="infill"
          className="pf-input"
          value={formData.infill}
          onChange={handleInputChange}
          min={10}
          max={100}
          step={5}
          disabled={submitting}
        />
        <span className="pf-hint">
          Lower = faster & cheaper, Higher = stronger
        </span>
      </div>

      <div className="pf-form-group">
        <label className="pf-label" htmlFor="notes">Additional Notes</label>
        <textarea
          id="notes"
          name="notes"
          className="pf-textarea"
          value={formData.notes}
          onChange={handleInputChange}
          placeholder="Any special requirements or notes about your print..."
          disabled={submitting}
        />
      </div>

      <div className="pf-btn-group">
        <button
          type="button"
          className="pf-btn pf-btn-secondary"
          onClick={onBack}
          disabled={submitting}
        >
          ← Back
        </button>
        <button
          type="submit"
          className="pf-btn pf-btn-primary"
          style={{ flex: 1 }}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="pf-spinner" style={{ width: 16, height: 16 }} />
              Calculating...
            </>
          ) : (
            'Get Quote →'
          )}
        </button>
      </div>
    </form>
  );
}
