"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useVideoStore } from "@/lib/store";
import { calculateCropRegion, extractFrame } from "@/lib/videoProcessor";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineFrames, setTimelineFrames] = useState<string[]>([]);
  const [isGeneratingTimeline, setIsGeneratingTimeline] = useState(false);
  const [generatedClips, setGeneratedClips] = useState<VideoClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const previousRatioRef = useRef<string | null>(null);

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
  } = useVideoStore();

  const targetPlatform = selectedPlatforms[0]
    ? getPlatformById(selectedPlatforms[0])
    : null;

  const getProjectId = useCallback((ratio: string) => {
    if (!videoFile) return null;
    return `${videoFile.file.name}-${ratio}`;
  }, [videoFile]);

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
    if (!videoFile || !videoRef.current || !cropRegion) return null;

    const video = videoRef.current;
    let currentSafeArea = safeArea;
    if (!currentSafeArea) {
      const blackBarResult = await runBlackBarDetection();
      currentSafeArea = blackBarResult?.safeArea || {
        x: 0, y: 0, width: videoFile.width, height: videoFile.height,
      };
    }

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
          cropRegion.width, cropRegion.height
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
      frameAnalyses, videoFile.width, videoFile.height,
      cropRegion.width, cropRegion.height, videoFile.duration
    );
    clips = mergeSimilarClips(clips, 50);

    const project: EditProject = {
      clips, blackBars: blackBars, trajectory: [], targetAspectRatio: ratio,
    };

    video.currentTime = 0;
    return project;
  }, [videoFile, cropRegion, safeArea, blackBars, runBlackBarDetection, setAnalysisProgress]);

  const triggerAnalysis = useCallback(async (ratio: string) => {
    if (!videoFile || !cropRegion) return;

    if (hasAnalyzedRatio(ratio)) {
      const projectId = getProjectId(ratio);
      if (projectId) {
        const savedProject = loadEditProject(projectId);
        if (savedProject) {
          setCurrentEditProject(savedProject);
          setGeneratedClips(savedProject.clips);
          return;
        }
      }
    }

    if (isAnalyzing && currentAnalyzingRatio !== ratio) {
      cancelCurrentAnalysis();
    }

    if (isAnalyzing && currentAnalyzingRatio === ratio) return;

    if (ratio === "16:9") {
      setIsAnalyzing(true);
      setCurrentAnalyzingRatio(ratio);
      setAnalysisProgress(0);

      try {
        const blackBarResult = await runBlackBarDetection();
        const clips: VideoClip[] = [{
          id: `clip_${Date.now()}`,
          startTime: 0,
          endTime: videoFile.duration,
          cropPosition: { x: blackBarResult?.left || 0, y: blackBarResult?.top || 0 },
          speakerCenter: { x: videoFile.width / 2, y: videoFile.height / 2 },
          useFullFrame: false,
        }];

        const project: EditProject = {
          clips, blackBars: blackBarResult, trajectory: [], targetAspectRatio: ratio,
        };

        const projectId = getProjectId(ratio);
        if (projectId) saveEditProject(project, projectId);
        setEditProject(ratio, project);
        addAnalyzedRatio(ratio);
        setCurrentEditProject(project);
        setGeneratedClips(clips);
      } finally {
        setIsAnalyzing(false);
        setCurrentAnalyzingRatio(null);
        setAnalysisProgress(1);
      }
      return;
    }

    const abortController = new AbortController();
    setAnalysisAbortController(abortController);
    setIsAnalyzing(true);
    setCurrentAnalyzingRatio(ratio);
    setAnalysisProgress(0);
    setGeneratedClips([]);

    try {
      await runBlackBarDetection();
      const project = await runHardCutAnalysis(ratio, abortController.signal);

      if (!project || abortController.signal.aborted) return;

      const projectId = getProjectId(ratio);
      if (projectId) saveEditProject(project, projectId);
      setEditProject(ratio, project);
      addAnalyzedRatio(ratio);
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
    videoFile, cropRegion, isAnalyzing, currentAnalyzingRatio,
    hasAnalyzedRatio, getProjectId, cancelCurrentAnalysis,
    runBlackBarDetection, runHardCutAnalysis,
    setIsAnalyzing, setCurrentAnalyzingRatio, setAnalysisProgress,
    setAnalysisAbortController, setEditProject, addAnalyzedRatio, setCurrentEditProject,
  ]);

  useEffect(() => {
    if (videoFile && targetPlatform) {
      const region = calculateCropRegion(videoFile.width, videoFile.height, targetPlatform.aspectRatio);
      if (!cropRegion || cropRegion.width !== region.width || cropRegion.height !== region.height) {
        setCropRegion(region);
        setCropPosition({ x: region.x, y: region.y });
      }

      const newRatio = targetPlatform.aspectRatio;
      if (previousRatioRef.current !== newRatio) {
        previousRatioRef.current = newRatio;
        setTimeout(() => triggerAnalysis(newRatio), 100);
      }
    }
  }, [videoFile, targetPlatform, setCropRegion, cropRegion, triggerAnalysis]);

  const prevCropPositionRef = useRef(cropPosition);
  useEffect(() => {
    if (cropRegion && (prevCropPositionRef.current.x !== cropPosition.x || prevCropPositionRef.current.y !== cropPosition.y)) {
      prevCropPositionRef.current = cropPosition;
      setCropRegion({ ...cropRegion, x: cropPosition.x, y: cropPosition.y });
    }
  }, [cropPosition.x, cropPosition.y, cropRegion, setCropRegion]);

  useEffect(() => {
    if (!videoFile) { setTimelineFrames([]); return; }
    let isActive = true;
    setIsGeneratingTimeline(true);
    generateTimelineFrames(videoFile.url, videoFile.duration, 14)
      .then((frames) => { if (isActive) setTimelineFrames(frames); })
      .catch(() => { if (isActive) setTimelineFrames([]); })
      .finally(() => { if (isActive) setIsGeneratingTimeline(false); });
    return () => { isActive = false; };
  }, [videoFile?.url, videoFile?.duration]);

  const drawFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !videoFile) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let currentCropPos = cropPosition;
    let isLetterbox = false;

    if (generatedClips.length > 0) {
      const currentClip = generatedClips.find(clip => currentTime >= clip.startTime && currentTime < clip.endTime);
      if (currentClip) {
        currentCropPos = currentClip.cropPosition;
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
        ctx.drawImage(video, -currentCropPos.x, -currentCropPos.y, videoFile.width, videoFile.height);
      }
      ctx.strokeStyle = "rgba(194, 241, 89, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    } else {
      canvas.width = videoFile.width;
      canvas.height = videoFile.height;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  }, [videoFile, cropRegion, cropPosition, currentTime, generatedClips]);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cropRegion || generatedClips.length > 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({ x: (e.clientX - rect.left) * cropRegion.width / rect.width, y: (e.clientY - rect.top) * cropRegion.height / rect.height });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !cropRegion || !videoFile) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) * cropRegion.width / rect.width;
    const currentY = (e.clientY - rect.top) * cropRegion.height / rect.height;
    const newX = Math.max(0, Math.min(cropPosition.x + currentX - dragStart.x, videoFile.width - cropRegion.width));
    const newY = Math.max(0, Math.min(cropPosition.y + currentY - dragStart.y, videoFile.height - cropRegion.height));
    setCropPosition({ x: newX, y: newY });
    setDragStart({ x: currentX, y: currentY });
  };

  const handleMouseUp = () => setIsDragging(false);

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
          className={`h-full w-auto max-w-none ${generatedClips.length === 0 ? 'cursor-move' : 'cursor-default'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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
            {targetPlatform.icon} {targetPlatform.aspectRatio}
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

        {/* Current Clip Indicator */}
        {generatedClips.length > 0 && (
          <div className="absolute bottom-4 right-4 px-3 py-1 bg-blue-500/70 text-white text-sm rounded-full">
            {(() => {
              const currentClip = generatedClips.find(clip => currentTime >= clip.startTime && currentTime < clip.endTime);
              if (currentClip) {
                const index = generatedClips.findIndex(c => c.id === currentClip.id);
                return `Clip ${index + 1}/${generatedClips.length}${currentClip.useFullFrame ? ' (Full frame)' : ''}`;
              }
              return "";
            })()}
          </div>
        )}
      </div>


      {/* Timeline */}
      {generatedClips.length > 0 ? (
        <TimelineEditor
          clips={generatedClips}
          duration={videoFile.duration}
          selectedClipId={selectedClipId}
          currentTime={currentTime}
          onClipSelect={setSelectedClipId}
          onClipResize={(id, newStart, newEnd) =>
            setGeneratedClips(prev => prev.map(clip =>
              clip.id === id ? { ...clip, startTime: newStart, endTime: newEnd } : clip
            ))
          }
          onClipDelete={(id) => setGeneratedClips(prev => prev.filter(c => c.id !== id))}
          onSeek={(time) => {
            setCurrentTime(time);
            if (videoRef.current) videoRef.current.currentTime = time;
          }}
        />
      ) : (
        <div className="relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <span>{formatTime(0)}</span>
            <span>{formatTime(videoFile.duration)}</span>
          </div>
          <div className="relative">
            <div className="flex gap-1 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800">
              {timelineFrames.length > 0 ? (
                timelineFrames.map((frame, idx) => (
                  <div key={idx} className="flex-1 min-w-0">
                    <img src={frame} alt={`frame-${idx}`} className="h-16 w-full object-cover" />
                  </div>
                ))
              ) : (
                <div className="h-16 w-full flex items-center justify-center text-xs text-neutral-400">
                  {isAnalyzing ? "Analyzing video to generate clips..." : isGeneratingTimeline ? "Generating timeline..." : "Timeline will appear here"}
                </div>
              )}
            </div>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#C2F159]"
              style={{ left: `${(currentTime / videoFile.duration) * 100}%` }}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-[#C2F159] rotate-45 rounded-sm" />
            </div>
            <input
              type="range"
              min={0}
              max={videoFile.duration}
              step={0.01}
              value={currentTime}
              onChange={(e) => {
                const time = parseFloat(e.target.value);
                setCurrentTime(time);
                if (videoRef.current) videoRef.current.currentTime = time;
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

async function generateTimelineFrames(videoUrl: string, duration: number, frameCount: number): Promise<string[]> {
  const frames: string[] = [];
  const safeDuration = Math.max(duration, 0.1);
  for (let i = 0; i < frameCount; i++) {
    const time = (safeDuration / frameCount) * i;
    const frame = await extractFrame(videoUrl, time);
    frames.push(frame);
  }
  return frames;
}
