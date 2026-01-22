import React, { useState, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import type { PublicConfig } from '@printforge/shared';

interface FileUploadProps {
  apiUrl: string;
  shopId: string;
  config: PublicConfig;
  onFileUploaded: (file: File, fileKey: string, sessionId: string) => void;
  onError: (error: string) => void;
}

export function FileUpload({ apiUrl, shopId, config, onFileUploaded, onError }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const api = useApi(apiUrl);

  const validateFile = useCallback((file: File): string | null => {
    // Check file extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!config.acceptedFileTypes.includes(ext)) {
      return `Invalid file type. Accepted types: ${config.acceptedFileTypes.join(', ')}`;
    }

    // Check file size
    const maxBytes = config.maxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File too large. Maximum size: ${config.maxFileSizeMb} MB`;
    }

    return null;
  }, [config]);

  const handleUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      onError(validationError);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    onError('');

    try {
      // Get upload URL
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const { uploadUrl, fileKey, sessionId } = await api.initUpload({
        shopId,
        fileName: file.name,
        fileSize: file.size,
        fileType: ext,
      });

      // Upload file
      await api.uploadFile(uploadUrl, file, setUploadProgress);

      // Success
      onFileUploaded(file, fileKey, sessionId);
    } catch (err) {
      console.error('Upload failed:', err);
      onError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [api, shopId, validateFile, onFileUploaded, onError]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  if (uploading) {
    return (
      <div className="pf-upload-area">
        <div className="pf-loading">
          <div className="pf-spinner" />
          <p className="pf-loading-text">Uploading your model...</p>
        </div>
        <div className="pf-progress-container">
          <div className="pf-progress">
            <div className="pf-progress-bar" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="pf-progress-text">{uploadProgress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pf-upload-area ${isDragging ? 'dragover' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <svg className="pf-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>

      <p className="pf-upload-text">
        Drag and drop your 3D model here, or <strong>click to browse</strong>
      </p>
      <p className="pf-upload-hint">
        Supported formats: {config.acceptedFileTypes.join(', ')} (max {config.maxFileSizeMb} MB)
      </p>

      <input
        ref={inputRef}
        type="file"
        className="pf-upload-input"
        accept={config.acceptedFileTypes.join(',')}
        onChange={handleInputChange}
      />
    </div>
  );
}
