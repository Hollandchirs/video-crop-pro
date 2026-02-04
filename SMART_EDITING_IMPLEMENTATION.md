# Smart Editing Implementation Summary

## Overview

This document describes the implementation of the Smart Editing feature for the Video Crop Pro application. The smart editing system enables automatic video analysis, black bar detection, speaker trajectory tracking, and intelligent clip generation.

---

## New Files Created

### 1. Core Type Definitions
**File**: `lib/types.ts` (updated)

Added new type definitions:
- `BlackBarsDetection` - Result of black bar detection with safe area
- `SpeakerTrajectoryPoint` - Point in speaker trajectory with timestamp and position
- `VideoClip` - A video clip with time range and crop position
- `EditProject` - Complete edit project containing clips and analysis data

### 2. Black Bar Detection Module
**File**: `lib/blackBarDetector.ts`

Functions:
- `detectBlackBars(videoUrl, duration)` - Detects black bars at multiple time points
- `applyBlackBarCrop()` - Applies black bar removal to get safe area

Features:
- Samples video at 0%, 25%, 50%, 75%, 100%
- Detects top, bottom, left, right black bars
- Returns effective picture area (safe area)

### 3. Trajectory Analyzer Module
**File**: `lib/trajectoryAnalyzer.ts`

Functions:
- `analyzeSpeakerTrajectory()` - Analyzes full video for speaker movement
- `smoothTrajectory()` - Filters outliers and fills gaps
- `identifyMainSpeaker()` - Identifies primary speaker

Features:
- Adaptive sampling based on video length:
  - Short videos (< 1 min): 0.1s interval
  - Medium videos (1-5 min): 0.25s interval
  - Long videos (> 5 min): 0.5s interval
- Progress callback support
- Interpolation for gap filling
- Moving average smoothing

### 4. Clip Generator Module
**File**: `lib/clipGenerator.ts`

Functions:
- `generateSmartClips()` - Creates clips based on speaker trajectory
- `mergeSimilarClips()` - Combines clips with similar positions

Features:
- Predicts speaker movement 0.5s ahead
- Creates new clips when speaker will leave frame
- 10% padding keeps speaker from edges
- Configurable minimum clip duration (default 2s)

### 5. Timeline Editor Component
**File**: `components/TimelineEditor.tsx`

Interactive timeline component with:
- Visual clip representation
- Drag to move clips
- Drag edges to resize clips
- Click to select clips
- Double-click to delete clips
- Playhead indicator
- Time markers

### 6. Smart Video Editor Component
**File**: `components/VideoEditorSmart.tsx`

Enhanced video editor with:
- Full smart analysis workflow
- Preview mode toggle (single/clips)
- Clip-aware playback
- Progress indicator for analysis
- Integrated timeline editor

### 7. Edit Project Manager
**File**: `lib/editProjectManager.ts`

Project management utilities:
- `saveEditProject()` - Save to localStorage
- `loadEditProject()` - Load from localStorage
- `validateProject()` - Check for errors
- `optimizeProject()` - Merge similar clips
- `exportProjectAsJson()` - Export for backup
- `importProjectFromJson()` - Import from backup

### 8. Enhanced Video Exporter
**File**: `lib/videoExporter.ts` (updated)

New function:
- `exportVideoWithClips()` - Export with per-clip cropping

Features:
- Handles single or multiple clips
- Generates FFmpeg filter complex for segments
- Supports both crop and blur-fill strategies
- Progress callbacks

---

## Updated Files

### Store (`lib/store.ts`)
Added new state management:
- `blackBars` - Detected black bar data
- `trajectory` - Speaker trajectory points
- `editProject` - Current edit project
- `selectedClipId` - Currently selected clip
- `isAnalyzing` - Analysis in progress flag
- `analysisProgress` - Analysis progress (0-1)
- `previewMode` - 'single' or 'clips' mode

---

## Usage Flow

### 1. User uploads video
- Video is loaded into the editor
- Initial face detection runs automatically

### 2. User clicks "Analyze & Generate Clips"
- Black bar detection runs (10% progress)
- Trajectory analysis runs (30-70% progress)
- Smart clips are generated (70-95% progress)
- Edit project is created (100% progress)

### 3. User reviews and edits
- Timeline shows all generated clips
- User can drag clips to adjust timing
- User can drag edges to resize clips
- User can double-click to delete clips
- Preview updates in real-time

### 4. User exports video
- Export uses clip-specific crop positions
- FFmpeg applies different crops to each segment
- Final video is downloaded

---

## Technical Details

### Black Bar Detection Algorithm
```
1. Sample video at 5 time points
2. For each frame:
   - Scan edges for black pixels (brightness < 30)
   - Identify continuous black regions
   - Require 90% of edge pixels to be black
3. Use maximum black bars across all samples
4. Return safe area (video minus black bars)
```

### Trajectory Analysis Algorithm
```
1. Calculate sampling interval based on duration
2. For each sample point:
   - Seek video to timestamp
   - Detect faces with speaking detection
   - Identify speaking person
   - Record bounding box relative to safe area
3. Smooth trajectory:
   - Fill gaps with interpolation
   - Apply moving average (window=5)
4. Return smoothed trajectory
```

### Clip Generation Algorithm
```
1. Start with first trajectory point
2. For each point:
   - Calculate speaker velocity
   - Predict position 0.5s ahead
   - If prediction leaves crop area:
     - Create new clip
     - Recenter crop on speaker
3. Enforce minimum clip duration (2s)
4. Merge clips with similar positions
```

### FFmpeg Filter Generation
For multiple clips, generates filter like:
```
[0:v]trim=0:5,setpts=PTS-STARTPTS,crop=1080:1920:100:50,scale=1080:1920[v0];
[0:v]trim=5:12,setpts=PTS-STARTPTS,crop=1080:1920:200:100,scale=1080:1920[v1];
[v0][v1]concat=n=2:v=1[out]
```

---

## Performance Considerations

### Video Length vs Analysis Time
| Video Length | Estimated Analysis Time |
|--------------|------------------------|
| 1 minute | ~30 seconds |
| 5 minutes | ~2 minutes |
| 10 minutes | ~4 minutes |

### Optimization Tips
- Use appropriate sampling intervals
- Limit maximum clips (default: 20)
- Use Web Worker for heavy processing
- Cache trajectory data

---

## Integration Points

### To use in main application:

```tsx
import { VideoEditorSmart } from '@/components/VideoEditorSmart';

// In your component
<VideoEditorSmart />
```

### To export with clips:

```tsx
import { exportVideoWithClips } from '@/lib/videoExporter';

const blob = await exportVideoWithClips(
  videoFile,
  editProject.clips,
  outputWidth,
  outputHeight,
  'crop',
  (progress) => console.log(`${progress}%`)
);
```

---

## Future Enhancements

Possible additions:
1. [ ] Audio waveform visualization on timeline
2. [ ] Keyframe interpolation (smooth pans)
3. [ ] Auto-transition generation
4. [ ] Multi-speaker tracking
5. [ ] Motion-based clip detection
6. [ ] Custom crop regions per clip
7. [ ] Clip presets (zoom in, zoom out, follow)
8. [ ] Undo/redo functionality
9. [ ] Keyboard shortcuts
10. [ ] Export to edit decision list (EDL)

---

## Troubleshooting

### Common Issues

**Issue**: Analysis takes too long
- **Solution**: Increase sampling interval in `getSamplingInterval()`

**Issue**: Too many clips generated
- **Solution**: Increase `minClipDuration` or `positionThreshold` in `generateSmartClips()`

**Issue**: Jumpy video playback
- **Solution**: Increase `smoothFactor` in trajectory analyzer

**Issue**: FFmpeg export fails
- **Solution**: Reduce number of clips or simplify filter chain

---

## API Reference

### BlackBarsDetection
```typescript
interface BlackBarsDetection {
  hasBlackBars: boolean;
  top: number;
  bottom: number;
  left: number;
  right: number;
  safeArea: { x: number; y: number; width: number; height: number };
}
```

### SpeakerTrajectoryPoint
```typescript
interface SpeakerTrajectoryPoint {
  timestamp: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  isSpeaking?: boolean;
}
```

### VideoClip
```typescript
interface VideoClip {
  id: string;
  startTime: number;
  endTime: number;
  cropPosition: { x: number; y: number };
  speakerCenter: { x: number; y: number };
}
```

### EditProject
```typescript
interface EditProject {
  clips: VideoClip[];
  blackBars: BlackBarsDetection | null;
  trajectory: SpeakerTrajectoryPoint[];
  targetAspectRatio: string;
}
```

---

## License

This implementation is part of Video Crop Pro.
