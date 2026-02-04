import { BlackBarsDetection } from "./types";

/**
 * Detect black bars within a specific crop area by sampling edge pixels at multiple time points
 * @param videoUrl URL of the video to analyze
 * @param duration Video duration in seconds
 * @param cropArea The crop area to check for black bars (optional, checks whole video if not provided)
 * @returns BlackBarsDetection result with safe area information
 */
export async function detectBlackBars(
  videoUrl: string,
  duration: number,
  cropArea?: { x: number; y: number; width: number; height: number }
): Promise<BlackBarsDetection> {
  console.log("[BlackBarDetector] Starting black bar detection...");

  // Create video element for analysis
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video"));
  });

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  // If crop area is provided, only analyze that area
  const analysisArea = cropArea || { x: 0, y: 0, width: videoWidth, height: videoHeight };

  console.log("[BlackBarDetector] Analyzing area:", analysisArea);

  // Sample at multiple time points (0%, 25%, 50%, 75%, 100%)
  const samplePoints = [0, 0.25, 0.5, 0.75, 1.0];
  const maxTop = [0];
  const maxBottom = [0];
  const maxLeft = [0];
  const maxRight = [0];

  for (const progress of samplePoints) {
    const time = duration * progress;
    video.currentTime = time;

    await new Promise<void>((resolve) => {
      const onSeek = () => {
        video.removeEventListener("seeked", onSeek);
        resolve();
      };
      video.addEventListener("seeked", onSeek);
    });

    // Wait a bit for the frame to render
    await new Promise((r) => setTimeout(r, 100));

    const bars = await detectBlackBarsInFrame(video, analysisArea);
    maxTop.push(bars.top);
    maxBottom.push(bars.bottom);
    maxLeft.push(bars.left);
    maxRight.push(bars.right);
  }

  // Use the maximum detected black bars across all frames
  const top = Math.max(...maxTop);
  const bottom = Math.max(...maxBottom);
  const left = Math.max(...maxLeft);
  const right = Math.max(...maxRight);

  const hasBlackBars = top > 0 || bottom > 0 || left > 0 || right > 0;

  // Calculate safe area (excluding black bars) - relative to crop area
  const safeArea = {
    x: analysisArea.x + left,
    y: analysisArea.y + top,
    width: analysisArea.width - left - right,
    height: analysisArea.height - top - bottom,
  };

  console.log("[BlackBarDetector] Detection complete:", {
    hasBlackBars,
    top,
    bottom,
    left,
    right,
    safeArea,
  });

  return {
    hasBlackBars,
    top,
    bottom,
    left,
    right,
    safeArea,
  };
}

/**
 * Detect black bars in a single video frame within a specific area
 * @param video Video element at the desired frame
 * @param analysisArea The area to analyze (x, y, width, height)
 * @returns Black bar dimensions
 */
async function detectBlackBarsInFrame(
  video: HTMLVideoElement,
  analysisArea: { x: number; y: number; width: number; height: number }
): Promise<{ top: number; bottom: number; left: number; right: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  ctx.drawImage(video, 0, 0);

  // Only get image data for the analysis area
  const imageData = ctx.getImageData(
    Math.floor(analysisArea.x),
    Math.floor(analysisArea.y),
    Math.floor(analysisArea.width),
    Math.floor(analysisArea.height)
  );
  const data = imageData.data;

  // Black threshold (very dark pixels)
  const blackThreshold = 30;

  // Detect top black bar (within analysis area)
  let top = 0;
  for (let y = 0; y < analysisArea.height / 2; y++) {
    const rowIsBlack = isRowBlackInArea(data, y, analysisArea.width, blackThreshold);
    if (!rowIsBlack) break;
    top++;
  }

  // Detect bottom black bar (within analysis area)
  let bottom = 0;
  for (let y = analysisArea.height - 1; y >= analysisArea.height / 2; y--) {
    const rowIsBlack = isRowBlackInArea(data, y, analysisArea.width, blackThreshold);
    if (!rowIsBlack) break;
    bottom++;
  }

  // Detect left black bar (within analysis area)
  let left = 0;
  for (let x = 0; x < analysisArea.width / 2; x++) {
    const colIsBlack = isColumnBlackInArea(data, x, analysisArea.height, analysisArea.width, blackThreshold);
    if (!colIsBlack) break;
    left++;
  }

  // Detect right black bar (within analysis area)
  let right = 0;
  for (let x = analysisArea.width - 1; x >= analysisArea.width / 2; x--) {
    const colIsBlack = isColumnBlackInArea(data, x, analysisArea.height, analysisArea.width, blackThreshold);
    if (!colIsBlack) break;
    right++;
  }

  // Only consider bars larger than 3 pixels (ignore edge noise, was 5)
  const minBarSize = 3;
  top = top >= minBarSize ? top : 0;
  bottom = bottom >= minBarSize ? bottom : 0;
  left = left >= minBarSize ? left : 0;
  right = right >= minBarSize ? right : 0;

  return { top, bottom, left, right };
}

/**
 * Check if a row is mostly black (within analysis area)
 */
function isRowBlackInArea(
  data: Uint8ClampedArray,
  y: number,
  width: number,
  threshold: number
): boolean {
  let blackPixels = 0;
  const checkWidth = Math.min(width, 100); // Check at most 100 pixels per row

  for (let x = 0; x < checkWidth; x++) {
    const idx = (y * width + x) * 4;
    const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    if (brightness < threshold) {
      blackPixels++;
    }
  }

  // Consider row black if at least 90% of pixels are black
  return blackPixels / checkWidth > 0.9;
}

/**
 * Check if a column is mostly black (within analysis area)
 */
function isColumnBlackInArea(
  data: Uint8ClampedArray,
  x: number,
  height: number,
  width: number,
  threshold: number
): boolean {
  let blackPixels = 0;
  const checkHeight = Math.min(height, 100);

  for (let y = 0; y < checkHeight; y++) {
    const idx = (y * width + x) * 4;
    const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    if (brightness < threshold) {
      blackPixels++;
    }
  }

  return blackPixels / checkHeight > 0.9;
}

/**
 * Apply black bar crop to get the safe area
 * @param originalWidth Original video width
 * @param originalHeight Original video height
 * @param blackBars Detected black bars
 * @returns Safe area rectangle
 */
export function applyBlackBarCrop(
  originalWidth: number,
  originalHeight: number,
  blackBars: BlackBarsDetection
): { x: number; y: number; width: number; height: number } {
  return {
    x: blackBars.left,
    y: blackBars.top,
    width: originalWidth - blackBars.left - blackBars.right,
    height: originalHeight - blackBars.top - blackBars.bottom,
  };
}
