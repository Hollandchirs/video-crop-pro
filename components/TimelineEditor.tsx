import React, { useState, useRef, useCallback, useEffect } from "react";
import { VideoClip } from "@/lib/types";

interface TimelineEditorProps {
  clips: VideoClip[];
  duration: number;
  selectedClipId: string | null;
  currentTime: number;
  onClipSelect: (id: string | null) => void;
  onClipResize: (id: string, newStartTime: number, newEndTime: number) => void;
  onClipDelete: (id: string) => void;
  onSeek?: (time: number) => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  clips,
  duration,
  selectedClipId,
  currentTime,
  onClipSelect,
  onClipResize,
  onClipDelete,
  onSeek,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    type: "move" | "resize-start" | "resize-end" | null;
    clipId: string | null;
    startX: number;
    originalStartTime: number;
    originalEndTime: number;
  }>({
    type: null,
    clipId: null,
    startX: 0,
    originalStartTime: 0,
    originalEndTime: 0,
  });

  // Undo/Redo history
  const [history, setHistory] = useState<VideoClip[][]>([clips]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveToHistory = useCallback((newClips: VideoClip[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newClips)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  useEffect(() => {
    if (JSON.stringify(clips) !== JSON.stringify(history[historyIndex])) {
      saveToHistory(clips);
    }
  }, [clips]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onClipSelect(null);
      const restoredClips = JSON.parse(JSON.stringify(history[newIndex]));
      restoredClips.forEach((clip: VideoClip) => {
        onClipResize(clip.id, clip.startTime, clip.endTime);
      });
    }
  }, [history, historyIndex, onClipResize, onClipSelect]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onClipSelect(null);
      const restoredClips = JSON.parse(JSON.stringify(history[newIndex]));
      restoredClips.forEach((clip: VideoClip) => {
        onClipResize(clip.id, clip.startTime, clip.endTime);
      });
    }
  }, [history, historyIndex, onClipResize, onClipSelect]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const timeToPx = (time: number): number => {
    if (duration === 0) return 0;
    return (time / duration) * 100;
  };

  const pxToTime = (px: number): number => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return (px / rect.width) * duration;
  };

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    if (onSeek) {
      onSeek(time);
    }
  }, [duration, onSeek]);

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: VideoClip, type: "move" | "resize-start" | "resize-end") => {
      e.stopPropagation();
      setDragState({
        type,
        clipId: clip.id,
        startX: e.clientX,
        originalStartTime: clip.startTime,
        originalEndTime: clip.endTime,
      });
      onClipSelect(clip.id);
    },
    [onClipSelect]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.clipId || !dragState.type) return;
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = pxToTime(deltaX);
      const clip = clips.find((c) => c.id === dragState.clipId);
      if (!clip) return;

      let newStartTime = dragState.originalStartTime;
      let newEndTime = dragState.originalEndTime;

      if (dragState.type === "move") {
        newStartTime += deltaTime;
        newEndTime += deltaTime;
      } else if (dragState.type === "resize-start") {
        newStartTime += deltaTime;
      } else if (dragState.type === "resize-end") {
        newEndTime += deltaTime;
      }

      const minDuration = 1;
      newStartTime = Math.max(0, Math.min(newStartTime, duration - minDuration));
      newEndTime = Math.max(newStartTime + minDuration, Math.min(newEndTime, duration));

      onClipResize(dragState.clipId, newStartTime, newEndTime);
    },
    [dragState, clips, duration, pxToTime, onClipResize]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.clipId && dragState.type) {
      saveToHistory(JSON.parse(JSON.stringify(clips)));
    }
    setDragState({
      type: null,
      clipId: null,
      startX: 0,
      originalStartTime: 0,
      originalEndTime: 0,
    });
  }, [dragState, clips, saveToHistory]);

  useEffect(() => {
    if (dragState.type) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const handleClipDoubleClick = useCallback(
    (e: React.MouseEvent, clip: VideoClip) => {
      e.stopPropagation();
      onClipDelete(clip.id);
      onClipSelect(null);
    },
    [onClipDelete, onClipSelect]
  );

  return (
    <div className="relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 p-3">
      {/* Header with time display and undo/redo buttons */}
      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
        <div className="flex items-center gap-3">
          <span>{formatTime(0)}</span>
          <span className="text-neutral-400">|</span>
          <span>{clips.length} clip{clips.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Undo/Redo buttons - Jianying style */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
              historyIndex <= 0
                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
            }`}
            title="撤销"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
              historyIndex >= history.length - 1
                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
            }`}
            title="重做"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <span>{formatTime(duration)}</span>
      </div>

      {/* Timeline track */}
      <div
        ref={timelineRef}
        className="relative cursor-pointer"
        onClick={handleTimelineClick}
      >
        <div className="flex gap-1 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
          {clips.map((clip, index) => {
            const left = timeToPx(clip.startTime);
            const width = timeToPx(clip.endTime - clip.startTime);
            const isSelected = clip.id === selectedClipId;

            return (
              <div
                key={clip.id}
                className={`relative h-16 transition-all ${
                  isSelected
                    ? "bg-[#C2F159]/90"
                    : "bg-[#C2F159]/40 hover:bg-[#C2F159]/60"
                }`}
                style={{ left: `${left}%`, width: `${width}%`, position: 'absolute', height: '64px' }}
                onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                onDoubleClick={(e) => handleClipDoubleClick(e, clip)}
              >
                {/* Clip info */}
                <div className={`text-center px-1 py-2 ${
                  isSelected ? "text-black/90" : "text-white/90"
                }`}>
                  <div className="font-medium text-xs">Clip {index + 1}</div>
                  <div className="text-[10px] opacity-80">
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                  </div>
                  {clip.useFullFrame && (
                    <div className="text-[9px] opacity-70">9:16</div>
                  )}
                </div>

                {/* Resize handles - only show when selected */}
                {isSelected && (
                  <>
                    <div
                      className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10"
                      onMouseDown={(e) => handleClipMouseDown(e, clip, "resize-start")}
                    />
                    <div
                      className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10"
                      onMouseDown={(e) => handleClipMouseDown(e, clip, "resize-end")}
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* Empty placeholder when no clips */}
          {clips.length === 0 && (
            <div className="h-16 w-full flex items-center justify-center text-xs text-neutral-400">
              No clips generated yet
            </div>
          )}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[#C2F159] z-10 pointer-events-none"
          style={{ left: `${timeToPx(currentTime)}%` }}
        >
          <div className="absolute -top-2 -left-2 w-4 h-4 bg-[#C2F159] rotate-45 rounded-sm" />
        </div>

        {/* Seek input */}
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={currentTime}
          onChange={(e) => {
            const time = parseFloat(e.target.value);
            if (onSeek) {
              onSeek(time);
            }
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-neutral-400 text-center mt-2">
        Click to seek • Select clip to edit • Drag to move • Drag edges to resize • Double-click to delete
      </div>
    </div>
  );
};
