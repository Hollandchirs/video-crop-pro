import { CropRegion, CropStrategy, VideoClip } from "./types";

/**
 * Simple toBlobURL implementation using fetch
 */
async function toBlobURL(url: string, _type: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// Cache FFmpeg class after loading
let FFmpegClass: any = null;
let ffmpegLoadPromise: Promise<any> | null = null;

/**
 * Load FFmpeg from CDN - only loads once
 * Using jsDelivr which has better CORS support for workers
 */
async function getFFmpeg(): Promise<any> {
  if (FFmpegClass) return FFmpegClass;

  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  ffmpegLoadPromise = (async () => {
    try {
      // Use jsdelivr CDN - better CORS support for workers
      // @ts-ignore - importing from URL
      const ffmpegModule = await import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js");
      FFmpegClass = ffmpegModule.FFmpeg;
      return FFmpegClass;
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      throw new Error("Failed to load FFmpeg. Please refresh and try again.");
    }
  })();

  return ffmpegLoadPromise;
}

/**
 * Get CDN base URL - using jsdelivr for better CORS support
 */
function getCDNBase(): string {
  return "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
}

/**
 * Create inline worker blob URL with all dependencies
 * This avoids CORS issues by bundling everything inline
 */
async function getInlineWorkerURL(): Promise<string> {
  // Fetch all necessary files for the worker
  const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm";

  // Fetch worker dependencies
  const [workerCode, constCode, errorsCode, utilCode] = await Promise.all([
    fetch(`${baseURL}/worker.js`).then(r => r.text()),
    fetch(`${baseURL}/const.js`).then(r => r.text()),
    fetch(`${baseURL}/errors.js`).then(r => r.text()),
    fetch(`${baseURL}/util.js`).then(r => r.text()),
  ]);

  // Create a blob that exports all the modules
  const inlineCode = `
    // Const module
    ${constCode.replace(/export\s+const/g, 'const').replace(/export\s*\{/g, 'const {')};

    // Errors module
    ${errorsCode.replace(/export\s+const/g, 'const').replace(/export\s*\{/g, 'const {')};

    // Util module
    ${utilCode.replace(/export\s+const/g, 'const').replace(/export\s*\{/g, 'const {')};

    // Worker code (modified to use local variables)
    ${workerCode
      .replace(/import\s+.*from\s+["']\.\/const\.js["'];/g, '')
      .replace(/import\s+.*from\s+["']\.\/errors\.js["'];/g, '')
      .replace(/import\s+.*from\s+["']@ffmpeg\/util["'];/g, '')
    };
  `;

  const blob = new Blob([inlineCode], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

/**
 * Export video with crop region (crop strategy)
 * Preserves original video quality
 */
export async function exportVideo(
  videoFile: File,
  cropRegion: CropRegion,
  outputWidth: number,
  outputHeight: number,
  strategy: CropStrategy = "smart-crop",
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const FFmpeg = await getFFmpeg();

  // Create a new FFmpeg instance each time
  const ffmpeg = new FFmpeg();

  // Load FFmpeg core files
  const coreURL = await toBlobURL(`${getCDNBase()}/ffmpeg-core.js`, "text/javascript");
  const wasmURL = await toBlobURL(`${getCDNBase()}/ffmpeg-core.wasm`, "application/wasm");

  // Use inline worker to avoid CORS issues
  await ffmpeg.load({
    coreURL,
    wasmURL,
    workerURL: await getInlineWorkerURL(),
  });

  // Write input file - read as Uint8Array to avoid blob URL issues
  const inputData = await readFileAsUint8Array(videoFile);
  await ffmpeg.writeFile("input.mp4", inputData);

  let command: string[];

  if (strategy === "center-crop") {
    // Center crop: scale to fit within output size, pad with black bars
    command = [
      "-i",
      "input.mp4",
      "-vf",
      `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18", // High quality (18 is near lossless, lower is better, 18-28 is typical range)
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      "output.mp4",
    ];
  } else {
    // Smart crop: crop from specified region and scale to output size
    command = [
      "-i",
      "input.mp4",
      "-vf",
      `crop=${Math.round(cropRegion.width)}:${Math.round(cropRegion.height)}:${Math.round(cropRegion.x)}:${Math.round(cropRegion.y)},scale=${outputWidth}:${outputHeight}`,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18", // High quality
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      "output.mp4",
    ];
  }

  // Set up progress callback
  if (onProgress) {
    ffmpeg.on("progress", ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });
  }

  // Execute command
  await ffmpeg.exec(command);

  // Read output file
  const data = await ffmpeg.readFile("output.mp4");

  // Clean up
  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("output.mp4");

  // Create blob (FFmpeg returns Uint8Array, need type assertion for strict TS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([data as any], { type: "video/mp4" });
  return blob;
}

/**
 * Export video for multiple platforms
 */
export async function exportForMultiplePlatforms(
  videoFile: File,
  crops: Array<{ crop: CropRegion; width: number; height: number; platformId: string }>,
  strategy: CropStrategy = "smart-crop",
  onProgress?: (current: number, total: number, platformId: string, percent: number) => void
): Promise<Array<{ platformId: string; blob: Blob }>> {
  const results: Array<{ platformId: string; blob: Blob }> = [];

  for (let i = 0; i < crops.length; i++) {
    const { crop, width, height, platformId } = crops[i];

    const blob = await exportVideo(
      videoFile,
      crop,
      width,
      height,
      strategy,
      (percent) => {
        if (onProgress) {
          onProgress(i + 1, crops.length, platformId, percent);
        }
      }
    );
    results.push({ platformId, blob });
  }

  return results;
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download multiple files as ZIP (using JSZip if available, otherwise individual downloads)
 */
export async function downloadMultipleFiles(
  files: Array<{ blob: Blob; filename: string }>
) {
  // For now, just trigger individual downloads
  // TODO: Add JSZip for proper ZIP file creation
  for (let i = 0; i < files.length; i++) {
    setTimeout(() => {
      downloadBlob(files[i].blob, files[i].filename);
    }, i * 500); // Stagger downloads
  }
}

/**
 * Export video with smart clips
 * Each clip has its own crop position applied to its time segment
 * Preserves original video quality
 * @param videoFile Input video file
 * @param clips Array of video clips with different crop positions
 * @param outputWidth Output width
 * @param outputHeight Output height
 * @param strategy Crop strategy (smart-crop or center-crop)
 * @param onProgress Progress callback (0-100)
 * @returns Blob of the processed video
 */
export async function exportVideoWithClips(
  videoFile: File,
  clips: VideoClip[],
  outputWidth: number,
  outputHeight: number,
  strategy: CropStrategy = "smart-crop",
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const FFmpeg = await getFFmpeg();

  // Create a new FFmpeg instance each time
  const ffmpeg = new FFmpeg();

  // Load FFmpeg core files
  const coreURL = await toBlobURL(`${getCDNBase()}/ffmpeg-core.js`, "text/javascript");
  const wasmURL = await toBlobURL(`${getCDNBase()}/ffmpeg-core.wasm`, "application/wasm");

  // Use inline worker to avoid CORS issues
  await ffmpeg.load({
    coreURL,
    wasmURL,
    workerURL: await getInlineWorkerURL(),
  });

  // Write input file - read as Uint8Array to avoid blob URL issues
  const inputData = await readFileAsUint8Array(videoFile);
  await ffmpeg.writeFile("input.mp4", inputData);

  let command: string[];

  if (clips.length === 1) {
    // Single clip - use simple export
    const clip = clips[0];
    const cropX = Math.round(clip.cropPosition.x);
    const cropY = Math.round(clip.cropPosition.y);

    if (strategy === "center-crop") {
      command = [
        "-i",
        "input.mp4",
        "-vf",
        `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "18", // High quality (18 is near lossless, lower is better, 18-28 is typical range)
        "-pix_fmt",
        "yuv420p",
        "-map",
        "0:v",
        "-map",
        "0:a?",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "output.mp4",
      ];
    } else {
      // Smart crop: crop outputWidth x outputHeight from cropPosition
      command = [
        "-i",
        "input.mp4",
        "-vf",
        `crop=${outputWidth}:${outputHeight}:${cropX}:${cropY}`,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "18", // High quality
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "output.mp4",
      ];
    }
  } else {
    // Multiple clips - generate segment filter
    const filterComplex = generateSegmentFilter(clips, outputWidth, outputHeight, strategy);

    command = [
      "-i",
      "input.mp4",
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18", // High quality
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      "output.mp4",
    ];
  }

  // Set up progress callback
  if (onProgress) {
    ffmpeg.on("progress", ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });
  }

  // Execute command
  await ffmpeg.exec(command);

  // Read output file
  const data = await ffmpeg.readFile("output.mp4");

  // Clean up
  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("output.mp4");

  // Create blob
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([data as any], { type: "video/mp4" });
  return blob;
}

/**
 * Generate FFmpeg filter complex for segment-based cropping
 * Each segment is trimmed and cropped separately, then concatenated
 */
function generateSegmentFilter(
  clips: VideoClip[],
  outputWidth: number,
  outputHeight: number,
  strategy: CropStrategy
): string {
  const numClips = clips.length;

  // Limit number of clips to avoid overwhelming FFmpeg
  const maxClips = 20;
  const effectiveClips = clips.slice(0, maxClips);

  let filter = "";

  if (strategy === "center-crop") {
    for (let i = 0; i < effectiveClips.length; i++) {
      const clip = effectiveClips[i];

      filter += `[0:v]trim=${clip.startTime}:${clip.endTime},setpts=PTS-STARTPTS,`;
      filter += `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,`;
      filter += `pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2[v${i}];`;
    }
  } else {
    // For smart crop, trim and crop each segment
    for (let i = 0; i < effectiveClips.length; i++) {
      const clip = effectiveClips[i];

      // Trim segment to clip duration
      filter += `[0:v]trim=${clip.startTime}:${clip.endTime},setpts=PTS-STARTPTS,`;

      // Crop to clip position (crop outputWidth x outputHeight from cropPosition)
      const cropX = Math.round(clip.cropPosition.x);
      const cropY = Math.round(clip.cropPosition.y);
      filter += `crop=${outputWidth}:${outputHeight}:${cropX}:${cropY}[v${i}];`;
    }
  }

  // Concatenate all segments
  const segmentList = effectiveClips.map((_, i) => `[v${i}]`).join("");
  filter += `${segmentList}concat=n=${effectiveClips.length}:v=1[out]`;

  return filter;
}

/**
 * Read file as Uint8Array for FFmpeg
 * This avoids issues with blob URLs and fetchFile
 */
async function readFileAsUint8Array(file: File | Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
