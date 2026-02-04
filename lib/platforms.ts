import { Platform } from "./types";

// Aspect ratio configurations
export const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

// Platform configurations with multiple aspect ratios
export interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  aspectRatios: string[];
}

export const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    id: "youtube",
    name: "YouTube",
    icon: "🎬",
    color: "from-red-500 to-red-600",
    aspectRatios: ["16:9", "9:16", "1:1"],
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "📱",
    color: "from-pink-500 to-purple-600",
    aspectRatios: ["9:16"],
  },
  {
    id: "twitter",
    name: "X",
    icon: "𝕏",
    color: "from-gray-700 to-black",
    aspectRatios: ["16:9", "1:1"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    color: "from-blue-600 to-blue-700",
    aspectRatios: ["16:9", "1:1", "4:5"],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    color: "from-orange-500 to-pink-600",
    aspectRatios: ["9:16", "1:1", "4:5"],
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "👤",
    color: "from-blue-500 to-blue-600",
    aspectRatios: ["16:9", "1:1", "4:5"],
  },
  {
    id: "reddit",
    name: "Reddit",
    icon: "🤖",
    color: "from-orange-500 to-orange-600",
    aspectRatios: ["16:9", "1:1"],
  },
];

// Generate flat PLATFORMS list for compatibility
export const PLATFORMS: Platform[] = PLATFORM_CONFIGS.flatMap((config) =>
  config.aspectRatios.map((ratio) => ({
    id: `${config.id}-${ratio.replace(":", "x")}`,
    name: `${config.name} ${ratio}`,
    aspectRatio: ratio,
    width: ASPECT_RATIOS[ratio].width,
    height: ASPECT_RATIOS[ratio].height,
    icon: config.icon,
    color: config.color,
  }))
);

export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function getPlatformConfigById(id: string): PlatformConfig | undefined {
  return PLATFORM_CONFIGS.find((p) => p.id === id);
}

export function calculateAspectRatio(ratio: string): number {
  const [w, h] = ratio.split(":").map(Number);
  return w / h;
}
