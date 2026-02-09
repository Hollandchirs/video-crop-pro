"use client";

import { useState, useRef } from "react";

// Platform icons as inline SVGs
const PlatformIcon = ({ platform, className }: { platform: string; className?: string }) => {
  const icons: Record<string, JSX.Element> = {
    tiktok: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ),
    instagram: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
      </svg>
    ),
    youtube: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    linkedin: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    twitter: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    reddit: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
    ),
  };
  return icons[platform] || null;
};

const aspectRatios = [
  {
    ratio: "16:9",
    resolution: "1920×1080",
    platforms: ["linkedin", "twitter", "youtube", "facebook", "reddit"],
    width: 16,
    height: 9,
  },
  {
    ratio: "1:1",
    resolution: "1080×1080",
    platforms: ["linkedin", "twitter", "youtube", "instagram", "facebook", "reddit"],
    width: 1,
    height: 1,
  },
  {
    ratio: "4:5",
    resolution: "1080×1350",
    platforms: ["youtube", "instagram", "facebook"],
    width: 4,
    height: 5,
  },
  {
    ratio: "9:16",
    resolution: "1080×1920",
    platforms: ["tiktok", "instagram", "linkedin"],
    width: 9,
    height: 16,
  },
];

const platformColors: Record<string, string> = {
  tiktok: "text-neutral-900 dark:text-neutral-100",
  instagram: "text-pink-500",
  youtube: "text-red-500",
  facebook: "text-blue-600",
  linkedin: "text-blue-500",
  twitter: "text-neutral-900 dark:text-neutral-100",
  reddit: "text-orange-500",
};

// Aspect ratio preview component
const AspectRatioPreview = ({ ratio }: { ratio: typeof aspectRatios[0] }) => {
  const aspectRatio = ratio.width / ratio.height;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Use consistent height for all previews
  const previewHeight = 280;
  const previewWidth = previewHeight * aspectRatio;

  // Map ratio to corresponding video file
  const getVideoSrc = () => {
    switch (ratio.ratio) {
      case "16:9":
        return "/demo-video.mp4"; // Original 16:9 video
      case "1:1":
        return "/demo-1-1.mp4";
      case "4:5":
        return "/demo-4-5.mp4";
      case "9:16":
        return "/demo-9-16.mp4";
      default:
        return "/demo-video.mp4";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      <div
        className="rounded-xl border-2 border-[#C2F159] overflow-hidden transition-all duration-300 relative bg-neutral-900"
        style={{
          width: `${previewWidth}px`,
          height: `${previewHeight}px`,
        }}
      >
        <video
          ref={videoRef}
          src={getVideoSrc()}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{
            objectPosition: 'center'
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        {ratio.platforms.map((platform) => (
          <div key={platform} className={`w-6 h-6 ${platformColors[platform]}`}>
            <PlatformIcon platform={platform} className="w-full h-full" />
          </div>
        ))}
      </div>
    </div>
  );
};

export function PlatformShowcase() {
  const [selectedRatio, setSelectedRatio] = useState<string>("16:9");
  const selectedRatioData = aspectRatios.find(r => r.ratio === selectedRatio)!;

  return (
    <section className="py-16 bg-neutral-100 dark:bg-neutral-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl mb-3">
            Every Size for Every Platform
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Select your target platforms and export all sizes at once
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            {/* Left: Aspect Ratio Preview */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex items-center justify-center min-h-[320px]">
              <AspectRatioPreview ratio={selectedRatioData} />
            </div>

            {/* Right: Ratio Selection List */}
            <div className="grid grid-cols-1 gap-2">
              {aspectRatios.map((item) => (
                <div
                  key={item.ratio}
                  onClick={() => setSelectedRatio(item.ratio)}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    selectedRatio === item.ratio
                      ? "border-[#C2F159] bg-[#C2F159]/5"
                      : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-[#C2F159]/30"
                  }`}
                >
                  {/* Radio button */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    selectedRatio === item.ratio ? "border-[#C2F159] bg-[#C2F159]/10" : "border-neutral-400 dark:border-neutral-600"
                  }`}>
                    {selectedRatio === item.ratio && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#C2F159]" />
                    )}
                  </div>

                  {/* Ratio info */}
                  <div className="flex-1 min-w-[120px]">
                    <div className="text-base font-bold text-neutral-900 dark:text-neutral-100">{item.ratio}</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">{item.resolution}</div>
                  </div>

                  {/* Select label */}
                  <div className="text-sm font-medium flex-shrink-0 w-[90px] text-right">
                    {selectedRatio === item.ratio ? (
                      <span className="text-[#C2F159]">Selected</span>
                    ) : (
                      <span className="text-neutral-500 dark:text-neutral-400">Select</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
