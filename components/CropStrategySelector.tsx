"use client";

import { useVideoStore } from "@/lib/store";
import { CropStrategy } from "@/lib/types";

const STRATEGIES: {
  id: CropStrategy;
  name: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "smart-crop",
    name: "Smart Crop",
    description: "Subject recognition auto editing",
    icon: "✨",
  },
  {
    id: "center-crop",
    name: "Center Crop",
    description: "Center canvas, no cropping",
    icon: "🎯",
  },
];

export function CropStrategySelector() {
  const { cropStrategy, setCropStrategy, isAnalyzing } = useVideoStore();

  const handleStrategyChange = (newStrategy: CropStrategy) => {
    if (isAnalyzing) {
      alert("Please wait for the current analysis to complete before changing the crop strategy.");
      return;
    }
    setCropStrategy(newStrategy);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {STRATEGIES.map((strategy) => {
          const isSelected = cropStrategy === strategy.id;
          return (
            <button
              key={strategy.id}
              onClick={() => handleStrategyChange(strategy.id)}
              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                isSelected
                  ? "border-[#C2F159] bg-[#C2F159]/20 dark:bg-[#C2F159]/10"
                  : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              <div className="w-full">
                <div
                  className={`text-xs font-medium ${
                    isSelected
                      ? "text-neutral-900 dark:text-[#C2F159]"
                      : "text-neutral-900 dark:text-neutral-100"
                  }`}
                >
                  {strategy.name}
                  {strategy.id === "smart-crop" && (
                    <span className="block text-[10px] text-[#7ea41a] mt-0.5">(Recommended)</span>
                  )}
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    isSelected
                      ? "text-[#7ea41a] dark:text-[#C2F159]"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {strategy.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
