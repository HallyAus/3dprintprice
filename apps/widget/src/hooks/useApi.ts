import { useMemo } from 'react';
import type {
  PublicConfig,
  UploadInitResponse,
  QuoteResponse,
} from '@printforge/shared';

export function useApi(baseUrl: string) {
  return useMemo(() => ({
    async getPublicConfig(shopId: string): Promise<PublicConfig> {
      const response = await fetch(`${baseUrl}/v1/config/public?shopId=${encodeURIComponent(shopId)}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || 'Failed to load configuration');
      }

      return response.json();
    },

    async initUpload(data: {
      shopId: string;
      fileName: string;
      fileSize: number;
      fileType: string;
    }): Promise<UploadInitResponse> {
      const response = await fetch(`${baseUrl}/v1/quotes/init-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload initialization failed' }));
        throw new Error(error.message || 'Failed to initialize upload');
      }

      return response.json();
    },

    async uploadFile(uploadUrl: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });
    },

    async analyzeFile(shopId: string, fileKey: string): Promise<{
      boundingBox: { x: number; y: number; z: number };
      triangleCount: number;
    }> {
      const response = await fetch(`${baseUrl}/v1/quotes/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, fileKey }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Analysis failed' }));
        throw new Error(error.message || 'Failed to analyze file');
      }

      return response.json();
    },

    async submitQuote(data: {
      shopId: string;
      sessionId: string;
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      notes?: string;
      material: string;
      colour: string;
      quantity: number;
      quality: string;
      infill?: number;
      fileKey: string;
      fileName: string;
      fileSize: number;
    }): Promise<QuoteResponse> {
      const response = await fetch(`${baseUrl}/v1/quotes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Quote submission failed' }));
        throw new Error(error.message || 'Failed to submit quote');
      }

      return response.json();
    },
  }), [baseUrl]);
}
