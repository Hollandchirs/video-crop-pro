"use client";

import { useState } from "react";
import { VideoUploader } from "@/components/VideoUploader";
import { PlatformSelector } from "@/components/PlatformSelector";
import { CropStrategySelector } from "@/components/CropStrategySelector";
import { VideoEditor } from "@/components/VideoEditor";
import { useVideoStore } from "@/lib/store";

export default function HomePage() {
  const [showEditor, setShowEditor] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { videoFile, selectedPlatforms, reset, editProject, isAnalyzing } = useVideoStore();

  // Check if export is ready (has video, has selected platforms, has generated clips, not analyzing)
  const isExportReady = videoFile && selectedPlatforms.length > 0 && editProject && editProject.clips.length > 0 && !isAnalyzing;

  const handleVideoLoaded = () => {
    setShowEditor(true);
  };

  const handleReset = () => {
    reset();
    setShowEditor(false);
  };

  const handleExport = async () => {
    if (!isExportReady) return;
    setIsExporting(true);
    // TODO: Implement actual export logic
    console.log("Exporting for platforms:", selectedPlatforms);
    setTimeout(() => setIsExporting(false), 2000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f7f7f8] to-[#eef0f2] dark:from-[#1f1f1f] dark:to-[#2a2a2a]">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={handleReset}
              className="text-xl font-bold bg-gradient-to-r from-[#C2F159] to-[#A7E635] bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              Video Crop Pro
            </button>
            {showEditor ? (
              <button
                onClick={handleExport}
                disabled={!isExportReady || isExporting}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  isExportReady
                    ? "bg-[#C2F159] text-neutral-900 shadow-md hover:shadow-lg hover:opacity-90"
                    : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                }`}
              >
                {isExporting ? "Exporting..." : "Export"}
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <a
                  href="#features"
                  className="text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                >
                  Feature
                </a>
                <a
                  href="#faq"
                  className="text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                >
                  FAQ
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - Only show when no video */}
      {!showEditor && (
        <section className="max-w-4xl mx-auto px-4 pt-16 pb-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-4 text-balance">
            Crop Videos for{" "}
            <span className="bg-gradient-to-r from-[#C2F159] to-[#A7E635] bg-clip-text text-transparent">
              Any Platform
            </span>
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8 text-balance">
            Free. No watermark. No signup. Smart face detection.
          </p>
        </section>
      )}

      {/* Main Content */}
      <section
        className={`mx-auto ${showEditor
          ? "max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-6 h-[calc(100vh-5rem)] overflow-hidden"
          : "max-w-4xl px-4 pb-12"}`}
      >
        {!showEditor ? (
          <>
            {/* Upload Area Only */}
            <VideoUploader onVideoLoaded={handleVideoLoaded} />
          </>
        ) : (
          <>
            {/* Editor Layout: Video + Settings Side by Side */}
            <div className="grid lg:grid-cols-[1fr_450px] gap-3 h-full">
              {/* Video Editor Column */}
              <div className="min-w-0 flex flex-col gap-3 h-full">
                {/* Video Info Header */}
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between px-5 py-4">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {videoFile?.file.name}
                    </h3>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 whitespace-nowrap ml-4">
                      {videoFile?.width}×{videoFile?.height} •{" "}
                      {Math.floor((videoFile?.duration || 0) / 60)}:
                      {String(Math.floor((videoFile?.duration || 0) % 60)).padStart(2, "0")}
                    </div>
                  </div>
                </div>
                {/* Video Editor */}
                <div className="min-h-0 flex-1">
                  <VideoEditor />
                </div>
              </div>

              {/* Settings Panel Column - Aligned with Export button */}
              <div className="space-y-3 h-full overflow-hidden flex flex-col">
                {/* Platform Selector */}
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0 flex-1">
                  <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
                    <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      Target Platforms
                    </h4>
                  </div>
                  <div className="p-5 min-h-0 flex-1 overflow-hidden">
                    <PlatformSelector />
                  </div>
                </div>

                {/* Crop Strategy Selector */}
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex-shrink-0">
                  <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
                    <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      Crop Strategy
                    </h4>
                  </div>
                  <div className="p-4">
                    <CropStrategySelector />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Features Section - Hide when editing */}
      {!showEditor && (
        <section id="features" className="max-w-6xl mx-auto px-4 py-16">
          <h3 className="text-2xl font-bold text-center text-neutral-900 dark:text-neutral-100 mb-12">
            Why Choose Video Crop Pro?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🎯",
                title: "Smart Face Detection",
                description:
                  "AI-powered face tracking keeps subjects perfectly framed in vertical videos",
              },
              {
                icon: "⚡",
                title: "Lightning Fast",
                description:
                  "Browser-based processing means your videos never leave your device",
              },
              {
                icon: "💰",
                title: "100% Free",
                description: "No watermark, no signup, no hidden fees. Unlimited exports",
              },
              {
                icon: "📱",
                title: "All Platforms",
                description:
                  "One video, perfectly cropped for TikTok, Instagram, YouTube, and more",
              },
              {
                icon: "🔒",
                title: "Privacy First",
                description: "All processing happens locally in your browser",
              },
              {
                icon: "✨",
                title: "No Quality Loss",
                description: "Export in full HD quality with no compression artifacts",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  {feature.title}
                </h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ Section - Hide when editing */}
      {!showEditor && (
        <section id="faq" className="max-w-3xl mx-auto px-4 py-16">
          <h3 className="text-2xl font-bold text-center text-neutral-900 dark:text-neutral-100 mb-8">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            {[
              {
                q: "Is Video Crop Pro really free?",
                a: "Yes! No hidden fees, no watermarks, no signup required. All features are completely free.",
              },
              {
                q: "What video formats are supported?",
                a: "We support MP4, MOV, WebM, and most common video formats. Videos up to 500MB.",
              },
              {
                q: "Do you upload my videos?",
                a: "No. All processing happens in your browser using WebAssembly. Your videos never leave your device.",
              },
              {
                q: "Can I crop multiple videos at once?",
                a: "Currently we process one video at a time, but you can export to multiple platforms simultaneously.",
              },
            ].map((faq, i) => (
              <details
                key={i}
                className="group bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <summary className="cursor-pointer p-4 font-medium text-neutral-900 dark:text-neutral-100 flex justify-between items-center">
                  {faq.q}
                  <span className="text-neutral-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm text-neutral-600 dark:text-neutral-400">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      {!showEditor && (
        <footer className="border-t border-neutral-200 dark:border-neutral-800 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
            <p>© 2026 Video Crop Pro. Free forever. No tracking. No cookies.</p>
          </div>
        </footer>
      )}
    </main>
  );
}
