"use client";

import { useState } from "react";

const steps = [
  {
    video: "/assets/step-1-upload.mp4",
    title: "Upload & Choose Sizes",
    description: "Drop your video and select the aspect ratios you need",
    detail: "No sign-up required",
  },
  {
    video: "/assets/step-2-detect.mp4",
    title: "AI Subject Detection",
    description: "Automatically detects and tracks subjects to keep them centered",
    detail: "No cropped faces · No lost content",
  },
  {
    video: "/assets/step-3-export.mp4",
    title: "Export All Sizes",
    description: "Download all versions in one click, ready for every platform",
    detail: "9:16 / 16:9 / 4:5 / 1:1 covered",
  },
];

export function HowItWorksSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section id="how-it-works" className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl mb-4">
            3 Steps. Zero Learning Curve.
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            Upload → Auto-process → Download. That's it.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3 items-stretch">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className={`relative group transition-all duration-300 ease-out ${
                  hoveredIndex !== null && hoveredIndex !== index
                    ? "scale-95 opacity-70"
                    : hoveredIndex === index
                      ? "scale-105 z-10"
                      : ""
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className={`flex h-full flex-col rounded-2xl border bg-white dark:bg-neutral-900 overflow-hidden transition-all duration-300 shadow-sm hover:shadow-lg ${
                  hoveredIndex === index
                    ? "border-[#C2F159] shadow-xl shadow-[#C2F159]/10"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-[#C2F159]/30"
                }`}>
                  {/* Video Preview */}
                  <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <video
                      src={step.video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                    {/* Step number overlay */}
                    <div className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#C2F159] text-sm font-bold text-neutral-900 shadow-lg">
                      {index + 1}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                      {step.title}
                    </h3>
                    <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
                      {step.description}
                    </p>
                    <p className="text-xs font-medium text-[#C2F159]">
                      {step.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reassurance text */}
        <div className="mt-12 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Runs entirely in your browser · Videos never leave your device · Privacy first
          </p>
        </div>
      </div>
    </section>
  );
}
