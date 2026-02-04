"use client";

import { useMemo, useCallback } from "react";
import { useVideoStore } from "@/lib/store";
import { PLATFORM_CONFIGS, ASPECT_RATIOS } from "@/lib/platforms";

export function PlatformSelector() {
  const { selectedPlatforms, setSelectedPlatforms } = useVideoStore();

  const ratioOrder = ["9:16", "1:1", "4:5", "16:9"];

  const logoMap: Record<string, { src: string; alt: string }> = {
    youtube: { src: "/platform-logos/custom/youtube.jpg", alt: "YouTube" },
    tiktok: { src: "/platform-logos/custom/tiktok.png", alt: "TikTok" },
    instagram: { src: "/platform-logos/custom/instagram.png", alt: "Instagram" },
    reddit: { src: "/platform-logos/custom/reddit.png", alt: "Reddit" },
    linkedin: { src: "/platform-logos/custom/linkedin.png", alt: "LinkedIn" },
    facebook: { src: "/platform-logos/custom/facebook.png", alt: "Facebook" },
  };

  const ratioGroups = useMemo(() => {
    return ratioOrder
      .filter((ratio) => ASPECT_RATIOS[ratio])
      .map((ratio) => {
        const platforms = PLATFORM_CONFIGS.filter((p) => p.aspectRatios.includes(ratio));
        const platformIds = platforms.map((p) => `${p.id}-${ratio.replace(":", "x")}`);
        const allSelected = platformIds.every((id) => selectedPlatforms.includes(id));
        const anySelected = platformIds.some((id) => selectedPlatforms.includes(id));

        return {
          ratio,
          platforms,
          platformIds,
          allSelected,
          anySelected,
        };
      });
  }, [selectedPlatforms]);

  const toggleRatioSelection = useCallback((platformIds: string[], allSelected: boolean) => {
    // If already selected, deselect (clear all)
    // If not selected, select only this ratio (clear others and select this)
    setSelectedPlatforms(allSelected ? [] : platformIds);
  }, [setSelectedPlatforms]);

  return (
    <div className="space-y-3 max-h-[calc(100vh-420px)] overflow-y-auto pr-2">
      {ratioGroups.map(({ ratio, platforms, platformIds, allSelected, anySelected }) => {
        const { width, height } = ASPECT_RATIOS[ratio];
        const ratioSelected = allSelected;
        const ratioActive = anySelected && !allSelected;

        return (
          <button
            key={ratio}
            onClick={() => toggleRatioSelection(platformIds, allSelected)}
            className={`w-full rounded-2xl border p-4 text-left transition-all ${
              ratioSelected
                ? "border-[#C2F159] bg-[#C2F159]/20 dark:bg-[#C2F159]/10"
                : ratioActive
                  ? "border-[#C2F159]/60 bg-[#C2F159]/10 dark:bg-[#C2F159]/10"
                  : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
          >
            <div className="grid grid-cols-[1fr_auto] items-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center justify-center rounded-lg border-2 ${
                    ratioSelected
                      ? "border-[#C2F159]"
                      : "border-neutral-300 dark:border-neutral-600"
                  }`}
                  style={{
                    width: ratio === "9:16" ? 22 : ratio === "1:1" ? 26 : 32,
                    height: ratio === "9:16" ? 34 : ratio === "1:1" ? 26 : 20,
                  }}
                />
                <div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {ratio}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {width}×{height}
                  </div>
                </div>
              </div>
              <div
                className={`text-xs font-medium ${
                  ratioSelected
                    ? "text-neutral-900 dark:text-[#C2F159]"
                    : ratioActive
                      ? "text-[#7ea41a] dark:text-[#C2F159]"
                      : "text-neutral-400 dark:text-neutral-500"
                }`}
              >
                {ratioSelected ? "Selected" : ratioActive ? "Partially selected" : "Select"}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-6 gap-1">
              {platforms.map((platform) => (
                <span
                  key={platform.id}
                  className="inline-flex items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-800/70 h-7 w-7"
                  title={platform.name}
                >
                  {logoMap[platform.id] ? (
                    <img
                      src={logoMap[platform.id].src}
                      alt={logoMap[platform.id].alt}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xs">{platform.icon}</span>
                  )}
                </span>
              ))}
            </div>
          </button>
        );
      })}

      {selectedPlatforms.length > 0 && (
        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-[#7ea41a] dark:text-[#C2F159] text-center font-medium">
            {selectedPlatforms.length} platform
            {selectedPlatforms.length > 1 ? "s" : ""} selected
          </p>
        </div>
      )}
    </div>
  );
}
