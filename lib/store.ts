import { create } from "zustand";
import {
  VideoFile,
  FaceDetection,
  CropRegion,
  CropStrategy,
  BlackBarsDetection,
  SpeakerTrajectoryPoint,
  EditProject,
} from "./types";

interface VideoStore {
  // Video state
  videoFile: VideoFile | null;
  setVideoFile: (file: VideoFile | null) => void;

  // Platform selection
  selectedPlatforms: string[];
  setSelectedPlatforms: (platforms: string[]) => void;
  togglePlatform: (platformId: string) => void;

  // Crop strategy
  cropStrategy: CropStrategy;
  setCropStrategy: (strategy: CropStrategy) => void;

  // Editor state
  currentTime: number;
  setCurrentTime: (time: number) => void;

  // Face detection
  faceDetections: FaceDetection[];
  setFaceDetections: (detections: FaceDetection[]) => void;

  // Crop region
  cropRegion: CropRegion | null;
  setCropRegion: (region: CropRegion | null) => void;

  // Processing state
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;

  // Black bar detection (for the original video)
  blackBars: BlackBarsDetection | null;
  setBlackBars: (bars: BlackBarsDetection | null) => void;

  // Safe area after black bar removal
  safeArea: { x: number; y: number; width: number; height: number } | null;
  setSafeArea: (area: { x: number; y: number; width: number; height: number } | null) => void;

  // Trajectory analysis (kept for backward compatibility but not used for smooth tracking)
  trajectory: SpeakerTrajectoryPoint[];
  setTrajectory: (points: SpeakerTrajectoryPoint[]) => void;

  // Edit project per aspect ratio
  editProjects: Map<string, EditProject>;
  setEditProject: (ratio: string, project: EditProject | null) => void;
  getEditProject: (ratio: string) => EditProject | null;

  // Current edit project (for backward compatibility)
  editProject: EditProject | null;
  setCurrentEditProject: (project: EditProject | null) => void;

  // Selected clip
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;

  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: number;
  setIsAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: number) => void;

  // Analyzed ratios tracking (to know which ratios have been fully analyzed)
  analyzedRatios: Set<string>;
  addAnalyzedRatio: (ratio: string) => void;
  hasAnalyzedRatio: (ratio: string) => boolean;
  clearAnalyzedRatios: () => void;

  // Analysis cancellation
  analysisAbortController: AbortController | null;
  setAnalysisAbortController: (controller: AbortController | null) => void;
  cancelCurrentAnalysis: () => void;

  // Current analyzing ratio
  currentAnalyzingRatio: string | null;
  setCurrentAnalyzingRatio: (ratio: string | null) => void;

  // Preview mode
  previewMode: 'single' | 'clips';
  setPreviewMode: (mode: 'single' | 'clips') => void;

  // Reset
  reset: () => void;
}

export const useVideoStore = create<VideoStore>((set, get) => ({
  // Video state
  videoFile: null,
  setVideoFile: (file) => set({ videoFile: file }),

  // Platform selection
  selectedPlatforms: [],
  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),
  togglePlatform: (platformId) =>
    set((state) => ({
      selectedPlatforms: state.selectedPlatforms.includes(platformId)
        ? state.selectedPlatforms.filter((id) => id !== platformId)
        : [...state.selectedPlatforms, platformId],
    })),

  // Crop strategy
  cropStrategy: "smart-crop",
  setCropStrategy: (strategy) => set({ cropStrategy: strategy }),

  // Editor state
  currentTime: 0,
  setCurrentTime: (time) => set({ currentTime: time }),

  // Face detection
  faceDetections: [],
  setFaceDetections: (detections) => set({ faceDetections: detections }),

  // Crop region
  cropRegion: null,
  setCropRegion: (region) => set({ cropRegion: region }),

  // Processing state
  isProcessing: false,
  setIsProcessing: (processing) => set({ isProcessing: processing }),

  // Black bar detection
  blackBars: null,
  setBlackBars: (bars) => set({ blackBars: bars }),

  // Safe area
  safeArea: null,
  setSafeArea: (area) => set({ safeArea: area }),

  // Trajectory analysis
  trajectory: [],
  setTrajectory: (points) => set({ trajectory: points }),

  // Edit projects per ratio
  editProjects: new Map(),
  setEditProject: (ratio, project) => set((state) => {
    const newProjects = new Map(state.editProjects);
    if (project) {
      newProjects.set(ratio, project);
    } else {
      newProjects.delete(ratio);
    }
    return { editProjects: newProjects };
  }),
  getEditProject: (ratio) => get().editProjects.get(ratio) || null,

  // Current edit project (backward compatibility)
  editProject: null,
  setCurrentEditProject: (project) => set({ editProject: project }),

  // Selected clip
  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  // Analysis state
  isAnalyzing: false,
  analysisProgress: 0,
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),

  // Analyzed ratios
  analyzedRatios: new Set(),
  addAnalyzedRatio: (ratio) => set((state) => {
    const newSet = new Set(state.analyzedRatios);
    newSet.add(ratio);
    return { analyzedRatios: newSet };
  }),
  hasAnalyzedRatio: (ratio) => get().analyzedRatios.has(ratio),
  clearAnalyzedRatios: () => set({ analyzedRatios: new Set() }),

  // Analysis cancellation
  analysisAbortController: null,
  setAnalysisAbortController: (controller) => set({ analysisAbortController: controller }),
  cancelCurrentAnalysis: () => {
    const controller = get().analysisAbortController;
    if (controller) {
      controller.abort();
      console.log("[Store] Analysis cancelled");
    }
    set({ 
      analysisAbortController: null, 
      isAnalyzing: false,
      currentAnalyzingRatio: null,
      analysisProgress: 0,
    });
  },

  // Current analyzing ratio
  currentAnalyzingRatio: null,
  setCurrentAnalyzingRatio: (ratio) => set({ currentAnalyzingRatio: ratio }),

  // Preview mode
  previewMode: "single",
  setPreviewMode: (mode) => set({ previewMode: mode }),

  // Reset
  reset: () =>
    set({
      videoFile: null,
      selectedPlatforms: [],
      currentTime: 0,
      faceDetections: [],
      cropRegion: null,
      cropStrategy: "smart-crop",
      isProcessing: false,
      blackBars: null,
      safeArea: null,
      trajectory: [],
      editProjects: new Map(),
      editProject: null,
      selectedClipId: null,
      isAnalyzing: false,
      analysisProgress: 0,
      analyzedRatios: new Set(),
      analysisAbortController: null,
      currentAnalyzingRatio: null,
      previewMode: "single",
    }),
}));
