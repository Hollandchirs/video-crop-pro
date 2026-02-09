"use client";

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/30 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#C2F159]">
              <svg className="h-4 w-4 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
            </div>
            <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              VideoCrop<span className="text-[#C2F159]">.pro</span>
            </span>
          </div>

          <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-400">
            Free multi-platform video cropping tool. One upload, every aspect ratio.
            AI-powered subject tracking. No watermarks, no sign-up, no limits.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
            <span>Free Forever</span>
            <span className="h-1 w-1 rounded-full bg-neutral-400" />
            <span>No Watermark</span>
            <span className="h-1 w-1 rounded-full bg-neutral-400" />
            <span>Privacy First</span>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-500">
            © {new Date().getFullYear()} VideoCrop.pro · Built for creators
          </p>
        </div>
      </div>
    </footer>
  );
}
