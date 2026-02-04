// Platform types
export interface Platform {
  id: string;
  name: string;
  aspectRatio: string;
  width: number;
  height: number;
  icon: string;
  color: string;
}

// Crop strategy types
export type CropStrategy = 'smart-crop' | 'center-crop';

// Video types
export interface VideoFile {
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
}

// Face detection types
export interface FaceDetection {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

// Crop region types
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  targetAspectRatio: string;
}

// Black bar detection result
export interface BlackBarsDetection {
  hasBlackBars: boolean;
  top: number; // Upper black bar height
  bottom: number; // Lower black bar height
  left: number; // Left black bar width
  right: number; // Right black bar width
  safeArea: {
    // Effective picture area
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Speaker trajectory point
export interface SpeakerTrajectoryPoint {
  timestamp: number; // Time in seconds
  boundingBox: {
    // Speaker bounding box
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  isSpeaking?: boolean;
}

// Video clip
export interface VideoClip {
  id: string;
  startTime: number;
  endTime: number;
  cropPosition: { x: number; y: number };
  speakerCenter: { x: number; y: number };
  useFullFrame?: boolean; // If true, use 9:16 full frame for two speakers
}

// Edit project
export interface EditProject {
  clips: VideoClip[];
  blackBars: BlackBarsDetection | null;
  trajectory: SpeakerTrajectoryPoint[];
  targetAspectRatio: string;
}
