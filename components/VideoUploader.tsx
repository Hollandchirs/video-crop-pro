"use client";

import { useCallback, useState } from "react";
import { useVideoStore } from "@/lib/store";
import { loadVideoFile } from "@/lib/videoProcessor";

interface VideoUploaderProps {
  onVideoLoaded?: () => void;
}

export function VideoUploader({ onVideoLoaded }: VideoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setVideoFile, setIsProcessing } = useVideoStore();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        alert("Please select a video file");
        return;
      }

      if (file.size > 500 * 1024 * 1024) {
        alert("Video size must be less than 500MB");
        return;
      }

      try {
        setIsLoading(true);
        setIsProcessing(true);
        console.log("Loading video file:", file.name, file.size);
        const videoFile = await loadVideoFile(file);
        console.log("Video loaded:", videoFile);
        setVideoFile(videoFile);
        onVideoLoaded?.();
      } catch (error) {
        console.error("Failed to load video:", error);
        alert("Failed to load video. Please try another file.");
      } finally {
        setIsLoading(false);
        setIsProcessing(false);
      }
    },
    [setVideoFile, setIsProcessing, onVideoLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
        dragActive
          ? "border-[#C2F159] bg-[#C2F159]/20 dark:bg-[#C2F159]/10 scale-105"
          : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 hover:scale-[1.02]"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <div className="max-w-md mx-auto">
        {isLoading ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#C2F159] flex items-center justify-center text-neutral-900 shadow-lg">
              <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 mb-2 font-medium">
              Loading video...
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-500">
              Please wait while we process your video
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#C2F159] flex items-center justify-center text-neutral-900 text-2xl shadow-lg">
              📁
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 mb-2 font-medium">
              Drop your video here
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-500 mb-6">
              MP4, MOV, WebM • Up to 500MB
            </p>
            <label className="inline-block px-6 py-3 bg-[#C2F159] text-neutral-900 rounded-full font-medium cursor-pointer hover:opacity-90 transition-opacity shadow-md hover:shadow-lg">
              Choose Video
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                className="hidden"
                onChange={handleChange}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
