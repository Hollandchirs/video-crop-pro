import { VideoFile, CropRegion } from "./types";

/**
 * Load video file and get metadata
 */
export async function loadVideoFile(file: File): Promise<VideoFile> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.addEventListener("loadedmetadata", () => {
      resolve({
        file,
        url,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    });

    video.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    });

    video.src = url;
  });
}

/**
 * Extract frame from video at specific time
 */
export async function extractFrame(
  videoUrl: string,
  time: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.currentTime = time;
    video.muted = true;
    video.crossOrigin = "anonymous";

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl);
    });

    video.addEventListener("error", () => {
      reject(new Error("Failed to extract frame"));
    });

    video.src = videoUrl;
  });
}

/**
 * Calculate crop region for target aspect ratio
 */
export function calculateCropRegion(
  videoWidth: number,
  videoHeight: number,
  targetAspectRatio: string,
  faceX?: number,
  faceY?: number,
  faceWidth?: number,
  faceHeight?: number
): CropRegion {
  const [targetW, targetH] = targetAspectRatio.split(":").map(Number);
  const targetRatio = targetW / targetH;
  const videoRatio = videoWidth / videoHeight;

  let cropWidth: number;
  let cropHeight: number;
  let x: number;
  let y: number;

  if (videoRatio > targetRatio) {
    // Video is wider, crop width
    cropHeight = videoHeight;
    cropWidth = cropHeight * targetRatio;
    y = 0;

    // Center on face if available
    if (faceX !== undefined && faceWidth !== undefined) {
      const faceCenter = faceX + faceWidth / 2;
      x = Math.max(0, Math.min(faceCenter - cropWidth / 2, videoWidth - cropWidth));
    } else {
      x = (videoWidth - cropWidth) / 2;
    }
  } else {
    // Video is taller, crop height
    cropWidth = videoWidth;
    cropHeight = cropWidth / targetRatio;
    x = 0;

    // Center on face if available
    if (faceY !== undefined && faceHeight !== undefined) {
      const faceCenter = faceY + faceHeight / 2;
      y = Math.max(0, Math.min(faceCenter - cropHeight / 2, videoHeight - cropHeight));
    } else {
      y = (videoHeight - cropHeight) / 2;
    }
  }

  return { x, y, width: cropWidth, height: cropHeight, targetAspectRatio };
}

/**
 * Format time in seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
