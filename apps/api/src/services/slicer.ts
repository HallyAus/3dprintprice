import { spawn } from 'child_process';
import { writeFile, unlink, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { query } from '../db/index.js';
import { downloadFile } from './storage.js';
import type { SlicingResult, QualityProfile } from '@printforge/shared';

// Slicer profile configurations
const QUALITY_PROFILES: Record<QualityProfile, { layerHeight: number; infillPercent?: number }> = {
  Draft: { layerHeight: 0.28 },
  Standard: { layerHeight: 0.20 },
  Fine: { layerHeight: 0.12 },
};

const PRINTER_PROFILES: Record<string, { profileName: string; configPath?: string }> = {
  'generic-fdm': { profileName: 'Generic FDM' },
  'bambu-p1s': { profileName: 'Bambu P1S' },
};

/**
 * Generate a settings hash for caching
 */
function generateSettingsHash(
  quality: QualityProfile,
  infill: number,
  printer: string
): string {
  const settings = `${quality}-${infill}-${printer}`;
  return createHash('md5').update(settings).digest('hex').substring(0, 16);
}

/**
 * Check if we have a cached result for this file + settings
 */
async function getCachedResult(
  fileHash: string,
  settingsHash: string
): Promise<SlicingResult | null> {
  const result = await query<{
    print_time_seconds: number;
    filament_grams: number;
    filament_metres: number;
    bbox_x: number;
    bbox_y: number;
    bbox_z: number;
    triangle_count: number;
    layer_count: number;
  }>(
    `SELECT print_time_seconds, filament_grams, filament_metres,
            bbox_x, bbox_y, bbox_z, triangle_count, layer_count
     FROM slicing_cache
     WHERE file_hash = $1 AND settings_hash = $2`,
    [fileHash, settingsHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    printTimeSeconds: row.print_time_seconds,
    filamentGrams: Number(row.filament_grams),
    filamentMetres: Number(row.filament_metres),
    boundingBox: {
      x: Number(row.bbox_x),
      y: Number(row.bbox_y),
      z: Number(row.bbox_z),
    },
    triangleCount: row.triangle_count,
    layerCount: row.layer_count,
    settingsHash,
  };
}

/**
 * Cache slicing result
 */
async function cacheResult(
  fileHash: string,
  settingsHash: string,
  result: SlicingResult
): Promise<void> {
  await query(
    `INSERT INTO slicing_cache (
       file_hash, settings_hash, print_time_seconds, filament_grams,
       filament_metres, bbox_x, bbox_y, bbox_z, triangle_count, layer_count
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (file_hash, settings_hash) DO UPDATE SET
       print_time_seconds = EXCLUDED.print_time_seconds,
       filament_grams = EXCLUDED.filament_grams,
       filament_metres = EXCLUDED.filament_metres,
       bbox_x = EXCLUDED.bbox_x,
       bbox_y = EXCLUDED.bbox_y,
       bbox_z = EXCLUDED.bbox_z,
       triangle_count = EXCLUDED.triangle_count,
       layer_count = EXCLUDED.layer_count`,
    [
      fileHash,
      settingsHash,
      result.printTimeSeconds,
      result.filamentGrams,
      result.filamentMetres,
      result.boundingBox.x,
      result.boundingBox.y,
      result.boundingBox.z,
      result.triangleCount,
      result.layerCount,
    ]
  );
}

/**
 * Parse PrusaSlicer output to extract metrics
 */
function parseSlicerOutput(output: string): Partial<SlicingResult> {
  const result: Partial<SlicingResult> = {};

  // Parse print time (format: "estimated printing time (normal mode) = 1h 23m 45s")
  const timeMatch = output.match(/estimated printing time.*?=\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i);
  if (timeMatch) {
    const days = parseInt(timeMatch[1] || '0', 10);
    const hours = parseInt(timeMatch[2] || '0', 10);
    const minutes = parseInt(timeMatch[3] || '0', 10);
    const seconds = parseInt(timeMatch[4] || '0', 10);
    result.printTimeSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  // Parse filament used (format: "filament used [mm] = 12345.67" or "filament used [g] = 123.45")
  const filamentMmMatch = output.match(/filament used \[mm\]\s*=\s*([\d.]+)/i);
  if (filamentMmMatch) {
    result.filamentMetres = parseFloat(filamentMmMatch[1]) / 1000;
  }

  const filamentGMatch = output.match(/filament used \[g\]\s*=\s*([\d.]+)/i);
  if (filamentGMatch) {
    result.filamentGrams = parseFloat(filamentGMatch[1]);
  }

  // If we only have mm, estimate grams (PLA density ~1.24 g/cm³, 1.75mm filament)
  if (result.filamentMetres && !result.filamentGrams) {
    const filamentDiameter = 1.75; // mm
    const density = 1.24; // g/cm³
    const volumeCm3 = Math.PI * Math.pow(filamentDiameter / 20, 2) * (result.filamentMetres * 100);
    result.filamentGrams = volumeCm3 * density;
  }

  // Parse layer count
  const layerMatch = output.match(/total layers count\s*=\s*(\d+)/i);
  if (layerMatch) {
    result.layerCount = parseInt(layerMatch[1], 10);
  }

  return result;
}

/**
 * Parse STL file to get bounding box and triangle count
 */
function parseStlGeometry(data: Buffer): { boundingBox: { x: number; y: number; z: number }; triangleCount: number } {
  // Check if binary or ASCII STL
  const header = data.toString('utf-8', 0, 80);
  const isBinary = !header.toLowerCase().startsWith('solid') || data.length > 84 && data.readUInt32LE(80) > 0;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let triangleCount = 0;

  if (isBinary) {
    // Binary STL format
    triangleCount = data.readUInt32LE(80);
    let offset = 84;

    for (let i = 0; i < triangleCount && offset + 50 <= data.length; i++) {
      // Skip normal (12 bytes)
      offset += 12;

      // Read 3 vertices (36 bytes)
      for (let v = 0; v < 3; v++) {
        const x = data.readFloatLE(offset);
        const y = data.readFloatLE(offset + 4);
        const z = data.readFloatLE(offset + 8);
        offset += 12;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
      }

      // Skip attribute byte count (2 bytes)
      offset += 2;
    }
  } else {
    // ASCII STL format
    const content = data.toString('utf-8');
    const vertexRegex = /vertex\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)/gi;
    let match;

    while ((match = vertexRegex.exec(content)) !== null) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      const z = parseFloat(match[3]);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);

      triangleCount++;
    }

    // Each facet has 3 vertices
    triangleCount = Math.floor(triangleCount / 3);
  }

  return {
    boundingBox: {
      x: Math.round((maxX - minX) * 100) / 100,
      y: Math.round((maxY - minY) * 100) / 100,
      z: Math.round((maxZ - minZ) * 100) / 100,
    },
    triangleCount,
  };
}

/**
 * Run PrusaSlicer CLI to slice a model
 */
async function runPrusaSlicer(
  inputPath: string,
  outputPath: string,
  quality: QualityProfile,
  infill: number
): Promise<string> {
  const qualityConfig = QUALITY_PROFILES[quality];

  return new Promise((resolve, reject) => {
    const args = [
      '--export-gcode',
      '--output', outputPath,
      '--layer-height', qualityConfig.layerHeight.toString(),
      '--fill-density', `${infill}%`,
      '--nozzle-diameter', '0.4',
      '--filament-diameter', '1.75',
      '--print-center', '125,105',
      inputPath,
    ];

    const slicer = spawn(env.SLICER_PATH, args);

    let stdout = '';
    let stderr = '';

    slicer.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    slicer.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    slicer.on('close', (code) => {
      if (code === 0) {
        resolve(stdout + stderr);
      } else {
        reject(new Error(`PrusaSlicer exited with code ${code}: ${stderr}`));
      }
    });

    slicer.on('error', (err) => {
      reject(new Error(`Failed to start PrusaSlicer: ${err.message}`));
    });
  });
}

/**
 * Slice a 3D model and return metrics
 */
export async function sliceModel(
  fileKey: string,
  fileHash: string,
  quality: QualityProfile,
  infill: number,
  printer: string = 'generic-fdm'
): Promise<SlicingResult> {
  const settingsHash = generateSettingsHash(quality, infill, printer);

  // Check cache first
  const cached = await getCachedResult(fileHash, settingsHash);
  if (cached) {
    console.log(`Using cached slicing result for ${fileHash}:${settingsHash}`);
    return cached;
  }

  // Download file from S3
  const fileData = await downloadFile(fileKey);

  // Parse geometry from STL to get bounding box and triangle count
  const geometry = parseStlGeometry(fileData);

  // Create temp directory for slicing
  const tempDir = join(tmpdir(), 'printforge-slicer', nanoid());
  await mkdir(tempDir, { recursive: true });

  const inputPath = join(tempDir, 'input.stl');
  const outputPath = join(tempDir, 'output.gcode');

  try {
    // Write file to temp location
    await writeFile(inputPath, fileData);

    // Run slicer
    const slicerOutput = await runPrusaSlicer(inputPath, outputPath, quality, infill);

    // Parse slicer output
    const parsed = parseSlicerOutput(slicerOutput);

    // If slicer didn't provide all metrics, estimate based on geometry
    const result: SlicingResult = {
      printTimeSeconds: parsed.printTimeSeconds || estimatePrintTime(geometry.boundingBox, quality, infill),
      filamentGrams: parsed.filamentGrams || estimateFilamentGrams(geometry.boundingBox, infill),
      filamentMetres: parsed.filamentMetres || (parsed.filamentGrams || estimateFilamentGrams(geometry.boundingBox, infill)) / 2.98,
      boundingBox: geometry.boundingBox,
      triangleCount: geometry.triangleCount,
      layerCount: parsed.layerCount || estimateLayerCount(geometry.boundingBox.z, quality),
      settingsHash,
    };

    // Cache the result
    await cacheResult(fileHash, settingsHash, result);

    return result;
  } finally {
    // Cleanup temp files
    try {
      await unlink(inputPath);
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Estimate print time based on geometry (fallback when slicer fails)
 */
function estimatePrintTime(
  boundingBox: { x: number; y: number; z: number },
  quality: QualityProfile,
  infill: number
): number {
  const volume = boundingBox.x * boundingBox.y * boundingBox.z;
  const qualityConfig = QUALITY_PROFILES[quality];

  // Rough estimate: time = volume * infill factor * layer height factor
  const baseTimePerMm3 = 0.001; // seconds per mm³
  const infillFactor = 0.3 + (infill / 100) * 0.7;
  const layerFactor = 0.2 / qualityConfig.layerHeight;

  return Math.round(volume * baseTimePerMm3 * infillFactor * layerFactor);
}

/**
 * Estimate filament usage in grams (fallback when slicer fails)
 */
function estimateFilamentGrams(
  boundingBox: { x: number; y: number; z: number },
  infill: number
): number {
  const volume = boundingBox.x * boundingBox.y * boundingBox.z;

  // Rough estimate: grams = volume * effective fill ratio * density
  // Average infill + shell walls typically use about 10-30% of bounding volume
  const effectiveFill = 0.05 + (infill / 100) * 0.25;
  const density = 1.24; // PLA density in g/cm³

  return Math.round((volume / 1000) * effectiveFill * density * 100) / 100;
}

/**
 * Estimate layer count
 */
function estimateLayerCount(height: number, quality: QualityProfile): number {
  const qualityConfig = QUALITY_PROFILES[quality];
  return Math.ceil(height / qualityConfig.layerHeight);
}

/**
 * Quick geometry analysis without full slicing (for preview)
 */
export async function analyzeGeometry(
  fileKey: string
): Promise<{ boundingBox: { x: number; y: number; z: number }; triangleCount: number }> {
  const fileData = await downloadFile(fileKey);
  return parseStlGeometry(fileData);
}
