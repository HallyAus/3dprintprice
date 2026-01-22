'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCurrency } from '@printforge/shared';
import type { PricingConfig } from '@printforge/shared';

export default function PricingPage() {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPricing()
      .then(setConfig)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof PricingConfig, value: number | string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
    setSuccess(false);
  };

  const handleMaterialChange = (index: number, field: string, value: number | boolean | string[]) => {
    if (!config) return;
    const materials = [...config.materials];
    materials[index] = { ...materials[index], [field]: value };
    setConfig({ ...config, materials });
    setSuccess(false);
  };

  const handleQualityChange = (index: number, field: string, value: number) => {
    if (!config) return;
    const qualityMultipliers = [...config.qualityMultipliers];
    qualityMultipliers[index] = { ...qualityMultipliers[index], [field]: value };
    setConfig({ ...config, qualityMultipliers });
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const updated = await api.updatePricing(config);
      setConfig(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--error)' }}>{error || 'Failed to load pricing'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pricing Configuration</h1>
          <p className="page-subtitle">Configure your pricing rates and margins</p>
        </div>
        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 12, marginBottom: 20, color: '#991b1b' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: 12, marginBottom: 20, color: '#166534' }}>
          Pricing saved successfully!
        </div>
      )}

      {/* Base Rates */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Base Rates</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="label">Labour Rate ($/hr)</label>
            <input
              type="number"
              className="input"
              value={config.labourRatePerHour}
              onChange={(e) => handleChange('labourRatePerHour', parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
            />
            <span className="form-hint">Hourly rate for labour/handling</span>
          </div>
          <div className="form-group">
            <label className="label">Machine Rate ($/hr)</label>
            <input
              type="number"
              className="input"
              value={config.machineRatePerHour}
              onChange={(e) => handleChange('machineRatePerHour', parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
            />
            <span className="form-hint">Hourly rate for machine time</span>
          </div>
          <div className="form-group">
            <label className="label">Setup Fee ($)</label>
            <input
              type="number"
              className="input"
              value={config.setupFee}
              onChange={(e) => handleChange('setupFee', parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
            />
            <span className="form-hint">Fixed fee per order</span>
          </div>
          <div className="form-group">
            <label className="label">Minimum Charge ($)</label>
            <input
              type="number"
              className="input"
              value={config.minimumCharge}
              onChange={(e) => handleChange('minimumCharge', parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
            />
            <span className="form-hint">Minimum order total</span>
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 20 }}>
          <div className="form-group">
            <label className="label">Markup (%)</label>
            <input
              type="number"
              className="input"
              value={config.markupPercent * 100}
              onChange={(e) => handleChange('markupPercent', (parseFloat(e.target.value) || 0) / 100)}
              step="1"
              min="0"
              max="200"
            />
            <span className="form-hint">Profit margin added to cost</span>
          </div>
          <div className="form-group">
            <label className="label">Estimate Variance (%)</label>
            <input
              type="number"
              className="input"
              value={config.estimateVariance * 100}
              onChange={(e) => handleChange('estimateVariance', (parseFloat(e.target.value) || 0) / 100)}
              step="1"
              min="0"
              max="50"
            />
            <span className="form-hint">±% for price range</span>
          </div>
        </div>
      </div>

      {/* Material Pricing */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Material Pricing</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Rate ($/g)</th>
                <th>Waste Factor (%)</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {config.materials.map((material, index) => (
                <tr key={material.material}>
                  <td style={{ fontWeight: 500 }}>{material.material}</td>
                  <td>
                    <input
                      type="number"
                      className="input"
                      value={material.ratePerGram}
                      onChange={(e) => handleMaterialChange(index, 'ratePerGram', parseFloat(e.target.value) || 0)}
                      step="0.001"
                      min="0"
                      style={{ width: 100 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input"
                      value={material.wasteFactor * 100}
                      onChange={(e) => handleMaterialChange(index, 'wasteFactor', (parseFloat(e.target.value) || 0) / 100)}
                      step="1"
                      min="0"
                      max="100"
                      style={{ width: 80 }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={material.enabled}
                      onChange={(e) => handleMaterialChange(index, 'enabled', e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quality Multipliers */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Quality Multipliers</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Layer Height (mm)</th>
                <th>Price Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {config.qualityMultipliers.map((quality, index) => (
                <tr key={quality.profile}>
                  <td style={{ fontWeight: 500 }}>{quality.profile}</td>
                  <td>
                    <input
                      type="number"
                      className="input"
                      value={quality.layerHeight}
                      onChange={(e) => handleQualityChange(index, 'layerHeight', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0.04"
                      max="0.5"
                      style={{ width: 100 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input"
                      value={quality.multiplier}
                      onChange={(e) => handleQualityChange(index, 'multiplier', parseFloat(e.target.value) || 0)}
                      step="0.1"
                      min="0.5"
                      max="3"
                      style={{ width: 100 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="form-hint" style={{ marginTop: 12 }}>
          Multiplier is applied to the total cost. Draft (0.9) = 10% cheaper, Fine (1.2) = 20% more expensive.
        </p>
      </div>

      {/* Quantity Discounts */}
      <div className="card">
        <h3 style={{ marginBottom: 20 }}>Quantity Discounts</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Min Qty</th>
                <th>Max Qty</th>
                <th>Discount (%)</th>
              </tr>
            </thead>
            <tbody>
              {config.quantityDiscounts.map((discount, index) => (
                <tr key={index}>
                  <td>{discount.minQuantity}</td>
                  <td>{discount.maxQuantity || '∞'}</td>
                  <td>{(discount.discountPercent * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
