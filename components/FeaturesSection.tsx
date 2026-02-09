"use client";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <circle cx="12" cy="8" r="4" />
        <path d="M5 20a7 7 0 0 1 14 0" />
        <path d="M12 12v4" strokeDasharray="2 2" />
        <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
      </svg>
    ),
    title: "Subject Always Centered",
    description: "AI tracks faces and key subjects, ensuring they stay in frame after every crop",
    highlight: "No manual adjustments",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeOpacity="0.3" />
        <path d="M7 7l10 10M17 7l-10 10" strokeDasharray="2 2" />
      </svg>
    ),
    title: "No Stretching or Distortion",
    description: "Maintains original proportions with intelligent fill—no weird stretching or compression",
    highlight: "Professional quality",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "One Upload, All Platforms",
    description: "Export 9:16, 16:9, 4:5, and 1:1 versions from a single video upload",
    highlight: "2x faster workflow",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    title: "No Watermarks",
    description: "Export clean videos without any branding or watermarks—ready to publish anywhere",
    highlight: "Same as paid tools",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
        <path d="M2 12h2M20 12h2M12 2v2M12 20v2" strokeOpacity="0.3" />
      </svg>
    ),
    title: "Truly Free, No Hidden Fees",
    description: "No paywall after upload, no premium tiers—every feature is free forever",
    highlight: "No tricks",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
    title: "No Sign-up Required",
    description: "No email, no account, no personal data collected—just open and use",
    highlight: "Your videos stay yours",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-neutral-100 dark:bg-neutral-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl mb-4">
            Built for One Thing: Multi-Platform Video
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            Not a general video editor—just the best tool for adapting one video to every platform
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 transition-all hover:border-[#C2F159]/30 shadow-sm hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#C2F159]/10 transition-colors group-hover:bg-[#C2F159]/20 text-[#C2F159]">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {feature.title}
              </h3>
              <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
                {feature.description}
              </p>
              <span className="inline-block rounded-full bg-[#C2F159]/10 px-3 py-1 text-xs font-medium text-[#C2F159]">
                {feature.highlight}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
