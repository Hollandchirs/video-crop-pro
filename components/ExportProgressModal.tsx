"use client";

import { useEffect, useState } from "react";
import { getPlatformById } from "@/lib/platforms";

interface ExportProgressModalProps {
  isOpen: boolean;
  platforms: string[];
  progress: {
    current: number;
    total: number;
    platformId: string;
    percent: number;
  } | null;
  status: "processing" | "uploading" | "completed" | "error";
  downloadUrls?: Array<{ platformId: string; url: string; filename: string }>;
  error?: string;
  onClose: () => void;
}

export function ExportProgressModal({
  isOpen,
  platforms,
  progress,
  status,
  downloadUrls,
  error,
  onClose,
}: ExportProgressModalProps) {
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (status === "uploading") {
      // Simulate upload progress
      let current = 0;
      const interval = setInterval(() => {
        current += 10;
        if (current > 90) {
          clearInterval(interval);
        }
        setUploadProgress(current);
      }, 200);
      return () => clearInterval(interval);
    } else if (status === "completed") {
      setUploadProgress(100);
    }
  }, [status]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {status === "processing" && "Processing Video..."}
              {status === "uploading" && "Uploading to Cloud..."}
              {status === "completed" && "Export Complete!"}
              {status === "error" && "Export Failed"}
            </h2>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {status === "error" && (
            <div className="text-red-500 text-center py-4">
              <p>{error || "An error occurred during export."}</p>
            </div>
          )}

          {status === "processing" && progress && (
            <div className="space-y-4">
              {/* Platform being processed */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#C2F159] to-[#A7E635] flex items-center justify-center text-neutral-900 font-semibold text-sm">
                  {progress.current}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {getPlatformById(progress.platformId)?.name || `Platform ${progress.current}`}
                  </p>
                  <p className="text-sm text-neutral-500">
                    of {progress.total} platform{progress.total > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#C2F159] to-[#A7E635] transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="text-sm text-neutral-500 text-right">{progress.percent}%</p>
              </div>

              {/* Info text */}
              <p className="text-sm text-neutral-500 text-center">
                Processing video in your browser...
              </p>
            </div>
          )}

          {status === "uploading" && (
            <div className="space-y-4">
              {/* Upload progress */}
              <div className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5 text-[#C2F159]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-neutral-700 dark:text-neutral-300">Uploading to cloud storage...</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#C2F159] to-[#A7E635] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {status === "completed" && downloadUrls && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
                Your videos are ready! Click to download:
              </p>

              {/* Download links */}
              <div className="space-y-2">
                {downloadUrls.map(({ platformId, url, filename }) => {
                  const platform = getPlatformById(platformId);
                  return (
                    <a
                      key={platformId}
                      href={url}
                      download={filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#C2F159] to-[#A7E635] flex items-center justify-center">
                          <svg className="w-4 h-4 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </div>
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {platform?.name || platformId}
                        </span>
                      </div>
                      <svg className="w-5 h-5 text-neutral-400 group-hover:text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  );
                })}
              </div>

              {/* Copy all links button */}
              <button
                onClick={() => {
                  const links = downloadUrls.map(u => u.url).join("\n");
                  navigator.clipboard.writeText(links);
                }}
                className="w-full py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors"
              >
                Copy all download links
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === "error" && (
          <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50">
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors"
            >
              Close
            </button>
          </div>
        )}
        {status === "processing" && (
          <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 flex justify-center">
            <button
              onClick={onClose}
              className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {status === "uploading" && (
          <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50">
            <p className="text-xs text-neutral-500 text-center">
              Almost done... Please wait
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
