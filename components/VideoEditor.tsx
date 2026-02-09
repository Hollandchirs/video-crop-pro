"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useVideoStore } from "@/lib/store";
import { calculateCropRegion } from "@/lib/videoProcessor";
import { getPlatformById } from "@/lib/platforms";
import {
  detectFacesWithSpeakingDetection,
  getSpeakingPerson,
} from "@/lib/faceDetector";
import { FaceDetection, VideoClip, EditProject } from "@/lib/types";
import { detectBlackBars } from "@/lib/blackBarDetector";
import { 
  generateHardCutClipsFromAnalysis, 
  analyzeFrameStrategy,
  mergeSimilarClips,
} from "@/lib/clipGenerator";
import type { FrameAnalysis } from "@/lib/clipGenerator";
import { TimelineEditor } from "./TimelineEditor";
import { saveEditProject, loadEditProject } from "@/lib/editProjectManager";

export function VideoEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  // Touch gesture state for pan and zoom
  const touchStateRef = useRef({
    isPinching: false,
    initialDistance: 0,
    initialCenter: { x: 0, y: 0 },
    initialCropPos: { x: 0, y: 0 },
    initialCropScale: 1,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedClips, setGeneratedClips] = useState<VideoClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const previousRatioRef = useRef<string | null>(null);
  const previousStrategyRef = useRef<string | null>(null);

  const {
    videoFile,
    currentTime,
    setCurrentTime,
    selectedPlatforms,
    cropRegion,
    setCropRegion,
    blackBars,
    setBlackBars,
    safeArea,
    setSafeArea,
    isAnalyzing,
    analysisProgress,
    setIsAnalyzing,
    setAnalysisProgress,
    hasAnalyzedRatio,
    addAnalyzedRatio,
    setAnalysisAbortController,
    cancelCurrentAnalysis,
    currentAnalyzingRatio,
    setCurrentAnalyzingRatio,
    setEditProject,
    setCurrentEditProject,
    cropStrategy,
    setCurrentClips,
  } = useVideoStore();

  const targetPlatform = selectedPlatforms[0]
    ? getPlatformById(selectedPlatforms[0])
    : null;

  // Create default clip when video is loaded (before any analysis)
  useEffect(() => {
    if (videoFile && cropRegion && generatedClips.length === 0) {
      const defaultClip: VideoClip = {
        id: `clip_default_${Date.now()}`,
        startTime: 0,
        endTime: videoFile.duration,
        cropPosition: { x: cropRegion.x, y: cropRegion.y },
        speakerCenter: { x: videoFile.width / 2, y: videoFile.height / 2 },
        useFullFrame: false,
        cropScale: 1.0,
      };
      setGeneratedClips([defaultClip]);
    }
  }, [videoFile, cropRegion, generatedClips.length]);

  const getProjectId = useCallback((ratio: string, strategy: string) => {
    if (!videoFile) return null;
    return `${videoFile.file.name}-${ratio}-${strategy}`;
  }, [videoFile]);

  // Sync generatedClips to store for export
  useEffect(() => {
    if (generatedClips.length > 0) {
      setCurrentClips(generatedClips);
    }
  }, [generatedClips, setCurrentClips]);

  const runBlackBarDetection = useCallback(async () => {
    if (!videoFile) return null;
    try {
      const detected = await detectBlackBars(videoFile.url, videoFile.duration);
      setBlackBars(detected);
      if (detected.hasBlackBars) {
        setSafeArea(detected.safeArea);
      } else {
        setSafeArea({ x: 0, y: 0, width: videoFile.width, height: videoFile.height });
      }
      return detected;
    } catch (error) {
      setSafeArea({ x: 0, y: 0, width: videoFile.width, height: videoFile.height });
      return null;
    }
  }, [videoFile, setBlackBars, setSafeArea]);

  const runHardCutAnalysis = useCallback(async (
    ratio: string,
    abortSignal: AbortSignal
  ): Promise<EditProject | null> => {
    if (!videoFile || !videoRef.current) return null;

    const video = videoRef.current;

    // Use safeArea if available, otherwise detect black bars
    let currentSafeArea = safeArea;
    if (!currentSafeArea) {
      const blackBarResult = await runBlackBarDetection();
      currentSafeArea = blackBarResult?.safeArea || {
        x: 0, y: 0, width: videoFile.width, height: videoFile.height,
      };
    }

    // Calculate cropRegion based on safeArea (not original video size)
    const effectiveCropRegion = calculateCropRegion(
      currentSafeArea.width,
      currentSafeArea.height,
      ratio
    );

    if (video.readyState < 3) {
      await new Promise<void>((resolve) => {
        const done = () => { video.removeEventListener("canplay", done); resolve(); };
        video.addEventListener("canplay", done);
      });
    }

    const samplingInterval = 0.5;
    const frameAnalyses: FrameAnalysis[] = [];
    const totalSamples = Math.ceil(videoFile.duration / samplingInterval);

    for (let i = 0; i <= totalSamples; i++) {
      if (abortSignal.aborted) return null;

      const time = Math.min(i * samplingInterval, videoFile.duration);
      video.currentTime = time;

      await new Promise<void>((resolve) => {
        const onSeeked = () => { video.removeEventListener("seeked", onSeeked); resolve(); };
        video.addEventListener("seeked", onSeeked, { once: true });
      });

      await new Promise((r) => setTimeout(r, 100));

      try {
        const faces = await detectFacesWithSpeakingDetection(video, Math.round(time * 1000));
        const adjustedFaces: FaceDetection[] = faces.map(f => ({
          boundingBox: {
            x: f.boundingBox.x - currentSafeArea!.x,
            y: f.boundingBox.y - currentSafeArea!.y,
            width: f.boundingBox.width,
            height: f.boundingBox.height,
          },
          confidence: f.confidence,
        }));

        const speakingPerson = getSpeakingPerson(faces);
        const speakingIndex = speakingPerson ? faces.findIndex(f => f === speakingPerson) : null;

        const { strategy, cropPosition: frameCropPos } = analyzeFrameStrategy(
          adjustedFaces, speakingIndex,
          currentSafeArea!.width, currentSafeArea!.height,
          effectiveCropRegion.width, effectiveCropRegion.height
        );

        frameAnalyses.push({
          timestamp: time,
          faces: adjustedFaces,
          speakingFaceIndex: speakingIndex,
          strategy,
          cropPosition: {
            x: frameCropPos.x + currentSafeArea!.x,
            y: frameCropPos.y + currentSafeArea!.y,
          },
        });
      } catch (error) {
        console.error(`Detection failed at ${time}s:`, error);
      }

      setAnalysisProgress((i + 1) / (totalSamples + 1));
    }

    if (abortSignal.aborted) return null;

    let clips = generateHardCutClipsFromAnalysis(
      frameAnalyses, currentSafeArea.width, currentSafeArea.height,
      effectiveCropRegion.width, effectiveCropRegion.height, videoFile.duration
    );
    clips = mergeSimilarClips(clips, 50);

    const project: EditProject = {
      clips, blackBars: blackBars, trajectory: [], targetAspectRatio: ratio,
    };

    video.currentTime = 0;
    return project;
  }, [videoFile, safeArea, blackBars, runBlackBarDetection, setAnalysisProgress]);

  // Generate center crop position (after black bar removal)
  const getCenterCropPosition = useCallback((
    safeAreaWidth: number,
    safeAreaHeight: number,
    cropWidth: number,
    cropHeight: number,
    safeAreaX: number,
    safeAreaY: number
  ) => {
    const centerX = safeAreaX + (safeAreaWidth - cropWidth) / 2;
    const centerY = safeAreaY + (safeAreaHeight - cropHeight) / 2;
    return {
      x: Math.max(0, centerX),
      y: Math.max(0, centerY),
    };
  }, []);

  const triggerAnalysis = useCallback(async (ratio: string, strategy: string = cropStrategy, cropRegionOverride?: { width: number; height: number; x: number; y: number }) => {
    if (!videoFile) return;

    const projectKey = `${ratio}-${strategy}`;

    // ALWAYS cancel any ongoing analysis first when switching
    if (isAnalyzing && currentAnalyzingRatio !== projectKey) {
      cancelCurrentAnalysis();
    }

    // Already analyzing this ratio/strategy
    if (isAnalyzing && currentAnalyzingRatio === projectKey) return;

    // Check for saved analysis results - load immediately
    if (hasAnalyzedRatio(projectKey)) {
      const projectId = getProjectId(ratio, strategy);
      if (projectId) {
        const savedProject = loadEditProject(projectId);
        if (savedProject && savedProject.clips && savedProject.clips.length > 0) {
          setCurrentEditProject(savedProject);
          setGeneratedClips(savedProject.clips);
          if (savedProject.blackBars) {
            setBlackBars(savedProject.blackBars);
            if (savedProject.blackBars.hasBlackBars) {
              setSafeArea(savedProject.blackBars.safeArea);
            }
          }
          if (savedProject.clips.length > 0) {
            setCropPosition(savedProject.clips[0].cropPosition);
          }
          return;
        }
      }
    }

    // Center Crop mode: black bar detection + center crop, always 1 clip
    if (strategy === "center-crop") {
      const abortController = new AbortController();
      setAnalysisAbortController(abortController);
      setIsAnalyzing(true);
      setCurrentAnalyzingRatio(projectKey);
      setAnalysisProgress(0);
      setGeneratedClips([]);

      try {
        const blackBarResult = await runBlackBarDetection();

        // Check if aborted - just return silently
        if (abortController.signal.aborted) {
          return;
        }

        const currentSafeArea = blackBarResult?.safeArea || {
          x: 0, y: 0, width: videoFile.width, height: videoFile.height
        };

        // Recalculate cropRegion based on safeArea (excluding black bars)
        const newCropRegion = calculateCropRegion(
          currentSafeArea.width,
          currentSafeArea.height,
          ratio
        );

        // Adjust crop position to be relative to original video (add safeArea offset)
        const adjustedCropPos = {
          x: currentSafeArea.x + newCropRegion.x,
          y: currentSafeArea.y + newCropRegion.y,
        };

        // Update cropRegion with adjusted values
        const finalCropRegion = {
          ...newCropRegion,
          x: adjustedCropPos.x,
          y: adjustedCropPos.y,
        };
        setCropRegion(finalCropRegion);

        const clips: VideoClip[] = [{
          id: `clip_${Date.now()}`,
          startTime: 0,
          endTime: videoFile.duration,
          cropPosition: adjustedCropPos,
          speakerCenter: { x: videoFile.width / 2, y: videoFile.height / 2 },
          useFullFrame: false,
          cropScale: 1.0,
        }];

        const project: EditProject = {
          clips, blackBars: blackBarResult, trajectory: [], targetAspectRatio: ratio,
        };

        const projectId = getProjectId(ratio, strategy);
        if (projectId) saveEditProject(project, projectId);
        setEditProject(projectKey, project);
        addAnalyzedRatio(projectKey);
        setCurrentEditProject(project);
        setGeneratedClips(clips);
        setCropPosition(adjustedCropPos);
      } finally {
        setIsAnalyzing(false);
        setCurrentAnalyzingRatio(null);
        setAnalysisAbortController(null);
        setAnalysisProgress(1);
      }
      return;
    }

    // Smart Crop mode
    // 16:9 - only black bar detection, no subject analysis (regardless of source)
    if (ratio === "16:9") {
      const abortController = new AbortController();
      setAnalysisAbortController(abortController);
      setIsAnalyzing(true);
      setCurrentAnalyzingRatio(projectKey);
      setAnalysisProgress(0);
      setGeneratedClips([]);

      try {
        const blackBarResult = await runBlackBarDetection();

        // Check if aborted - just return silently
        if (abortController.signal.aborted) {
          return;
        }

        const currentSafeArea = blackBarResult?.safeArea || {
          x: 0, y: 0, width: videoFile.width, height: videoFile.height
        };

        // Recalculate cropRegion based on safeArea (excluding black bars)
        const newCropRegion = calculateCropRegion(
          currentSafeArea.width,
          currentSafeArea.height,
          ratio
        );

        // Adjust crop position to be relative to original video (add safeArea offset)
        const adjustedCropPos = {
          x: currentSafeArea.x + newCropRegion.x,
          y: currentSafeArea.y + newCropRegion.y,
        };

        // Update cropRegion with adjusted values
        const finalCropRegion = {
          ...newCropRegion,
          x: adjustedCropPos.x,
          y: adjustedCropPos.y,
        };
        setCropRegion(finalCropRegion);

        const clips: VideoClip[] = [{
          id: `clip_${Date.now()}`,
          startTime: 0,
          endTime: videoFile.duration,
          cropPosition: adjustedCropPos,
          speakerCenter: { x: videoFile.width / 2, y: videoFile.height / 2 },
          useFullFrame: false,
          cropScale: 1.0,
        }];

        const project: EditProject = {
          clips, blackBars: blackBarResult, trajectory: [], targetAspectRatio: ratio,
        };

        const projectId = getProjectId(ratio, strategy);
        if (projectId) saveEditProject(project, projectId);
        setEditProject(projectKey, project);
        addAnalyzedRatio(projectKey);
        setCurrentEditProject(project);
        setGeneratedClips(clips);
        setCropPosition(adjustedCropPos);
      } finally {
        setIsAnalyzing(false);
        setCurrentAnalyzingRatio(null);
        setAnalysisAbortController(null);
        setAnalysisProgress(1);
      }
      return;
    }

    // Other ratios in Smart Crop mode - full subject analysis
    const abortController = new AbortController();
    setAnalysisAbortController(abortController);
    setIsAnalyzing(true);
    setCurrentAnalyzingRatio(projectKey);
    setAnalysisProgress(0);
    setGeneratedClips([]);

    try {
      // First detect black bars
      const blackBarResult = await runBlackBarDetection();

      // Check if aborted - just return silently
      if (abortController.signal.aborted) {
        return;
      }

      const currentSafeArea = blackBarResult?.safeArea || {
        x: 0, y: 0, width: videoFile.width, height: videoFile.height
      };

      // Recalculate cropRegion based on safeArea (excluding black bars)
      const newCropRegion = calculateCropRegion(
        currentSafeArea.width,
        currentSafeArea.height,
        ratio
      );

      // Update cropRegion with adjusted values
      const finalCropRegion = {
        ...newCropRegion,
        x: currentSafeArea.x + newCropRegion.x,
        y: currentSafeArea.y + newCropRegion.y,
      };
      setCropRegion(finalCropRegion);

      // Now run the analysis with updated cropRegion
      const project = await runHardCutAnalysis(ratio, abortController.signal);

      // Check if aborted or no project - just return silently
      if (!project || abortController.signal.aborted) {
        return;
      }

      const projectId = getProjectId(ratio, strategy);
      if (projectId) saveEditProject(project, projectId);
      setEditProject(projectKey, project);
      addAnalyzedRatio(projectKey);
      setCurrentEditProject(project);
      setGeneratedClips(project.clips);

      if (project.clips.length > 0) {
        setCropPosition(project.clips[0].cropPosition);
      }
    } finally {
      setIsAnalyzing(false);
      setCurrentAnalyzingRatio(null);
      setAnalysisAbortController(null);
    }
  }, [
    videoFile, cropRegion, cropStrategy, isAnalyzing, currentAnalyzingRatio,
    hasAnalyzedRatio, getProjectId, cancelCurrentAnalysis, getCenterCropPosition,
    runBlackBarDetection, runHardCutAnalysis, setBlackBars, setSafeArea,
    setIsAnalyzing, setCurrentAnalyzingRatio, setAnalysisProgress,
    setAnalysisAbortController, setEditProject, addAnalyzedRatio, setCurrentEditProject,
    setCropRegion,
  ]);

  // Track if we've triggered analysis for the current ratio/strategy combo
  const triggeredAnalysisRef = useRef<string | null>(null);

  useEffect(() => {
    if (videoFile && targetPlatform) {
      // Use safeArea dimensions if available (after black bar detection), otherwise use original video size
      const effectiveWidth = safeArea ? safeArea.width : videoFile.width;
      const effectiveHeight = safeArea ? safeArea.height : videoFile.height;
      const offsetX = safeArea ? safeArea.x : 0;
      const offsetY = safeArea ? safeArea.y : 0;

      const region = calculateCropRegion(effectiveWidth, effectiveHeight, targetPlatform.aspectRatio);
      // Adjust region position to account for safeArea offset
      const adjustedRegion = {
        ...region,
        x: region.x + offsetX,
        y: region.y + offsetY,
      };

      // Only update cropRegion if dimensions changed (ignore position changes to preserve user edits)
      if (!cropRegion || cropRegion.width !== adjustedRegion.width || cropRegion.height !== adjustedRegion.height) {
        setCropRegion(adjustedRegion);
        setCropPosition({ x: adjustedRegion.x, y: adjustedRegion.y });
      }

      const newRatio = targetPlatform.aspectRatio;
      const ratioChanged = previousRatioRef.current !== newRatio;
      const strategyChanged = previousStrategyRef.current !== cropStrategy;
      const projectKey = `${newRatio}-${cropStrategy}`;

      // Trigger analysis if ratio/strategy changed AND we haven't already triggered for this combo
      if ((ratioChanged || strategyChanged) && triggeredAnalysisRef.current !== projectKey) {
        previousRatioRef.current = newRatio;
        previousStrategyRef.current = cropStrategy;
        triggeredAnalysisRef.current = projectKey;
        // Trigger immediately without delay for faster response
        triggerAnalysis(newRatio, cropStrategy);
      }
    }
  }, [videoFile, targetPlatform, cropStrategy, setCropRegion, cropRegion, safeArea]);

  const prevCropPositionRef = useRef(cropPosition);
  useEffect(() => {
    if (cropRegion && (prevCropPositionRef.current.x !== cropPosition.x || prevCropPositionRef.current.y !== cropPosition.y)) {
      prevCropPositionRef.current = cropPosition;
      setCropRegion({ ...cropRegion, x: cropPosition.x, y: cropPosition.y });
    }
  }, [cropPosition.x, cropPosition.y, cropRegion, setCropRegion]);

  const drawFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !videoFile) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let currentCropPos = cropPosition;
    let currentScale = 1.0;
    let isLetterbox = false;

    if (generatedClips.length > 0) {
      const currentClip = generatedClips.find(clip => currentTime >= clip.startTime && currentTime < clip.endTime);
      if (currentClip) {
        // When editing selected clip, use the live cropPosition for immediate feedback
        if (selectedClipId && currentClip.id === selectedClipId) {
          currentCropPos = cropPosition;
          currentScale = currentClip.cropScale || 1.0;
        } else {
          currentCropPos = currentClip.cropPosition;
          currentScale = currentClip.cropScale || 1.0;
        }
        isLetterbox = currentClip.useFullFrame || false;
      }
    }

    if (cropRegion) {
      canvas.width = Math.round(cropRegion.width);
      canvas.height = Math.round(cropRegion.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isLetterbox) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const videoAspect = videoFile.width / videoFile.height;
        const cropAspect = cropRegion.width / cropRegion.height;
        let drawWidth, drawHeight, drawX, drawY;
        if (videoAspect > cropAspect) {
          drawWidth = canvas.width;
          drawHeight = canvas.width / videoAspect;
          drawX = 0;
          drawY = (canvas.height - drawHeight) / 2;
        } else {
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoAspect;
          drawX = (canvas.width - drawWidth) / 2;
          drawY = 0;
        }
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
      } else {
        // Ensure crop position stays within valid bounds to prevent blank areas
        // Use safeArea boundaries if available to prevent exposing black bars
        const minX = safeArea ? safeArea.x : 0;
        const minY = safeArea ? safeArea.y : 0;
        const maxX = safeArea
          ? Math.max(minX, safeArea.x + safeArea.width - cropRegion.width)
          : Math.max(0, videoFile.width - cropRegion.width);
        const maxY = safeArea
          ? Math.max(minY, safeArea.y + safeArea.height - cropRegion.height)
          : Math.max(0, videoFile.height - cropRegion.height);
        const safeX = Math.max(minX, Math.min(currentCropPos.x, maxX));
        const safeY = Math.max(minY, Math.min(currentCropPos.y, maxY));

        // Apply scale for zoom effect
        if (currentScale !== 1.0) {
          const scaledWidth = cropRegion.width / currentScale;
          const scaledHeight = cropRegion.height / currentScale;
          const offsetX = (cropRegion.width - scaledWidth) / 2;
          const offsetY = (cropRegion.height - scaledHeight) / 2;
          ctx.drawImage(
            video,
            safeX + offsetX, safeY + offsetY,
            scaledWidth, scaledHeight,
            0, 0,
            cropRegion.width, cropRegion.height
          );
        } else {
          // Use drawImage with source and destination to ensure canvas is always filled
          ctx.drawImage(
            video,
            safeX, safeY,                    // Source position
            cropRegion.width, cropRegion.height,  // Source size
            0, 0,                            // Destination position
            cropRegion.width, cropRegion.height   // Destination size
          );
        }
      }
      ctx.strokeStyle = "rgba(194, 241, 89, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    } else {
      canvas.width = videoFile.width;
      canvas.height = videoFile.height;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  }, [videoFile, cropRegion, cropPosition, currentTime, generatedClips, selectedClipId, safeArea]);

  const drawFrameRef = useRef(drawFrame);
  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    if (!isPlaying) return;
    const animate = () => { drawFrame(); animationRef.current = requestAnimationFrame(animate); };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, drawFrame]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleEnded = () => setIsPlaying(false);
    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, []);

  // After video import: show first frame in preview only on initial load
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !videoFile) return;

    // Reset flag when video file changes
    hasInitializedRef.current = false;
    const video = videoRef.current;

    const showFirstFrame = () => {
      if (video.readyState < 2) return;
      if (hasInitializedRef.current) return; // Only run once per video
      hasInitializedRef.current = true;

      video.currentTime = 0;
      setCurrentTime(0);
      drawFrameRef.current();
    };

    const onCanPlay = () => {
      showFirstFrame();
    };

    video.addEventListener("canplay", onCanPlay);
    if (video.readyState >= 2) {
      showFirstFrame();
    }

    return () => video.removeEventListener("canplay", onCanPlay);
  }, [videoFile, setCurrentTime]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !videoFile) return;
    const video = videoRef.current;
    const handleSeek = () => {
      if (Math.abs(video.currentTime - currentTime) > 0.1) video.currentTime = currentTime;
      drawFrame();
    };
    video.addEventListener("seeked", handleSeek);
    if (video.readyState >= 2) drawFrame();
    return () => video.removeEventListener("seeked", handleSeek);
  }, [videoFile, currentTime, drawFrame]);

  // Handle clip select from timeline - single click enables editing
  const handleClipSelect = useCallback((clipId: string | null) => {
    setSelectedClipId(clipId);
    if (clipId) {
      const clip = generatedClips.find(c => c.id === clipId);
      if (clip) {
        setCropPosition(clip.cropPosition);
      }
    }
  }, [generatedClips]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cropRegion || !videoFile) return;

    // Only allow dragging when a clip is selected from the timeline
    if (!selectedClipId) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({ x: (e.clientX - rect.left) * cropRegion.width / rect.width, y: (e.clientY - rect.top) * cropRegion.height / rect.height });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !cropRegion || !videoFile || !selectedClipId) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) * cropRegion.width / rect.width;
    const currentY = (e.clientY - rect.top) * cropRegion.height / rect.height;

    // Use safeArea boundaries if available to prevent exposing black bars
    const minX = safeArea ? safeArea.x : 0;
    const minY = safeArea ? safeArea.y : 0;
    const maxX = safeArea
      ? Math.max(minX, safeArea.x + safeArea.width - cropRegion.width)
      : videoFile.width - cropRegion.width;
    const maxY = safeArea
      ? Math.max(minY, safeArea.y + safeArea.height - cropRegion.height)
      : videoFile.height - cropRegion.height;

    const newX = Math.max(minX, Math.min(cropPosition.x + currentX - dragStart.x, maxX));
    const newY = Math.max(minY, Math.min(cropPosition.y + currentY - dragStart.y, maxY));

    // Update selected clip's cropPosition
    setGeneratedClips(prev => prev.map(clip =>
      clip.id === selectedClipId ? { ...clip, cropPosition: { x: newX, y: newY } } : clip
    ));
    setCropPosition({ x: newX, y: newY });
    setDragStart({ x: currentX, y: currentY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch gesture handlers for pan and zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!cropRegion || !videoFile) return;

    // Only allow touch editing when a clip is selected from the timeline
    if (!selectedClipId) return;

    const currentClip = generatedClips.find(c => c.id === selectedClipId);
    if (!currentClip) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 2) {
      // Pinch gesture started - store initial state for zoom
      e.preventDefault(); // Prevent default zoom behavior
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      touchStateRef.current = {
        isPinching: true,
        initialDistance: distance,
        initialCenter: center,
        initialCropPos: { ...currentClip.cropPosition },
        initialCropScale: currentClip.cropScale || 1.0,
      };
    } else if (e.touches.length === 1) {
      // Single touch - start pan gesture
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({
        x: (touch.clientX - rect.left) * cropRegion.width / rect.width,
        y: (touch.clientY - rect.top) * cropRegion.height / rect.height,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!cropRegion || !videoFile || !selectedClipId) return;
    e.preventDefault(); // Prevent scrolling while interacting

    const currentClip = generatedClips.find(c => c.id === selectedClipId);
    if (!currentClip) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 2 && touchStateRef.current.isPinching) {
      // Pinch to zoom - calculate new scale
      const currentDistance = getTouchDistance(e.touches);
      const scaleRatio = currentDistance / touchStateRef.current.initialDistance;
      const newScale = Math.max(1.0, Math.min(5.0, touchStateRef.current.initialCropScale * scaleRatio));

      // Apply the new scale to the selected clip
      setGeneratedClips(prev => prev.map(clip =>
        clip.id === selectedClipId ? { ...clip, cropScale: newScale } : clip
      ));
    } else if (e.touches.length === 1 && isDragging) {
      // Pan with single finger
      const touch = e.touches[0];
      const currentX = (touch.clientX - rect.left) * cropRegion.width / rect.width;
      const currentY = (touch.clientY - rect.top) * cropRegion.height / rect.height;

      // Use safeArea boundaries if available to prevent exposing black bars
      const baseMinX = safeArea ? safeArea.x : 0;
      const baseMinY = safeArea ? safeArea.y : 0;
      const baseMaxX = safeArea
        ? Math.max(baseMinX, safeArea.x + safeArea.width - cropRegion.width)
        : videoFile.width - cropRegion.width;
      const baseMaxY = safeArea
        ? Math.max(baseMinY, safeArea.y + safeArea.height - cropRegion.height)
        : videoFile.height - cropRegion.height;

      const clipScale = currentClip.cropScale || 1.0;
      // When zoomed in, allow panning beyond the normal boundaries (but still within safe area)
      const maxOffsetX = (cropRegion.width * (clipScale - 1)) / 2;
      const maxOffsetY = (cropRegion.height * (clipScale - 1)) / 2;

      const newX = Math.max(baseMinX - maxOffsetX, Math.min(
        currentClip.cropPosition.x + (currentX - dragStart.x),
        baseMaxX + maxOffsetX
      ));
      const newY = Math.max(baseMinY - maxOffsetY, Math.min(
        currentClip.cropPosition.y + (currentY - dragStart.y),
        baseMaxY + maxOffsetY
      ));

      setGeneratedClips(prev => prev.map(clip =>
        clip.id === selectedClipId ? { ...clip, cropPosition: { x: newX, y: newY } } : clip
      ));
      setCropPosition({ x: newX, y: newY });
      setDragStart({ x: currentX, y: currentY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsDragging(false);
      touchStateRef.current.isPinching = false;
    }
  };

  // Exit edit mode (deselect clip) when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedClipId) {
        setSelectedClipId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId]);

  // Handle wheel for pan when editing (both X and Y directions)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!cropRegion || !videoFile || !selectedClipId) return;

    const currentClip = generatedClips.find(c => c.id === selectedClipId);
    if (!currentClip) return;

    e.preventDefault();

    // Use safeArea boundaries if available to prevent exposing black bars
    const minX = safeArea ? safeArea.x : 0;
    const minY = safeArea ? safeArea.y : 0;
    const maxX = safeArea
      ? Math.max(minX, safeArea.x + safeArea.width - cropRegion.width)
      : videoFile.width - cropRegion.width;
    const maxY = safeArea
      ? Math.max(minY, safeArea.y + safeArea.height - cropRegion.height)
      : videoFile.height - cropRegion.height;

    // Support both vertical (deltaY) and horizontal (deltaX) scrolling
    const panStep = 20;
    const newX = Math.max(minX, Math.min(
      currentClip.cropPosition.x + (e.deltaX > 0 ? panStep : e.deltaX < 0 ? -panStep : 0),
      maxX
    ));
    const newY = Math.max(minY, Math.min(
      currentClip.cropPosition.y + (e.deltaY > 0 ? panStep : e.deltaY < 0 ? -panStep : 0),
      maxY
    ));

    setGeneratedClips(prev => prev.map(clip =>
      clip.id === selectedClipId
        ? { ...clip, cropPosition: { x: newX, y: newY } }
        : clip
    ));
    setCropPosition({ x: newX, y: newY });
  }, [selectedClipId, cropRegion, videoFile, generatedClips, safeArea]);

  if (!videoFile) return null;

  return (
    <div className="space-y-4">
      {/* Video Preview */}
      <div
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden w-full flex items-center justify-center border border-neutral-200 dark:border-neutral-800 ${
          targetPlatform?.aspectRatio === "16:9" ? "bg-black" : "bg-neutral-100 dark:bg-neutral-800"
        }`}
        style={{ aspectRatio: "16 / 9" }}
      >
        <video
          key={videoFile.url}
          ref={videoRef}
          src={videoFile.url}
          className="absolute opacity-0 pointer-events-none"
          style={{ width: '1px', height: '1px' }}
          playsInline
          crossOrigin="anonymous"
          preload="auto"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        />
        <canvas
          ref={canvasRef}
          className={`h-full w-auto max-w-none ${selectedClipId ? 'cursor-move touch-none' : 'cursor-pointer'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Play Controls */}
        <div className="absolute bottom-4 left-4 flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.14v14.72a1 1 0 001.5.87l11-7.36a1 1 0 000-1.74l-11-7.36a1 1 0 00-1.5.87z" />
              </svg>
            )}
          </button>
          <div className="px-3 py-1 bg-black/70 text-white text-sm rounded-full">
            {formatTime(currentTime)} / {formatTime(videoFile.duration)}
          </div>
        </div>

        {/* Platform Badge */}
        {targetPlatform && (
          <div className="absolute top-4 right-4 px-3 py-1 bg-black/70 text-white text-sm rounded-full">
            {targetPlatform.aspectRatio}
          </div>
        )}

        {/* Analysis Status */}
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 text-white text-sm rounded-full flex items-center gap-2">
          {isAnalyzing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Analyzing {Math.round(analysisProgress * 100)}%</span>
            </>
          ) : generatedClips.length > 0 ? (
            <>
              <span className="text-green-400">✓</span>
              <span>{generatedClips.length} clips</span>
            </>
          ) : blackBars?.hasBlackBars ? (
            <>
              <span className="text-blue-400">✓</span>
              <span>Black bars removed</span>
            </>
          ) : (
            <>
              <span className="text-yellow-400">●</span>
              <span>Select size to start analysis</span>
            </>
          )}
        </div>

      </div>


      {/* Timeline - Always show */}
      <TimelineEditor
        clips={generatedClips}
        duration={videoFile.duration}
        selectedClipId={selectedClipId}
        currentTime={currentTime}
        onClipSelect={handleClipSelect}
        onClipResize={(id, newStart, newEnd) =>
          setGeneratedClips(prev => prev.map(clip =>
            clip.id === id ? { ...clip, startTime: newStart, endTime: newEnd } : clip
          ))
        }
        onClipDelete={(id) => {
          setGeneratedClips(prev => prev.filter(c => c.id !== id));
          if (selectedClipId === id) {
            setSelectedClipId(null);
          }
        }}
        onClipsChange={setGeneratedClips}
        onSeek={(time) => {
          setCurrentTime(time);
          if (videoRef.current) videoRef.current.currentTime = time;
        }}
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
