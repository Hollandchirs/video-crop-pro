import { SpeakerTrajectoryPoint, VideoClip, FaceDetection } from "./types";

/**
 * Clip strategy types based on AutoCrop-Vertical algorithm
 * - TRACK: Focus on single speaker, crop to speaker
 * - LETTERBOX: Multiple speakers too far apart, show full frame with letterbox
 */
export type ClipStrategy = "TRACK" | "LETTERBOX";

/**
 * Frame analysis result with speaker detection info
 */
export interface FrameAnalysis {
  timestamp: number;
  faces: FaceDetection[];
  speakingFaceIndex: number | null; // Index of the speaking face, null if no one speaking
  strategy: ClipStrategy;
  cropPosition: { x: number; y: number };
}

/**
 * Analyze a single frame and determine the crop strategy
 * Based on AutoCrop-Vertical algorithm:
 * - If single speaker or speakers are close together: TRACK (focus on speaker)
 * - If multiple speakers are far apart: LETTERBOX (show full frame)
 * 
 * @param faces Detected faces in the frame
 * @param speakingFaceIndex Index of the currently speaking face (or null)
 * @param videoWidth Source video width
 * @param videoHeight Source video height
 * @param cropWidth Target crop width
 * @param cropHeight Target crop height
 */
export function analyzeFrameStrategy(
  faces: FaceDetection[],
  speakingFaceIndex: number | null,
  videoWidth: number,
  videoHeight: number,
  cropWidth: number,
  cropHeight: number
): { strategy: ClipStrategy; cropPosition: { x: number; y: number } } {
  // No faces detected - center crop
  if (faces.length === 0) {
    return {
      strategy: "TRACK",
      cropPosition: {
        x: Math.max(0, (videoWidth - cropWidth) / 2),
        y: Math.max(0, (videoHeight - cropHeight) / 2),
      },
    };
  }

  // Single face - track it
  if (faces.length === 1) {
    const face = faces[0];
    return {
      strategy: "TRACK",
      cropPosition: getCenteredCropPositionFromFace(
        face,
        videoWidth,
        videoHeight,
        cropWidth,
        cropHeight
      ),
    };
  }

  // Multiple faces - check if they can fit in the crop region
  const allFacesBoundingBox = getFacesBoundingBox(faces);
  const faceSpread = allFacesBoundingBox.width;
  
  // Calculate the threshold - if faces spread is more than 80% of crop width, use letterbox
  const spreadThreshold = cropWidth * 0.8;
  
  if (faceSpread > spreadThreshold) {
    // Faces are too spread out - use LETTERBOX strategy
    // Center the crop on all faces
    return {
      strategy: "LETTERBOX",
      cropPosition: {
        x: Math.max(0, Math.min(
          allFacesBoundingBox.x + allFacesBoundingBox.width / 2 - cropWidth / 2,
          videoWidth - cropWidth
        )),
        y: Math.max(0, Math.min(
          allFacesBoundingBox.y + allFacesBoundingBox.height / 2 - cropHeight / 2,
          videoHeight - cropHeight
        )),
      },
    };
  }

  // Faces are close together - track the speaking person or best face
  const targetFace = speakingFaceIndex !== null 
    ? faces[speakingFaceIndex] 
    : faces.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

  return {
    strategy: "TRACK",
    cropPosition: getCenteredCropPositionFromFace(
      targetFace,
      videoWidth,
      videoHeight,
      cropWidth,
      cropHeight
    ),
  };
}

/**
 * Get the bounding box that contains all faces
 */
function getFacesBoundingBox(faces: FaceDetection[]): { x: number; y: number; width: number; height: number } {
  if (faces.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const face of faces) {
    minX = Math.min(minX, face.boundingBox.x);
    minY = Math.min(minY, face.boundingBox.y);
    maxX = Math.max(maxX, face.boundingBox.x + face.boundingBox.width);
    maxY = Math.max(maxY, face.boundingBox.y + face.boundingBox.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate centered crop position from face
 */
function getCenteredCropPositionFromFace(
  face: FaceDetection,
  videoWidth: number,
  videoHeight: number,
  cropWidth: number,
  cropHeight: number
): { x: number; y: number } {
  const faceCenter = {
    x: face.boundingBox.x + face.boundingBox.width / 2,
    y: face.boundingBox.y + face.boundingBox.height / 2,
  };

  // Offset to keep face in upper third of frame (better for talking head videos)
  const verticalOffset = cropHeight * 0.1;

  let x = faceCenter.x - cropWidth / 2;
  let y = faceCenter.y - cropHeight / 2 + verticalOffset;

  // Clamp to video bounds
  x = Math.max(0, Math.min(x, videoWidth - cropWidth));
  y = Math.max(0, Math.min(y, videoHeight - cropHeight));

  return { x, y };
}

/**
 * Generate hard-cut clips based on frame analysis
 * Following AutoCrop-Vertical algorithm:
 * - Fixed 0.5s sampling interval
 * - Hard cuts when speaker changes significantly
 * - LETTERBOX when multiple speakers are dense
 * 
 * @param frameAnalyses Array of frame analysis results (from 0.5s interval sampling)
 * @param videoWidth Source video width
 * @param videoHeight Source video height
 * @param cropWidth Target crop width
 * @param cropHeight Target crop height
 * @param videoDuration Total video duration
 */
export function generateHardCutClipsFromAnalysis(
  frameAnalyses: FrameAnalysis[],
  videoWidth: number,
  videoHeight: number,
  cropWidth: number,
  cropHeight: number,
  videoDuration: number
): VideoClip[] {
  console.log("[ClipGenerator] Generating hard-cut clips from frame analysis...");

  if (frameAnalyses.length === 0) {
    console.log("[ClipGenerator] No frame analyses - creating single centered clip");
    return [createSingleClip(videoWidth, videoHeight, cropWidth, cropHeight, videoDuration)];
  }

  const clips: VideoClip[] = [];
  const minClipDuration = 2.0; // Minimum 2 seconds per clip to avoid too rapid cuts
  const positionThreshold = 100; // Position change threshold (pixels)

  let currentClipStart = 0;
  let currentStrategy = frameAnalyses[0].strategy;
  let currentCropPos = frameAnalyses[0].cropPosition;

  for (let i = 1; i < frameAnalyses.length; i++) {
    const analysis = frameAnalyses[i];
    const clipDuration = analysis.timestamp - currentClipStart;

    // Check if we need to create a new clip
    const positionDiff = Math.hypot(
      analysis.cropPosition.x - currentCropPos.x,
      analysis.cropPosition.y - currentCropPos.y
    );

    const strategyChanged = analysis.strategy !== currentStrategy;
    const significantMove = positionDiff > positionThreshold;

    // Create new clip if:
    // 1. Strategy changed (TRACK <-> LETTERBOX)
    // 2. Significant position change and clip is long enough
    const shouldCreateNewClip = 
      strategyChanged || 
      (significantMove && clipDuration >= minClipDuration);

    if (shouldCreateNewClip) {
      console.log(`[ClipGenerator] New clip at ${analysis.timestamp.toFixed(1)}s - strategy: ${analysis.strategy}, moved: ${positionDiff.toFixed(0)}px`);

      clips.push(createClip(
        currentClipStart,
        analysis.timestamp,
        currentCropPos,
        cropWidth,
        cropHeight,
        currentStrategy === "LETTERBOX"
      ));

      currentClipStart = analysis.timestamp;
      currentStrategy = analysis.strategy;
      currentCropPos = analysis.cropPosition;
    }
  }

  // Add final clip
  clips.push(createClip(
    currentClipStart,
    videoDuration,
    currentCropPos,
    cropWidth,
    cropHeight,
    currentStrategy === "LETTERBOX"
  ));

  console.log(`[ClipGenerator] Generated ${clips.length} hard-cut clips`);

  // Merge very short clips
  return mergeShortClips(clips, minClipDuration);
}

/**
 * Merge clips that are too short
 */
function mergeShortClips(clips: VideoClip[], minDuration: number): VideoClip[] {
  if (clips.length <= 1) return clips;

  const merged: VideoClip[] = [];

  for (const clip of clips) {
    const duration = clip.endTime - clip.startTime;
    
    if (merged.length === 0) {
      merged.push(clip);
      continue;
    }

    const lastClip = merged[merged.length - 1];
    const lastDuration = lastClip.endTime - lastClip.startTime;

    // If current clip is too short, merge with previous
    if (duration < minDuration) {
      lastClip.endTime = clip.endTime;
    } 
    // If previous clip is too short, merge current into it
    else if (lastDuration < minDuration) {
      lastClip.endTime = clip.endTime;
      lastClip.cropPosition = clip.cropPosition;
      lastClip.useFullFrame = clip.useFullFrame;
    } 
    else {
      merged.push(clip);
    }
  }

  return merged;
}

/**
 * Legacy function - generate clips from trajectory (backward compatibility)
 */
export async function generateHardCutClips(
  trajectory: SpeakerTrajectoryPoint[],
  allFacesAtFrame: Map<number, FaceDetection[]>,
  videoWidth: number,
  videoHeight: number,
  cropWidth: number,
  cropHeight: number,
  videoDuration: number
): Promise<VideoClip[]> {
  console.log("[ClipGenerator] Generating speaker-following clips (legacy)...");

  if (trajectory.length === 0) {
    console.log("[ClipGenerator] No trajectory points - creating single centered clip");
    return [createSingleClip(videoWidth, videoHeight, cropWidth, cropHeight, videoDuration)];
  }

  // Convert trajectory to frame analyses
  const frameAnalyses: FrameAnalysis[] = trajectory.map((point, index) => {
    const faces = allFacesAtFrame.get(point.timestamp) || [{
      boundingBox: point.boundingBox,
      confidence: point.confidence,
    }];

    const { strategy, cropPosition } = analyzeFrameStrategy(
      faces,
      point.isSpeaking ? 0 : null,
      videoWidth,
      videoHeight,
      cropWidth,
      cropHeight
    );

    return {
      timestamp: point.timestamp,
      faces,
      speakingFaceIndex: point.isSpeaking ? 0 : null,
      strategy,
      cropPosition,
    };
  });

  return generateHardCutClipsFromAnalysis(
    frameAnalyses,
    videoWidth,
    videoHeight,
    cropWidth,
    cropHeight,
    videoDuration
  );
}

/**
 * Create a clip object
 */
function createClip(
  startTime: number,
  endTime: number,
  cropPosition: { x: number; y: number },
  cropWidth: number,
  cropHeight: number,
  useFullFrame: boolean
): VideoClip {
  return {
    id: generateId(),
    startTime,
    endTime,
    cropPosition,
    speakerCenter: {
      x: cropPosition.x + cropWidth / 2,
      y: cropPosition.y + cropHeight / 2,
    },
    useFullFrame,
  };
}

/**
 * Create single centered clip
 */
function createSingleClip(
  videoWidth: number,
  videoHeight: number,
  cropWidth: number,
  cropHeight: number,
  duration: number
): VideoClip {
  return {
    id: generateId(),
    startTime: 0,
    endTime: duration,
    cropPosition: {
      x: (videoWidth - cropWidth) / 2,
      y: (videoHeight - cropHeight) / 2,
    },
    speakerCenter: {
      x: videoWidth / 2,
      y: videoHeight / 2,
    },
    useFullFrame: false,
  };
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Merge similar adjacent clips (position threshold based)
 */
export function mergeSimilarClips(clips: VideoClip[], positionThreshold: number = 50): VideoClip[] {
  if (clips.length <= 1) return clips;

  const merged: VideoClip[] = [clips[0]];

  for (let i = 1; i < clips.length; i++) {
    const current = clips[i];
    const last = merged[merged.length - 1];

    const positionDiff = Math.hypot(
      current.cropPosition.x - last.cropPosition.x,
      current.cropPosition.y - last.cropPosition.y
    );

    // Merge if positions are similar and both have same fullFrame setting
    if (positionDiff < positionThreshold && current.useFullFrame === last.useFullFrame) {
      last.endTime = current.endTime;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Legacy function for backward compatibility
 */
export async function generateSmartClips(
  trajectory: SpeakerTrajectoryPoint[],
  videoWidth: number,
  videoHeight: number,
  cropWidth: number,
  cropHeight: number,
  options?: {
    minClipDuration?: number;
    padding?: number;
  }
): Promise<VideoClip[]> {
  return generateHardCutClips(
    trajectory,
    new Map(),
    videoWidth,
    videoHeight,
    cropWidth,
    cropHeight,
    trajectory.length > 0 ? trajectory[trajectory.length - 1].timestamp + 1 : 0
  );
}
