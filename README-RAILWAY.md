# Server-Side Video Processing Setup

## Architecture

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Next.js (Vercel)│ ───▶ │ Railway Service  │ ───▶ │ Vercel Blob      │
│  Frontend        │      │  (FFmpeg)        │      │  Storage         │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```

## Deployment Steps

### 1. Setup Vercel Blob

```bash
npm install @vercel/blob
```

Add to `.env`:
```
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repo
4. Set root directory to `api-video-processor`
5. Deploy!

Railway will automatically:
- Install FFmpeg
- Install Python dependencies
- Start the FastAPI service

### 3. Get Railway Service URL

After deployment, Railway will give you a URL like:
```
https://your-service.railway.app
```

Add to your Next.js `.env`:
```
PROCESSOR_SERVICE_URL=https://your-service.railway.app
```

## Usage in page.tsx

```typescript
import { serverSideExport } from '@/lib/serverExport';

// Replace the export function
const handleExport = async () => {
  const blob = await serverSideExport(
    videoFile.file,
    currentClips,
    width,
    height,
    cropStrategy || 'smart-crop',
    (percent) => setExportProgress({ ...percent }),
    abortController.signal
  );
  downloadBlob(blob, filename);
};
```

## Benefits

| ✅ | 说明 |
|----|------|
| **快速** | 服务器 FFmpeg 比 WASM 快 5-10 倍 |
| **准确** | 成熟的 FFmpeg，音画同步完美 |
| **可扩展** | Railway 自动扩展，支持 1k+ DAU |
| **便宜** | Railway $5/月起，按量付费 |
| **简单** | 无需管理服务器 |

## Cost Estimate (1k DAU)

假设：
- 每个用户处理 1 个 1 分钟视频
- 平均 20MB 输入，15MB 输出

| 服务 | 月成本 |
|------|--------|
| Railway (处理) | ~$10-20 |
| Vercel Blob (存储) | ~$5-10 |
| **总计** | **~$15-30/月** |
