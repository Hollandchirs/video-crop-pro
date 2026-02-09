"use client";

import { useState, useRef } from "react";
import { VideoUploader } from "@/components/VideoUploader";
import { PlatformSelector } from "@/components/PlatformSelector";
import { CropStrategySelector } from "@/components/CropStrategySelector";
import { VideoEditor } from "@/components/VideoEditor";
import { ExportProgressModal } from "@/components/ExportProgressModal";
import { PlatformShowcase } from "@/components/PlatformShowcase";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { TrustSection } from "@/components/TrustSection";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { useVideoStore } from "@/lib/store";
import { getPlatformById } from "@/lib/platforms";

// Dynamic import to avoid SSR issues
const loadVideoExporter = () => import("@/lib/videoExporter");

export default function HomePage() {
  const [showEditor, setShowEditor] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { videoFile, selectedPlatforms, reset, editProject, isAnalyzing, currentClips, cropStrategy, isProcessing, setIsProcessing, cropRegion } = useVideoStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<"processing" | "completed" | "error">("processing");
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
    platformId: string;
    percent: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Check if export is ready (has video, has selected platforms, has generated clips, not analyzing)
  const isExportReady = videoFile && selectedPlatforms.length > 0 && currentClips && currentClips.length > 0 && !isAnalyzing;

  const handleVideoLoaded = () => {
    setShowEditor(true);
  };

  const handleReset = () => {
    reset();
    setShowEditor(false);
  };

  const handleExport = async () => {
    if (!isExportReady || !videoFile || !currentClips || selectedPlatforms.length === 0) return;

    // Abort any previous export
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsExporting(true);
    setIsExportModalOpen(true);
    setExportStatus("processing");
    setExportProgress(null);
    setErrorMessage("");
    setIsProcessing(true);

    try {
      // Use the first selected platform for export dimensions
      const firstPlatformId = selectedPlatforms[0];
      const platform = getPlatformById(firstPlatformId);
      if (!platform) throw new Error(`Unknown platform: ${firstPlatformId}`);

      setExportProgress({
        current: 1,
        total: 1,
        platformId: firstPlatformId,
        percent: 0,
      });

      const progressCallback = (percent: number) => {
        if (abortController.signal.aborted) return;
        console.log("[Export] Progress:", percent);
        setExportProgress({
          current: 1,
          total: 1,
          platformId: firstPlatformId,
          percent,
        });
      };

      // FFmpeg WASM local processing
      console.log("[Export] Loading exporter...");
      const { exportVideoWithClips, downloadBlob } = await loadVideoExporter();
      console.log("[Export] Starting export...");

      // Prepare crop region dimensions for export - these must match preview
      const cropRegionForExport = cropRegion ? { width: cropRegion.width, height: cropRegion.height } : undefined;

      const blob = await exportVideoWithClips(
        videoFile.file,
        currentClips,
        platform.width,
        platform.height,
        cropStrategy || "smart-crop",
        progressCallback,
        cropRegionForExport
      );
      console.log("[Export] Export complete, downloading...");

      // Check if aborted during export
      if (abortController.signal.aborted) return;

      // Download file
      const baseName = videoFile.file.name.replace(/\.[^/.]+$/, "");
      const filename = `${baseName}_${platform.name.replace(/\s+/g, "_").toLowerCase()}.mp4`;

      setExportStatus("completed");
      setExportProgress({ current: 1, total: 1, platformId: firstPlatformId, percent: 100 });
      downloadBlob(blob, filename);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (abortController.signal.aborted) return;
      console.error("[Export] Error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Export failed. Please try again.");
      setExportStatus("error");
    } finally {
      if (abortControllerRef.current === abortController) {
        setIsExporting(false);
        setIsProcessing(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f7f7f8] to-[#eef0f2] dark:from-[#1f1f1f] dark:to-[#2a2a2a]">
      {/* Header */}
      <header className="border-b border-neutral-200/50 dark:border-neutral-800/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C2F159]">
                <svg className="h-5 w-5 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="2" y1="7" x2="7" y2="7" />
                  <line x1="2" y1="17" x2="7" y2="17" />
                  <line x1="17" y1="17" x2="22" y2="17" />
                  <line x1="17" y1="7" x2="22" y2="7" />
                </svg>
              </div>
              <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                VideoCrop<span className="text-[#C2F159]">.pro</span>
              </span>
            </button>

            {/* Center Navigation */}
            <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              <a
                href="#how-it-works"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#features"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                Features
              </a>
              <a
                href="#faq"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                FAQ
              </a>
            </nav>

            {/* Right Button */}
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
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                  input?.click();
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[#C2F159] px-4 py-1.5 text-sm font-semibold text-neutral-900 shadow-md transition-all hover:shadow-lg hover:opacity-90"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                Upload Video
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Landing Page - Only show when no video */}
      {!showEditor ? (
        <>
          {/* Hero Section */}
          <section className="hero-bg relative overflow-hidden pb-4 pt-12">
            <div className="max-w-4xl mx-auto px-4">
              {/* Main Headline */}
              <div className="text-center">
                <h1 className="mb-8 text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-5xl lg:text-6xl animate-fade-up animation-delay-100">
                  Smart Crop for
                  <span className="text-[#C2F159]"> Short Videos</span>
                </h1>
                <p className="mb-6 text-lg text-neutral-600 dark:text-neutral-400 sm:text-xl animate-fade-up animation-delay-200 text-balance leading-loose">
                  One-click resize for TikTok, Reels, Shorts & all social platforms.
                  <br className="hidden sm:block" />
                  <strong className="text-neutral-900 dark:text-neutral-100">AI keeps subjects centered. No stretching. No cropped faces.</strong>
                </p>

                {/* Trust badges */}
                <div className="mb-10 flex flex-wrap items-center justify-center gap-3 text-sm animate-fade-up animation-delay-300">
                  {["Free Forever", "No Watermark", "No Sign-up", "100% Private"].map((badge) => (
                    <div
                      key={badge}
                      className="flex items-center gap-2 rounded-full border border-[#C2F159]/20 bg-[#C2F159]/5 px-4 py-2 backdrop-blur-sm transition-all hover:border-[#C2F159]/40 hover:bg-[#C2F159]/10"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C2F159]/20">
                        <svg className="h-3 w-3 text-[#C2F159]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{badge}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Upload Area */}
          <section className="max-w-2xl mx-auto px-4 pb-16">
            <div className="animate-scale-in animation-delay-400">
              <VideoUploader onVideoLoaded={handleVideoLoaded} />
            </div>
          </section>

          {/* Platform Showcase */}
          <PlatformShowcase />

          {/* How It Works Section */}
          <HowItWorksSection />

          {/* Features Section */}
          <FeaturesSection />

          {/* Trust Section */}
          <TrustSection />

          {/* FAQ Section */}
          <FAQSection />

          {/* Footer */}
          <Footer />
        </>
      ) : (
        <>
          {/* Editor Layout: Video + Settings Side by Side */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6 h-[calc(100vh-5rem)] overflow-hidden">
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
          </section>
        </>
      )}

      {/* Export Progress Modal */}
      <ExportProgressModal
        isOpen={isExportModalOpen}
        platforms={selectedPlatforms}
        progress={exportProgress}
        status={exportStatus}
        error={errorMessage}
        onClose={async () => {
          // Abort any ongoing export
          abortControllerRef.current?.abort();

          // Terminate FFmpeg to stop background processing
          try {
            const { terminateCurrentOperation } = await loadVideoExporter();
            terminateCurrentOperation();
          } catch (e) {
            console.warn("Failed to terminate FFmpeg:", e);
          }

          setIsExportModalOpen(false);
          setExportStatus("processing");
          setIsExporting(false);
          setIsProcessing(false);
        }}
      />
    </main>
  );
}
