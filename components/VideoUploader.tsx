"use client";

import { useCallback, useState } from "react";
import { useVideoStore } from "@/lib/store";
import { loadVideoFile } from "@/lib/videoProcessor";

interface VideoUploaderProps {
  onVideoLoaded?: () => void;
}

// Custom platform icons with brand-accurate designs
const PlatformIcons = {
  TikTok: () => (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  ),
  Instagram: () => (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  ),
  YouTube: () => (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  Facebook: () => (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  LinkedIn: () => (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  Twitter: () => (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  Reddit: () => (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  ),
};

export function VideoUploader({ onVideoLoaded }: VideoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { setVideoFile, setIsProcessing } = useVideoStore();

  // Semicircle arrangement (only top half) with brand colors
  // 7 icons evenly distributed from 180° to 360° (30° intervals)
  const orbitIcons = [
    { Icon: PlatformIcons.TikTok, angle: 180, delay: 0, color: "#000000" },
    { Icon: PlatformIcons.Instagram, angle: 210, delay: 0.05, color: "#E4405F" },
    { Icon: PlatformIcons.YouTube, angle: 240, delay: 0.1, color: "#FF0000" },
    { Icon: PlatformIcons.Reddit, angle: 270, delay: 0.15, color: "#FF4500" },
    { Icon: PlatformIcons.Facebook, angle: 300, delay: 0.2, color: "#1877F2" },
    { Icon: PlatformIcons.LinkedIn, angle: 330, delay: 0.25, color: "#0A66C2" },
    { Icon: PlatformIcons.Twitter, angle: 360, delay: 0.3, color: "#000000" },
  ];

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        alert("Please select a video file");
        return;
      }

      if (file.size > 1024 * 1024 * 1024) {
        alert("Video size must be less than 1GB");
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
      className={`upload-zone group relative cursor-pointer rounded-2xl p-8 sm:p-12 text-center transition-all ${
        dragActive
          ? "border-[#C2F159] bg-[#C2F159]/20 dark:bg-[#C2F159]/10 scale-[1.02]"
          : "hover:bg-accent/30"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col items-center gap-4">
        {isLoading ? (
          <>
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#C2F159] shadow-lg">
              <svg className="animate-spin h-8 w-8 text-neutral-900" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="mb-1 text-lg font-medium text-neutral-900 dark:text-neutral-100">
                Loading video...
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Please wait while we process your video
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Icon with orbit - wrapped in container with padding for icons */}
            <div className="relative pt-10 pb-2">
              {/* Orbiting platform icons - semicircle above */}
              {orbitIcons.map(({ Icon, angle, delay, color }, index) => {
                const radius = 72;
                const rad = (angle * Math.PI) / 180;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;

                return (
                  <div
                    key={index}
                    className="absolute left-1/2 top-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-neutral-800 shadow-lg border border-neutral-200/50 dark:border-neutral-700/50 transition-all duration-300 ease-out"
                    style={{
                      transform: isHovered
                        ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                        : `translate(-50%, -50%) scale(0)`,
                      opacity: isHovered ? 1 : 0,
                      transitionDelay: isHovered ? `${delay}s` : '0s',
                      marginTop: '8px',
                    }}
                  >
                    <div className="h-5 w-5" style={{ color }}>
                      <Icon />
                    </div>
                  </div>
                );
              })}

              {/* Main icon */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#C2F159] transition-transform group-hover:scale-110 shadow-lg">
                <svg className="h-8 w-8 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="mb-1 text-lg font-medium text-neutral-900 dark:text-neutral-100">
                Drop your video here
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Supports MP4, MOV, WebM · Max 500MB
              </p>
            </div>
            <label className="mt-2 inline-flex items-center gap-2 cursor-pointer rounded-full bg-[#C2F159] px-6 py-3 text-sm font-semibold text-neutral-900 shadow-md transition-all hover:shadow-lg hover:opacity-90">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              Select Video
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
