"use client";

import { useState } from "react";
import { useVideoStore } from "@/lib/store";
import { getPlatformById } from "@/lib/platforms";
import {
  exportForMultiplePlatforms,
  downloadMultipleFiles,
} from "@/lib/videoExporter";

export function ExportButton() {
  const { videoFile, cropRegion, selectedPlatforms, cropStrategy, isProcessing, setIsProcessing } =
    useVideoStore();
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
    platformId: string;
    percent: number;
  } | null>(null);

  const handleExport = async () => {
    if (!videoFile || !cropRegion || selectedPlatforms.length === 0) {
      return;
    }

    try {
      setIsProcessing(true);

      // Prepare export data for each platform
      const exportData = selectedPlatforms.map((platformId) => {
        const platform = getPlatformById(platformId);
        if (!platform) {
          throw new Error(`Unknown platform: ${platformId}`);
        }
        return {
          crop: cropRegion,
          width: platform.width,
          height: platform.height,
          platformId,
        };
      });

      // Export videos
      const results = await exportForMultiplePlatforms(
        videoFile.file,
        exportData,
        cropStrategy,
        (current, total, platformId, percent) => {
          setExportProgress({ current, total, platformId, percent });
        }
      );

      // Prepare files for download
      const files = results.map(({ platformId, blob }) => {
        const platform = getPlatformById(platformId);
        const baseName = videoFile.file.name.replace(/\.[^/.]+$/, "");
        return {
          blob,
          filename: `${baseName}_${platform?.name.replace(/\s+/g, "_").toLowerCase()}.mp4`,
        };
      });

      // Download files
      await downloadMultipleFiles(files);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsProcessing(false);
      setExportProgress(null);
    }
  };

  const isDisabled = !videoFile || !cropRegion || selectedPlatforms.length === 0 || isProcessing;

  return (
    <div className="text-center">
      <button
        onClick={handleExport}
        disabled={isDisabled}
        className={`px-8 py-4 rounded-full font-semibold text-lg shadow-lg transition-all ${
          isDisabled
            ? "bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
            : "bg-[#C2F159] text-neutral-900 hover:opacity-90 hover:shadow-xl"
        }`}
      >
        {isProcessing ? (
          <span className="flex items-center gap-3">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {exportProgress
              ? `${getPlatformById(exportProgress.platformId)?.name} (${exportProgress.current}/${exportProgress.total}) - ${exportProgress.percent}%`
              : "Initializing..."}
          </span>
        ) : (
          `Export for ${selectedPlatforms.length} Platform${selectedPlatforms.length > 1 ? "s" : ""}`
        )}
      </button>
      <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-3">
        Processing happens locally in your browser
      </p>
    </div>
  );
}
