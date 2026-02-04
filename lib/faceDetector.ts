import { FaceDetector, FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { FaceDetection } from "./types";

let detector: FaceDetector | null = null;
let videoDetector: FaceDetector | null = null; // Separate detector for VIDEO mode
let faceLandmarker: FaceLandmarker | null = null; // For detecting speaking person via mouth movement (VIDEO mode)
let faceLandmarkerImage: FaceLandmarker | null = null; // For detecting speaking person (IMAGE mode - more stable)
let isInitializing = false;

// Store previous mouth states for each face to detect movement
const mouthMovementHistory = new Map<string, { openness: number; timestamp: number }[]>();

/**
 * Initialize MediaPipe Face Detector (IMAGE mode for single frame detection)
 */
export async function initFaceDetector(): Promise<FaceDetector> {
  if (detector) {
    return detector;
  }

  if (isInitializing) {
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (detector) return detector;
  }

  isInitializing = true;

  try {
    console.log("[FaceDetector] Initializing...");
    // Try different CDN sources
    const cdnUrls = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm",
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.10/wasm",
      "https://unpkg.com/@mediapipe/tasks-vision@0.10.9/wasm",
    ];

    let lastError: Error | null = null;

    for (const cdnUrl of cdnUrls) {
      try {
        console.log("[FaceDetector] Trying CDN:", cdnUrl);
        const vision = await FilesetResolver.forVisionTasks(cdnUrl);

        // Try with short range model first (more reliable)
        try {
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "GPU",
            },
            runningMode: "IMAGE",
          });
          console.log("[FaceDetector] Initialized successfully with GPU (short range model)");
          return detector;
        } catch (gpuError) {
          console.warn("[FaceDetector] GPU failed, trying CPU with this CDN...", gpuError);
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "CPU",
            },
            runningMode: "IMAGE",
          });
          console.log("[FaceDetector] Initialized with CPU (short range model)");
          return detector;
        }
      } catch (e) {
        console.log("[FaceDetector] CDN failed:", cdnUrl, e);
        lastError = e instanceof Error ? e : new Error(String(e));
        continue;
      }
    }

    throw lastError || new Error("All CDN sources failed");
  } catch (error) {
    console.error("[FaceDetector] Initialization failed:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Initialize MediaPipe Face Landmarker (for detecting speaking person via mouth movement)
 */
export async function initFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) {
    return faceLandmarker;
  }

  if (isInitializing) {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (faceLandmarker) return faceLandmarker;
  }

  isInitializing = true;

  try {
    console.log("[FaceLandmarker] Initializing...");
    const cdnUrls = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm",
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.10/wasm",
      "https://unpkg.com/@mediapipe/tasks-vision@0.10.9/wasm",
    ];

    let lastError: Error | null = null;

    for (const cdnUrl of cdnUrls) {
      try {
        console.log("[FaceLandmarker] Trying CDN:", cdnUrl);
        const vision = await FilesetResolver.forVisionTasks(cdnUrl);

        try {
          faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            outputFaceBlendshapes: true, // Need blendshapes for mouth movement
            outputFacialTransformationMatrixes: false,
            numFaces: 5, // Detect up to 5 faces
            runningMode: "VIDEO",
          });
          console.log("[FaceLandmarker] Initialized with GPU");
          return faceLandmarker;
        } catch (gpuError) {
          console.warn("[FaceLandmarker] GPU failed, trying CPU...", gpuError);
          faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU",
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: false,
            numFaces: 5,
            runningMode: "VIDEO",
          });
          console.log("[FaceLandmarker] Initialized with CPU");
          return faceLandmarker;
        }
      } catch (e) {
        console.log("[FaceLandmarker] CDN failed:", cdnUrl, e);
        lastError = e instanceof Error ? e : new Error(String(e));
        continue;
      }
    }

    throw lastError || new Error("All CDN sources failed");
  } catch (error) {
    console.error("[FaceLandmarker] Initialization failed:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Initialize MediaPipe Face Landmarker in IMAGE mode (more stable, no timestamp issues)
 */
export async function initFaceLandmarkerImage(): Promise<FaceLandmarker> {
  if (faceLandmarkerImage) {
    return faceLandmarkerImage;
  }

  if (isInitializing) {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (faceLandmarkerImage) return faceLandmarkerImage;
  }

  isInitializing = true;

  try {
    console.log("[FaceLandmarkerImage] Initializing...");
    const cdnUrls = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm",
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.10/wasm",
      "https://unpkg.com/@mediapipe/tasks-vision@0.10.9/wasm",
    ];

    let lastError: Error | null = null;

    for (const cdnUrl of cdnUrls) {
      try {
        console.log("[FaceLandmarkerImage] Trying CDN:", cdnUrl);
        const vision = await FilesetResolver.forVisionTasks(cdnUrl);

        try {
          faceLandmarkerImage = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            outputFaceBlendshapes: true, // Need blendshapes for mouth movement
            outputFacialTransformationMatrixes: false,
            numFaces: 5, // Detect up to 5 faces
            runningMode: "IMAGE", // IMAGE mode - no timestamp needed
          });
          console.log("[FaceLandmarkerImage] Initialized with GPU");
          return faceLandmarkerImage;
        } catch (gpuError) {
          console.warn("[FaceLandmarkerImage] GPU failed, trying CPU...", gpuError);
          faceLandmarkerImage = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU",
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: false,
            numFaces: 5,
            runningMode: "IMAGE",
          });
          console.log("[FaceLandmarkerImage] Initialized with CPU");
          return faceLandmarkerImage;
        }
      } catch (e) {
        console.log("[FaceLandmarkerImage] CDN failed:", cdnUrl, e);
        lastError = e instanceof Error ? e : new Error(String(e));
        continue;
      }
    }

    throw lastError || new Error("All CDN sources failed");
  } catch (error) {
    console.error("[FaceLandmarkerImage] Initialization failed:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Initialize MediaPipe Face Detector in VIDEO mode (for real-time tracking)
 */
export async function initVideoFaceDetector(): Promise<FaceDetector> {
  if (videoDetector) {
    return videoDetector;
  }

  // Reuse the same initialization logic but create a VIDEO mode detector
  if (isInitializing) {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (videoDetector) return videoDetector;
  }

  isInitializing = true;

  try {
    console.log("[VideoFaceDetector] Initializing VIDEO mode...");
    const cdnUrls = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm",
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.10/wasm",
      "https://unpkg.com/@mediapipe/tasks-vision@0.10.9/wasm",
    ];

    let lastError: Error | null = null;

    for (const cdnUrl of cdnUrls) {
      try {
        console.log("[VideoFaceDetector] Trying CDN:", cdnUrl);
        const vision = await FilesetResolver.forVisionTasks(cdnUrl);

        try {
          videoDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
          });
          console.log("[VideoFaceDetector] Initialized VIDEO mode with GPU");
          return videoDetector;
        } catch (gpuError) {
          console.warn("[VideoFaceDetector] GPU failed, trying CPU...", gpuError);
          videoDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
          });
          console.log("[VideoFaceDetector] Initialized VIDEO mode with CPU");
          return videoDetector;
        }
      } catch (e) {
        console.log("[VideoFaceDetector] CDN failed:", cdnUrl, e);
        lastError = e instanceof Error ? e : new Error(String(e));
        continue;
      }
    }

    throw lastError || new Error("All CDN sources failed");
  } catch (error) {
    console.error("[VideoFaceDetector] Initialization failed:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Detect faces in a video element (from current frame)
 */
export async function detectFacesFromVideo(
  video: HTMLVideoElement
): Promise<FaceDetection[]> {
  console.log("[FaceDetection] Starting face detection");
  console.log("[FaceDetection] Video dimensions:", video.videoWidth, "x", video.videoHeight);
  console.log("[FaceDetection] Video readyState:", video.readyState, "currentTime:", video.currentTime);

  // Validate video dimensions
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    console.error("[FaceDetection] Invalid video dimensions:", video.videoWidth, video.videoHeight);
    return [];
  }

  // Validate video is ready
  if (video.readyState < 2) {
    console.error("[FaceDetection] Video not ready (readyState < 2):", video.readyState);
    return [];
  }

  const faceDetector = await initFaceDetector();

  // Create a canvas to capture the current video frame
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Draw the current frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Check multiple pixels to verify canvas has content
  const centerPixel = ctx.getImageData(
    Math.floor(canvas.width / 2),
    Math.floor(canvas.height / 2),
    1, 1
  ).data;
  const topLeftPixel = ctx.getImageData(0, 0, 1, 1).data;

  console.log("[FaceDetection] Center pixel:", centerPixel);
  console.log("[FaceDetection] Top-left pixel:", topLeftPixel);

  const hasContent =
    centerPixel[3] > 0 || centerPixel[0] > 0 || centerPixel[1] > 0 || centerPixel[2] > 0 ||
    topLeftPixel[3] > 0 || topLeftPixel[0] > 0 || topLeftPixel[1] > 0 || topLeftPixel[2] > 0;

  console.log("[FaceDetection] Canvas has content:", hasContent);

  if (!hasContent) {
    console.warn("[FaceDetection] Canvas appears to be empty! Video might not be rendering.");
    // Try to draw again with a slight delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const retryPixel = ctx.getImageData(
      Math.floor(canvas.width / 2),
      Math.floor(canvas.height / 2),
      1, 1
    ).data;
    console.log("[FaceDetection] Retry center pixel:", retryPixel);
  }

  // Detect faces - use detect() with IMAGE mode (for single frame detection)
  // Note: VIDEO mode requires detectForVideo() with timestamp, but we're doing single frame
  console.log("[FaceDetection] Running detection on", canvas.width, "x", canvas.height, "canvas");
  const result = faceDetector.detect(canvas);
  console.log("[FaceDetection] Detection result:", result.detections.length, "faces found");

  if (result.detections.length > 0) {
    result.detections.forEach((d, i) => {
      console.log(`[FaceDetection] Face ${i + 1}:`, {
        bbox: d.boundingBox,
        score: d.categories[0]?.score
      });
    });
  } else {
    console.warn("[FaceDetection] No faces detected in current frame");
  }

  return result.detections.map((d) => ({
    boundingBox: {
      x: d.boundingBox!.originX,
      y: d.boundingBox!.originY,
      width: d.boundingBox!.width,
      height: d.boundingBox!.height,
    },
    confidence: d.categories[0]?.score ?? 0,
  }));
}

/**
 * Detect faces from an image data URL
 */
export async function detectFacesFromDataUrl(
  dataUrl: string
): Promise<FaceDetection[]> {
  const faceDetector = await initFaceDetector();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const result = faceDetector.detect(img);
        const detections = result.detections.map((d) => ({
          boundingBox: {
            x: d.boundingBox!.originX,
            y: d.boundingBox!.originY,
            width: d.boundingBox!.width,
            height: d.boundingBox!.height,
          },
          confidence: d.categories[0]?.score ?? 0,
        }));
        resolve(detections);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

/**
 * Get the best face (highest confidence) from detections
 */
export function getBestFace(detections: FaceDetection[]): FaceDetection | null {
  if (detections.length === 0) return null;
  return detections.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}

/**
 * Detect faces from video in real-time (IMAGE mode for stability)
 * Uses IMAGE mode to avoid timestamp synchronization issues
 */
export async function detectFacesFromVideoRealtime(
  video: HTMLVideoElement,
  timestamp: number
): Promise<FaceDetection[]> {
  // Validate video dimensions
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return [];
  }

  // Validate video is ready
  if (video.readyState < 2) {
    return [];
  }

  try {
    const faceDetector = await initFaceDetector();

    // Create canvas to capture current frame
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return [];
    }

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to image for better MediaPipe compatibility
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = faceDetector.detect(img);
          resolve(result.detections.map((d) => ({
            boundingBox: {
              x: d.boundingBox!.originX,
              y: d.boundingBox!.originY,
              width: d.boundingBox!.width,
              height: d.boundingBox!.height,
            },
            confidence: d.categories[0]?.score ?? 0,
          })));
        } catch (e) {
          resolve([]);
        }
      };
      img.onerror = () => resolve([]);
      img.src = dataUrl;
    });
  } catch (error) {
    // Silently ignore errors to avoid console spam
    return [];
  }
}

/**
 * Extended face detection with speaking person detection
 * Returns faces with additional info about who is speaking
 */
export interface FaceWithSpeakingInfo extends FaceDetection {
  isSpeaking: boolean;
  speakingScore: number;
  faceIndex: number;
}

/**
 * Detect faces and identify the speaking person using mouth movement analysis (IMAGE mode for stability)
 */
export async function detectFacesWithSpeakingDetection(
  video: HTMLVideoElement,
  timestamp: number
): Promise<FaceWithSpeakingInfo[]> {
  // Validate video dimensions
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return [];
  }

  // Validate video is ready
  if (video.readyState < 2) {
    return [];
  }

  try {
    const landmarker = await initFaceLandmarkerImage();

    // Create canvas to capture current frame
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return [];
    }

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to image for better MediaPipe compatibility
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = landmarker.detect(img);

          const faces: FaceWithSpeakingInfo[] = [];

          if (result.faceLandmarks && result.faceBlendshapes) {
            for (let i = 0; i < result.faceLandmarks.length; i++) {
              const landmarks = result.faceLandmarks[i];
              const blendshapes = result.faceBlendshapes[i];

              // Get bounding box from landmarks
              const xs = landmarks.map((p) => p.x);
              const ys = landmarks.map((p) => p.y);
              const minX = Math.min(...xs) * video.videoWidth;
              const maxX = Math.max(...xs) * video.videoWidth;
              const minY = Math.min(...ys) * video.videoHeight;
              const maxY = Math.max(...ys) * video.videoHeight;

              // Calculate mouth openness using blendshapes
              // Key blendshapes for mouth: jawOpen, mouthClose, lipPucker, etc.
              let mouthOpenness = 0;
              if (blendshapes) {
                const jawOpen = blendshapes.categories.find((c) => c.categoryName === "jawOpen")?.score ?? 0;
                const mouthUpper = blendshapes.categories.find((c) => c.categoryName === "mouthUpperUpLeft")?.score ?? 0;
                const mouthLower = blendshapes.categories.find((c) => c.categoryName === "mouthLowerDownLeft")?.score ?? 0;

                // Calculate overall mouth openness (0-1)
                mouthOpenness = (jawOpen * 0.5 + mouthUpper * 0.25 + mouthLower * 0.25);
              }

              // Create face ID for tracking
              const faceId = `${timestamp}-${i}`;

              // Update movement history
              const history = mouthMovementHistory.get(faceId) || [];
              history.push({ openness: mouthOpenness, timestamp });
              // Keep only last 10 frames
              if (history.length > 10) {
                history.shift();
              }
              mouthMovementHistory.set(faceId, history);

              // Calculate speaking score based on mouth movement variance
              let speakingScore = 0;
              let isSpeaking = false;

              if (history.length >= 2) {
                // Calculate variance in mouth openness
                const opennessValues = history.map((h) => h.openness);
                const mean = opennessValues.reduce((a, b) => a + b, 0) / opennessValues.length;
                const variance = opennessValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / opennessValues.length;

                // Calculate movement amplitude (max - min)
                const maxOpenness = Math.max(...opennessValues);
                const minOpenness = Math.min(...opennessValues);
                const amplitude = maxOpenness - minOpenness;

                // Speaking score combines variance and amplitude
                // Also consider average openness (speaking usually involves some mouth opening)
                speakingScore = (variance * 2 + amplitude * 3 + mean * 0.5);

                // Very low threshold - any movement is considered speaking
                isSpeaking = speakingScore > 0.005;

                console.log(`[SpeakingDetection] Face ${i}: openness=${mouthOpenness.toFixed(3)}, score=${speakingScore.toFixed(4)}, isSpeaking=${isSpeaking}`);
              } else {
                // For early frames, use simple mouth openness threshold
                // Lowered from 0.1 to 0.02 - any slight mouth opening is considered speaking
                isSpeaking = mouthOpenness > 0.02;
                speakingScore = mouthOpenness;
                console.log(`[SpeakingDetection] Face ${i} (early): openness=${mouthOpenness.toFixed(3)}, isSpeaking=${isSpeaking}`);
              }

              faces.push({
                boundingBox: {
                  x: minX,
                  y: minY,
                  width: maxX - minX,
                  height: maxY - minY,
                },
                confidence: 0.9, // Face landmarker doesn't provide confidence, use default
                isSpeaking,
                speakingScore,
                faceIndex: i,
              });
            }
          }

          // Clean up old history entries
          const now = timestamp;
          for (const [key, history] of mouthMovementHistory.entries()) {
            const historyTimestamp = parseInt(key.split("-")[0]);
            if (now - historyTimestamp > 2000) { // Remove entries older than 2 seconds
              mouthMovementHistory.delete(key);
            }
          }

          resolve(faces);
        } catch (e) {
          resolve([]);
        }
      };
      img.onerror = () => resolve([]);
      img.src = dataUrl;
    });
  } catch (error) {
    // Silently ignore errors to avoid console spam
    return [];
  }
}

/**
 * Get the speaking person from detected faces
 * Returns the face that is most likely speaking
 */
export function getSpeakingPerson(faces: FaceWithSpeakingInfo[]): FaceWithSpeakingInfo | null {
  if (faces.length === 0) return null;

  // Filter to only faces that are speaking
  const speakingFaces = faces.filter((f) => f.isSpeaking);

  if (speakingFaces.length === 0) {
    // No one is speaking, return the face with highest speaking score
    return faces.reduce((best, current) =>
      current.speakingScore > best.speakingScore ? current : best
    );
  }

  // Return the face with highest speaking score among speaking faces
  return speakingFaces.reduce((best, current) =>
    current.speakingScore > best.speakingScore ? current : best
  );
}

/**
 * Calculate optimal crop position based on face location
 */
export function calculateCropPositionFromFace(
  face: FaceDetection,
  videoWidth: number,
  videoHeight: number,
  cropWidth: number,
  cropHeight: number
): { x: number; y: number } {
  // Calculate face center
  const faceCenter = {
    x: face.boundingBox.x + face.boundingBox.width / 2,
    y: face.boundingBox.y + face.boundingBox.height / 2,
  };

  // Position crop so face is centered (with some offset to keep face in upper third)
  // This is better for portrait/talking head videos
  const verticalOffset = cropHeight * 0.1; // Face slightly above center

  let x = faceCenter.x - cropWidth / 2;
  let y = faceCenter.y - cropHeight / 2 + verticalOffset;

  // Constrain to video bounds
  x = Math.max(0, Math.min(x, videoWidth - cropWidth));
  y = Math.max(0, Math.min(y, videoHeight - cropHeight));

  return { x, y };
}
