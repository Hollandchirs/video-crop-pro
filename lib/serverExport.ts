/**
 * Server-side Video Export System
 *
 * Architecture:
 * - Vercel Blob: Storage (upload/download videos)
 * - Railway: Video processing service with FFmpeg
 */

import { put, del } from '@vercel/blob';

// ============================================================
// CONFIG
// ============================================================

const PROCESSOR_SERVICE_URL = process.env.PROCESSOR_SERVICE_URL || 'http://localhost:3001';

// ============================================================
// TYPES
// ============================================================

export interface VideoClip {
  startTime: number;
  endTime: number;
  cropPosition: { x: number; y: number };
  cropScale?: number;
  useFullFrame?: boolean;
}

export interface ExportRequest {
  videoUrl: string;           // Vercel Blob URL
  clips: VideoClip[];
  width: number;
  height: number;
  strategy: 'smart-crop' | 'center-crop';
  sourceRegion?: { width: number; height: number };
}

export interface ExportJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  error?: string;
}

// ============================================================
// STORAGE (Vercel Blob)
// ============================================================

/**
 * Upload video to Vercel Blob
 */
export async function uploadVideo(file: File): Promise<string> {
  const blob = await put(file.name, file, {
    access: 'public',
  });

  return blob.url;
}

/**
 * Delete video from Vercel Blob
 */
export async function deleteVideo(url: string): Promise<void> {
  try {
    await del(url);
  } catch (e) {
    console.error('Failed to delete video:', e);
  }
}

// ============================================================
// VIDEO PROCESSING (Railway Service)
// ============================================================

/**
 * Submit export job to processing service
 */
export async function submitExportJob(request: ExportRequest): Promise<string> {
  const response = await fetch(`${PROCESSOR_SERVICE_URL}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit job: ${response.statusText}`);
  }

  const { jobId } = await response.json();
  return jobId;
}

/**
 * Poll job status
 */
export async function getJobStatus(jobId: string): Promise<ExportJob> {
  const response = await fetch(`${PROCESSOR_SERVICE_URL}/status/${jobId}`);

  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Wait for job completion with polling
 */
export async function waitForJob(
  jobId: string,
  onProgress?: (progress: number) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  const POLL_INTERVAL = 1000; // 1 second

  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      if (abortSignal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      try {
        const job = await getJobStatus(jobId);

        if (onProgress) {
          onProgress(job.progress);
        }

        if (job.status === 'completed') {
          resolve(job.outputUrl!);
        } else if (job.status === 'failed') {
          reject(new Error(job.error || 'Export failed'));
        } else {
          // Continue polling
          setTimeout(checkStatus, POLL_INTERVAL);
        }
      } catch (e) {
        reject(e);
      }
    };

    checkStatus();
  });
}

// ============================================================
// MAIN EXPORT FUNCTION
// ============================================================

/**
 * Server-side video export
 * Fast, reliable, with perfect audio-video sync
 */
export async function serverSideExport(
  videoFile: File,
  clips: VideoClip[],
  width: number,
  height: number,
  strategy: 'smart-crop' | 'center-crop' = 'smart-crop',
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal,
  sourceRegion?: { width: number; height: number }
): Promise<Blob> {
  // Step 1: Upload video to Vercel Blob
  if (onProgress) onProgress(5);

  const videoUrl = await uploadVideo(videoFile);
  console.log('[Server Export] Video uploaded:', videoUrl);

  if (abortSignal?.aborted) {
    await deleteVideo(videoUrl);
    throw new DOMException('Aborted', 'AbortError');
  }

  try {
    // Step 2: Submit export job
    if (onProgress) onProgress(10);

    const jobId = await submitExportJob({
      videoUrl,
      clips,
      width,
      height,
      strategy,
      sourceRegion,
    });
    console.log('[Server Export] Job submitted:', jobId);

    // Step 3: Wait for completion
    const outputUrl = await waitForJob(jobId, (progress) => {
      if (onProgress) onProgress(10 + Math.round(progress * 0.8));
    }, abortSignal);

    console.log('[Server Export] Job completed:', outputUrl);

    // Step 4: Download result
    if (onProgress) onProgress(95);

    const response = await fetch(outputUrl);
    if (!response.ok) {
      throw new Error(`Failed to download output: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Step 5: Cleanup
    await deleteVideo(videoUrl);
    // Note: output URL cleanup handled by processor service TTL

    if (onProgress) onProgress(100);

    return blob;
  } catch (e) {
    // Cleanup on error
    await deleteVideo(videoUrl);
    throw e;
  }
}
