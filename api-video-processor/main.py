"""
Video Processing Service for Railway
FastAPI + FFmpeg for server-side video processing

Deploy: Railway (or Render, Fly.io)
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import uuid
import os
import asyncio
import subprocess
import tempfile
import aiohttp
from pathlib import Path

# ============================================================
# MODELS
# ============================================================

class CropPosition(BaseModel):
    x: float
    y: float

class VideoClip(BaseModel):
    startTime: float
    endTime: float
    cropPosition: CropPosition
    cropScale: Optional[float] = 1.0
    useFullFrame: Optional[bool] = False

class ExportRequest(BaseModel):
    videoUrl: str
    clips: List[VideoClip]
    width: int
    height: int
    strategy: str = "smart-crop"
    sourceRegion: Optional[dict] = None

class JobStatus(BaseModel):
    jobId: str
    status: str  # pending, processing, completed, failed
    progress: float
    outputUrl: Optional[str] = None
    error: Optional[str] = None

# ============================================================
# APP & STATE
# ============================================================

app = FastAPI(title="Video Processing Service")

# In-memory job storage (use Redis for production)
jobs = {}

# Temp directory for processing
TEMP_DIR = Path("/tmp/video-processor")
TEMP_DIR.mkdir(exist_ok=True)

# ============================================================
# HELPER FUNCTIONS
# ============================================================

async def download_video(url: str, dest_path: Path) -> None:
    """Download video from URL to local file"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status != 200:
                raise HTTPException(status_code=400, detail=f"Failed to download video: {url}")
            with open(dest_path, 'wb') as f:
                f.write(await response.read())

def build_ffmpeg_command(
    input_path: str,
    output_path: str,
    clips: List[VideoClip],
    width: int,
    height: int,
    strategy: str,
    source_region: Optional[dict]
) -> List[str]:
    """Build FFmpeg command for video processing"""
    cmd = ["-i", input_path]

    src_crop_width = source_region.get('width', width) if source_region else width
    src_crop_height = source_region.get('height', height) if source_region else height

    filter_complex = ""
    map_args = []

    if len(clips) == 1:
        # Single clip
        clip = clips[0]
        crop_x = int(round(clip.cropPosition.x))
        crop_y = int(round(clip.cropPosition.y))

        if strategy == "center-crop":
            filter_complex = (
                f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
                f"trim={clip.startTime}:{clip.endTime},setpts=PTS-STARTPTS[vout];"
                f"[0:a]atrim={clip.startTime}:{clip.endTime},asetpts=PTS-STARTPTS[aout]"
            )
        else:
            if src_crop_width != width or src_crop_height != height:
                filter_complex = (
                    f"[0:v]crop={src_crop_width}:{src_crop_height}:{crop_x}:{crop_y},"
                    f"scale={width}:{height},"
                    f"trim={clip.startTime}:{clip.endTime},setpts=PTS-STARTPTS[vout];"
                    f"[0:a]atrim={clip.startTime}:{clip.endTime},asetpts=PTS-STARTPTS[aout]"
                )
            else:
                filter_complex = (
                    f"[0:v]crop={width}:{height}:{crop_x}:{crop_y},"
                    f"trim={clip.startTime}:{clip.endTime},setpts=PTS-STARTPTS[vout];"
                    f"[0:a]atrim={clip.startTime}:{clip.endTime},asetpts=PTS-STARTPTS[aout]"
                )

        cmd.extend(["-filter_complex", filter_complex])
        cmd.extend(["-map", "[vout]", "-map", "[aout]"])
    else:
        # Multiple clips - concat
        for i, clip in enumerate(clips):
            crop_x = int(round(clip.cropPosition.x))
            crop_y = int(round(clip.cropPosition.y))

            if strategy == "center-crop":
                filter_complex += (
                    f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
                    f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
                    f"trim={clip.startTime}:{clip.endTime},setpts=PTS-STARTPTS[v{i}];"
                )
            else:
                if src_crop_width != width or src_crop_height != height:
                    filter_complex += (
                        f"[0:v]crop={src_crop_width}:{src_crop_height}:{crop_x}:{crop_y},"
                        f"scale={width}:{height},"
                        f"trim={clip.startTime}:{clip.endTime},setpts=PTS-STARTPTS[v{i}];"
                    )
                else:
                    filter_complex += (
                        f"[0:v]crop={width}:{height}:{crop_x}:{crop_y},"
                        f"trim={clip.startTime}:{clip.endTime},setpts=PTS-STARTPTS[v{i}];"
                    )

            filter_complex += f"[0:a]atrim={clip.startTime}:{clip.endTime},asetpts=PTS-STARTPTS[a{i}];"

        # Concat
        video_inputs = "".join([f"[v{i}]" for i in range(len(clips))])
        audio_inputs = "".join([f"[a{i}]" for i in range(len(clips))])
        filter_complex += f"{video_inputs}concat=n={len(clips)}:v=1:a=0[vout];"
        filter_complex += f"{audio_inputs}concat=n={len(clips)}:v=0:a=1[aout]"

        cmd.extend(["-filter_complex", filter_complex])
        cmd.extend(["-map", "[vout]", "-map", "[aout]"])

    # Encoding settings for speed
    cmd.extend([
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-tune", "zerolatency",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        output_path
    ])

    return ["ffmpeg", "-y"] + cmd

async def process_video_job(job_id: str, request: ExportRequest) -> None:
    """Process video in background"""
    try:
        jobs[job_id].status = "processing"
        jobs[job_id].progress = 10

        # Create temp directory for this job
        job_dir = TEMP_DIR / job_id
        job_dir.mkdir(exist_ok=True)

        input_path = job_dir / "input.mp4"
        output_path = job_dir / "output.mp4"

        # Download video
        await download_video(request.videoUrl, input_path)
        jobs[job_id].progress = 30

        # Build and run FFmpeg command
        cmd = build_ffmpeg_command(
            str(input_path),
            str(output_path),
            request.clips,
            request.width,
            request.height,
            request.strategy,
            request.sourceRegion
        )

        print(f"[{job_id}] Running FFmpeg: {' '.join(cmd)}")

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        await process.communicate()

        if process.returncode != 0:
            raise Exception(f"FFmpeg failed with code {process.returncode}")

        jobs[job_id].progress = 90

        # Upload to Vercel Blob (or return file content)
        # For simplicity, we'll return the file content directly
        # In production, you'd upload to blob storage

        with open(output_path, 'rb') as f:
            output_data = f.read()

        # Store output data (in production, this would be a blob URL)
        jobs[job_id].outputData = output_data
        jobs[job_id].status = "completed"
        jobs[job_id].progress = 100

        # Cleanup
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)

    except Exception as e:
        print(f"[{job_id}] Error: {e}")
        jobs[job_id].status = "failed"
        jobs[job_id].error = str(e)

# ============================================================
# API ROUTES
# ============================================================

@app.post("/export")
async def create_export_job(request: ExportRequest, background_tasks: BackgroundTasks):
    """Create a new video export job"""
    job_id = str(uuid.uuid4())

    jobs[job_id] = JobStatus(
        jobId=job_id,
        status="pending",
        progress=0
    )

    # Process in background
    background_tasks.add_task(process_video_job, job_id, request)

    return {"jobId": job_id}

@app.get("/status/{job_id}")
async def get_job_status(job_id: str):
    """Get job status"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    # Return output data if completed (simplified)
    response = {
        "jobId": job.jobId,
        "status": job.status,
        "progress": job.progress,
        "error": job.error
    }

    if job.status == "completed" and hasattr(job, 'outputData'):
        # In production, return a blob URL instead
        import base64
        response["outputData"] = base64.b64encode(job.outputData).decode()

    return response

@app.get("/download/{job_id}")
async def download_result(job_id: str):
    """Download processed video"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if job.status != "completed" or not hasattr(job, 'outputData'):
        raise HTTPException(status_code=400, detail="Job not completed")

    from fastapi.responses import Response
    return Response(
        content=job.outputData,
        media_type="video/mp4",
        headers={"Content-Disposition": "attachment; filename=output.mp4"}
    )

@app.get("/health")
async def health():
    """Health check"""
    return {"status": "ok", "service": "video-processor"}

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
