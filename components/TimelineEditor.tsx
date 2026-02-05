import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { VideoClip } from "@/lib/types";

interface TimelineEditorProps {
  clips: VideoClip[];
  duration: number;
  selectedClipId: string | null;
  currentTime: number;
  onClipSelect: (id: string | null) => void;
  onClipResize: (id: string, newStartTime: number, newEndTime: number) => void;
  onClipDelete: (id: string) => void;
  onClipsChange: (clips: VideoClip[]) => void;
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
  onClipsChange,
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

  // Undo/Redo history - use refs to avoid stale closure issues
  const historyRef = useRef<VideoClip[][]>([JSON.parse(JSON.stringify(clips))]);
  const historyIndexRef = useRef(0);
  const [, forceUpdate] = useState(0);
  const isRestoringRef = useRef(false);
  const lastClipsSignatureRef = useRef<string>(clips.map(c => c.id).join(','));
  const dragStartClipsRef = useRef<VideoClip[] | null>(null);

  // Get current values for rendering
  const historyIndex = historyIndexRef.current;
  const history = historyRef.current;

  // Reset history when clips are externally replaced (e.g., analysis complete, ratio change)
  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      lastClipsSignatureRef.current = clips.map(c => c.id).join(',');
      return;
    }

    const currentSignature = clips.map(c => c.id).join(',');
    if (currentSignature !== lastClipsSignatureRef.current) {
      // Check if this is an external replacement (all clip IDs are different)
      const historyClipIds = historyRef.current[historyIndexRef.current]?.map(c => c.id) || [];
      const currentClipIds = clips.map(c => c.id);
      const isExternalReplacement = currentClipIds.length > 0 &&
        !currentClipIds.some(id => historyClipIds.includes(id));

      if (isExternalReplacement) {
        historyRef.current = [JSON.parse(JSON.stringify(clips))];
        historyIndexRef.current = 0;
        forceUpdate(n => n + 1);
      }
      lastClipsSignatureRef.current = currentSignature;
    }
  }, [clips]);

  const saveToHistory = useCallback((newClips: VideoClip[]) => {
    if (isRestoringRef.current) return;
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;

    // Truncate history if we've undone and are making a new change
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newClips)));

    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    forceUpdate(n => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      historyIndexRef.current = newIndex;
      onClipSelect(null);
      isRestoringRef.current = true;
      const restoredClips = JSON.parse(JSON.stringify(historyRef.current[newIndex]));
      onClipsChange(restoredClips);
      forceUpdate(n => n + 1);
    }
  }, [onClipsChange, onClipSelect]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      historyIndexRef.current = newIndex;
      onClipSelect(null);
      isRestoringRef.current = true;
      const restoredClips = JSON.parse(JSON.stringify(historyRef.current[newIndex]));
      onClipsChange(restoredClips);
      forceUpdate(n => n + 1);
    }
  }, [onClipsChange, onClipSelect]);

  // Split clip at current playhead position
  const splitClipAtPlayhead = useCallback(() => {
    const clipAtTime = clips.find(
      clip => currentTime > clip.startTime && currentTime < clip.endTime
    );
    if (!clipAtTime) return;

    const newClip1: VideoClip = {
      ...clipAtTime,
      id: `${clipAtTime.id}_a`,
      endTime: currentTime,
    };
    const newClip2: VideoClip = {
      ...clipAtTime,
      id: `${clipAtTime.id}_b`,
      startTime: currentTime,
    };

    const newClips = clips.map(clip =>
      clip.id === clipAtTime.id ? newClip1 : clip
    );
    const insertIndex = newClips.findIndex(c => c.id === newClip1.id) + 1;
    newClips.splice(insertIndex, 0, newClip2);

    onClipsChange(newClips);
    onClipSelect(newClip2.id);
    // Save to history after the change
    setTimeout(() => saveToHistory(newClips), 0);
  }, [clips, currentTime, onClipsChange, onClipSelect, saveToHistory]);

  // Check if playhead is inside any clip (for split button state)
  const canSplit = useMemo(() => {
    return clips.some(
      clip => currentTime > clip.startTime + 0.1 && currentTime < clip.endTime - 0.1
    );
  }, [clips, currentTime]);

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
      // Save current state before dragging for undo
      dragStartClipsRef.current = JSON.parse(JSON.stringify(clips));
      setDragState({
        type,
        clipId: clip.id,
        startX: e.clientX,
        originalStartTime: clip.startTime,
        originalEndTime: clip.endTime,
      });
      onClipSelect(clip.id);
    },
    [clips, onClipSelect]
  );

  // Handle clip boundaries with "覆盖式" behavior - clips must remain continuous without gaps
  const applyClipOverlap = useCallback((
    draggedClipId: string,
    newStartTime: number,
    newEndTime: number
  ): VideoClip[] => {
    const minDuration = 0.5;
    const draggedClip = clips.find(c => c.id === draggedClipId);
    if (!draggedClip) return clips;

    // Sort clips by start time
    const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
    const draggedIndex = sortedClips.findIndex(c => c.id === draggedClipId);

    // Create updated clips array
    let updatedClips: VideoClip[] = sortedClips.map(clip => ({ ...clip }));

    // Get original boundaries of dragged clip
    const originalStart = updatedClips[draggedIndex].startTime;
    const originalEnd = updatedClips[draggedIndex].endTime;

    // Update the dragged clip
    updatedClips[draggedIndex] = {
      ...updatedClips[draggedIndex],
      startTime: newStartTime,
      endTime: newEndTime,
    };

    // Handle expansion LEFT (newStartTime < originalStart) - trim previous clips
    if (newStartTime < originalStart && draggedIndex > 0) {
      for (let i = draggedIndex - 1; i >= 0; i--) {
        const clip = updatedClips[i];
        const nextClip = updatedClips[i + 1];
        if (clip.endTime > nextClip.startTime) {
          const newEnd = nextClip.startTime;
          if (newEnd - clip.startTime < minDuration) {
            updatedClips[i] = { ...clip, startTime: -1, endTime: -1 };
          } else {
            updatedClips[i] = { ...clip, endTime: newEnd };
          }
        }
      }
    }

    // Handle shrink LEFT (newStartTime > originalStart) - expand previous clip to fill gap
    if (newStartTime > originalStart && draggedIndex > 0) {
      const prevClip = updatedClips[draggedIndex - 1];
      if (prevClip.startTime !== -1) {
        updatedClips[draggedIndex - 1] = { ...prevClip, endTime: newStartTime };
      }
    }

    // Handle expansion RIGHT (newEndTime > originalEnd) - trim next clips
    if (newEndTime > originalEnd && draggedIndex < updatedClips.length - 1) {
      for (let i = draggedIndex + 1; i < updatedClips.length; i++) {
        const clip = updatedClips[i];
        const prevClip = updatedClips[i - 1];
        if (prevClip.startTime !== -1 && clip.startTime < prevClip.endTime) {
          const newStart = prevClip.endTime;
          if (clip.endTime - newStart < minDuration) {
            updatedClips[i] = { ...clip, startTime: -1, endTime: -1 };
          } else {
            updatedClips[i] = { ...clip, startTime: newStart };
          }
        }
      }
    }

    // Handle shrink RIGHT (newEndTime < originalEnd) - expand next clip to fill gap
    if (newEndTime < originalEnd && draggedIndex < updatedClips.length - 1) {
      const nextClip = updatedClips[draggedIndex + 1];
      if (nextClip.startTime !== -1) {
        updatedClips[draggedIndex + 1] = { ...nextClip, startTime: newEndTime };
      }
    }

    // Remove clips marked for deletion
    updatedClips = updatedClips.filter(clip => clip.startTime !== -1);

    // Final pass: ensure all clips are continuous (no gaps)
    for (let i = 1; i < updatedClips.length; i++) {
      const prevClip = updatedClips[i - 1];
      const currentClip = updatedClips[i];
      if (Math.abs(currentClip.startTime - prevClip.endTime) > 0.01) {
        updatedClips[i] = { ...currentClip, startTime: prevClip.endTime };
      }
    }

    // Ensure all clips are within bounds
    updatedClips = updatedClips.map(clip => ({
      ...clip,
      startTime: Math.max(0, clip.startTime),
      endTime: Math.min(Math.max(clip.startTime + minDuration, clip.endTime), duration),
    }));

    return updatedClips;
  }, [clips, duration]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.clipId || !dragState.type) return;

      // Sort clips to find first and last
      const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
      const isFirstClip = sortedClips[0]?.id === dragState.clipId;
      const isLastClip = sortedClips[sortedClips.length - 1]?.id === dragState.clipId;

      // Restrict: first clip's left edge and last clip's right edge cannot be dragged
      if (dragState.type === "resize-start" && isFirstClip) return;
      if (dragState.type === "resize-end" && isLastClip) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = pxToTime(deltaX);

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

      const minDuration = 0.5;
      newStartTime = Math.max(0, Math.min(newStartTime, duration - minDuration));
      newEndTime = Math.max(newStartTime + minDuration, Math.min(newEndTime, duration));

      // Apply overlay behavior
      const updatedClips = applyClipOverlap(dragState.clipId, newStartTime, newEndTime);
      onClipsChange(updatedClips);
    },
    [dragState, duration, clips, pxToTime, applyClipOverlap, onClipsChange]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.clipId && dragState.type && dragStartClipsRef.current) {
      // Check if clips actually changed
      const startClipsStr = JSON.stringify(dragStartClipsRef.current);
      const currentClipsStr = JSON.stringify(clips);
      if (startClipsStr !== currentClipsStr) {
        saveToHistory(clips);
      }
    }
    dragStartClipsRef.current = null;
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

  // Generate time markers for the ruler
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = duration <= 10 ? 1 : duration <= 30 ? 5 : duration <= 60 ? 10 : 30;
    for (let t = 0; t <= duration; t += interval) {
      markers.push(t);
    }
    // Always include the end time
    if (markers[markers.length - 1] !== duration) {
      markers.push(duration);
    }
    return markers;
  }, [duration]);

  return (
    <div className="relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 p-3">
      {/* Header with clip count and action buttons */}
      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{clips.length} clip{clips.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Action buttons - Undo/Redo/Split */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
              historyIndex <= 0
                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
            }`}
            title="Undo (撤销)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6" />
              <path d="M3 13a9 9 0 1 0 3-7.7L3 7" />
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
            title="Redo (重做)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6" />
              <path d="M21 13a9 9 0 1 1-3-7.7L21 7" />
            </svg>
          </button>
          <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-600 mx-1" />
          <button
            onClick={splitClipAtPlayhead}
            disabled={!canSplit}
            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
              !canSplit
                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
            }`}
            title="Split at playhead (剪切)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Time ruler at top of track - clickable to seek */}
      <div
        className="relative h-5 mb-1 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const time = (x / rect.width) * duration;
          if (onSeek) {
            onSeek(Math.max(0, Math.min(time, duration)));
          }
        }}
      >
        {timeMarkers.map((time, idx) => (
          <div
            key={time}
            className="absolute flex flex-col items-center pointer-events-none"
            style={{ left: `${timeToPx(time)}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
              {formatTime(time)}
            </span>
            <div className="w-px h-1.5 bg-neutral-300 dark:bg-neutral-600" />
          </div>
        ))}
      </div>

      {/* Timeline track */}
      <div
        ref={timelineRef}
        className="relative cursor-pointer"
        onClick={handleTimelineClick}
      >
        <div className="relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-800 dark:bg-neutral-900 h-16">
          {clips.map((clip, index) => {
            // Sort clips to determine if this is first or last
            const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
            const isFirstClip = sortedClips[0]?.id === clip.id;
            const isLastClip = sortedClips[sortedClips.length - 1]?.id === clip.id;

            const left = timeToPx(clip.startTime);
            const width = timeToPx(clip.endTime - clip.startTime);
            const isSelected = clip.id === selectedClipId;
            const clipDuration = clip.endTime - clip.startTime;
            // Estimate if text will fit (rough calculation)
            const showFullText = width > 8; // ~8% width to show full text
            const showTime = width > 5;

            return (
              <div
                key={clip.id}
                className={`absolute h-full transition-all rounded overflow-hidden cursor-pointer ${
                  isSelected
                    ? "bg-[#C2F159] ring-2 ring-white ring-offset-1 ring-offset-neutral-900"
                    : "bg-white hover:bg-neutral-50 border border-neutral-200"
                }`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  zIndex: isSelected ? 10 : 1
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClipSelect(clip.id);
                  // Jump playhead to clip start
                  if (onSeek) {
                    onSeek(clip.startTime);
                  }
                }}
              >
                {/* Clip info - with text truncation */}
                <div className={`h-full flex flex-col items-center justify-center px-1 overflow-hidden pointer-events-none ${
                  isSelected ? "text-black" : "text-neutral-800"
                }`}>
                  <div className="font-medium text-xs truncate w-full text-center">
                    {showFullText ? `Clip ${index + 1}` : `${index + 1}`}
                  </div>
                  {showTime && (
                    <div className="text-[10px] opacity-80 truncate w-full text-center">
                      {showFullText
                        ? `${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`
                        : formatTime(clipDuration)
                      }
                    </div>
                  )}
                  {clip.useFullFrame && showFullText && (
                    <div className="text-[9px] opacity-70">letterbox</div>
                  )}
                </div>

                {/* Resize handles - only show when selected, hide first clip left edge and last clip right edge */}
                {isSelected && (
                  <>
                    {/* Left resize handle - hidden for first clip */}
                    {!isFirstClip && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/30 hover:bg-white/50 flex items-center justify-center"
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "resize-start")}
                      >
                        <div className="w-0.5 h-8 bg-black/40 rounded" />
                      </div>
                    )}
                    {/* Right resize handle - hidden for last clip */}
                    {!isLastClip && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/30 hover:bg-white/50 flex items-center justify-center"
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "resize-end")}
                      >
                        <div className="w-0.5 h-8 bg-black/40 rounded" />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Empty placeholder when no clips */}
          {clips.length === 0 && (
            <div className="h-full w-full flex items-center justify-center text-xs text-neutral-400">
              No clips generated yet
            </div>
          )}
        </div>

        {/* Playhead - draggable */}
        <div
          className="absolute top-0 bottom-0 w-4 z-20 cursor-ew-resize flex justify-center"
          style={{ left: `calc(${timeToPx(currentTime)}% - 8px)` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            const startX = e.clientX;
            const startTime = currentTime;

            const handleMouseMove = (moveEvent: MouseEvent) => {
              if (!timelineRef.current) return;
              const rect = timelineRef.current.getBoundingClientRect();
              const deltaX = moveEvent.clientX - startX;
              const deltaTime = (deltaX / rect.width) * duration;
              const newTime = Math.max(0, Math.min(startTime + deltaTime, duration));
              if (onSeek) {
                onSeek(newTime);
              }
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div className="w-0.5 h-full bg-[#C2F159]" />
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#C2F159] rotate-45 rounded-sm" />
        </div>
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-neutral-400 text-center mt-2">
        Click to seek • Click clip to select & edit • Drag to move • Drag edges to resize
      </div>
    </div>
  );
};
