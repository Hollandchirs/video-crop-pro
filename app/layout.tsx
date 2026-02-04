import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Crop Pro - Free Video Resizer for Social Media",
  description: "Crop and resize videos for TikTok, Instagram, YouTube, and more. Free, no watermark, no signup. Smart face detection for perfect vertical videos.",
  keywords: "video cropper, video resizer, crop video for tiktok, vertical video, video resize, free video editor",
  openGraph: {
    title: "Video Crop Pro - Free Video Resizer",
    description: "Smart video cropping for all social media platforms",
    type: "website",
  },
  alternates: {
    canonical: "https://videocrop.pro",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
