"use client";

const comparisons = [
  {
    problem: "Paywall after upload",
    solution: "Completely free, no hidden charges",
  },
  {
    problem: "Giant watermarks on export",
    solution: "No watermarks, ready to publish",
  },
  {
    problem: "Forced sign-up required",
    solution: "No registration, instant access",
  },
  {
    problem: "Faces get cropped off",
    solution: "AI tracking keeps subjects centered",
  },
  {
    problem: "Stretched, distorted footage",
    solution: "Natural proportions, smart fill",
  },
  {
    problem: "Process each platform separately",
    solution: "One upload, all sizes at once",
  },
];

export function TrustSection() {
  return (
    <section className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl mb-4">
            We Know Your Pain
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            Frustrated by "free" tools that aren't? We built this different.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="grid gap-4 sm:grid-cols-2">
            {comparisons.map((item) => (
              <div
                key={item.problem}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
              >
                <div className="flex items-start gap-3 mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                    <svg className="h-3.5 w-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 line-through">
                    {item.problem}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C2F159]/10">
                    <svg className="h-3.5 w-3.5 text-[#C2F159]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {item.solution}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Big promise */}
        <div className="mt-12 mx-auto max-w-xl text-center">
          <div className="rounded-2xl border-2 border-[#C2F159]/20 bg-[#C2F159]/5 p-6">
            <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              🤝 Our Promise
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">
              Video Crop Pro is <strong className="text-neutral-900 dark:text-neutral-100">free forever</strong>.
              No surprise charges, no export watermarks, no forced sign-ups.
              Just a tool that works.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
