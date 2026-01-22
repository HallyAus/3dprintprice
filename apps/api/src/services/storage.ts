import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO and some S3-compatible services
});

/**
 * Generate a presigned URL for uploading a file
 */
export async function getUploadUrl(
  fileName: string,
  contentType: string,
  shopId: string
): Promise<{ uploadUrl: string; fileKey: string }> {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'stl';
  const fileKey = `uploads/${shopId}/${nanoid()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return { uploadUrl, fileKey };
}

/**
 * Generate a presigned URL for downloading a file
 */
export async function getDownloadUrl(
  fileKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: fileKey,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Upload a file directly to S3
 */
export async function uploadFile(
  fileKey: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: fileKey,
    Body: data,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

/**
 * Download a file from S3
 */
export async function downloadFile(fileKey: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: fileKey,
  });

  const response = await s3Client.send(command);
  const stream = response.Body as NodeJS.ReadableStream;

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }

  return Buffer.concat(chunks);
}

/**
 * Delete a file from S3
 */
export async function deleteFile(fileKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: fileKey,
  });

  await s3Client.send(command);
}

/**
 * Check if a file exists in S3
 */
export async function fileExists(fileKey: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: fileKey,
    });

    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate SHA-256 hash of file contents
 */
export function calculateFileHash(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Get content type from file extension
 */
export function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    stl: 'application/sla',
    '3mf': 'model/3mf',
    obj: 'model/obj',
  };

  return contentTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Validate file extension
 */
export function isValidFileExtension(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['stl', '3mf', 'obj'].includes(ext || '');
}
