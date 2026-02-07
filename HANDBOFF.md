# 视频导出服务 - 交接文档

> **项目**: Video Crop Pro - 服务器端视频处理方案
> **日期**: 2025-02-07
> **状态**: 部署中

---

## 📋 目录

1. [架构概述](#架构概述)
2. [文件结构](#文件结构)
3. [部署步骤](#部署步骤)
4. [配置说明](#配置说明)
5. [API 接口](#api-接口)
6. [故障排查](#故障排查)
7. [成本估算](#成本估算)

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│                   (Next.js Frontend)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ 1. 上传视频
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Blob Storage                       │
│                   (临时存储视频文件)                          │
└────────────────────────┬────────────────────────────────────┘
                         │ 2. 发送处理任务
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Railway 处理服务                            │
│              (FastAPI + FFmpeg)                             │
│          • 裁剪视频                                          │
│          • 调整时间轴                                        │
│          • 合并音画                                          │
└────────────────────────┬────────────────────────────────────┘
                         │ 3. 返回处理后的视频
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     用户下载                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 文件结构

```
free-video-sizer--main/
├── api-video-processor/          # Railway 处理服务
│   ├── main.py                   # FastAPI 应用入口
│   ├── Dockerfile                # Docker 配置（含 FFmpeg）
│   ├── requirements.txt          # Python 依赖
│   └── railway.toml              # Railway 部署配置
├── lib/
│   └── serverExport.ts           # 前端调用逻辑
├── app/
│   └── page.tsx                  # 使用服务器端导出
└── .env.example                  # 环境变量模板
```

---

## 部署步骤

### 步骤 1: 部署 Railway 处理服务

1. 访问 [railway.app](https://railway.app)
2. 登录后点击 **New Project**
3. 选择 **Deploy from GitHub**
4. 选择你的仓库
5. **重要**: 设置 **Root Directory** 为 `api-video-processor`
6. 点击 **Deploy**
7. 等待构建完成（首次约 3-5 分钟）

### 步骤 2: 获取 Railway 服务 URL

1. 部署完成后，在 Railway 项目中点击进入 **api-video-processor** 服务
2. 点击 **Settings** 标签
3. 找到 **Networking** 或 **Public Networking**
4. 点击 **Generate Public URL** 启用公开访问
5. 复制生成的 URL，例如：
   ```
   https://video-processor-xxx.up.railway.app
   ```

### 步骤 3: 配置 Vercel Blob

1. 访问 [Vercel Blob](https://vercel.com/blob)
2. 创建 Blob 存储账户
3. 生成 **Read/Write Token**
4. 复制 Token

### 步骤 4: 配置环境变量

在项目的 `.env.local` 文件中添加：

```env
# Vercel Blob Token
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxxxxxxxxxx

# Railway 处理服务 URL
PROCESSOR_SERVICE_URL=https://video-processor-xxx.up.railway.app
```

### 步骤 5: 验证部署

```bash
# 验证 Railway 服务健康状态
curl https://video-processor-xxx.up.railway.app/health

# 应返回: {"status":"ok","service":"video-processor"}
```

---

## 配置说明

### 环境变量

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 读写权限 | [Vercel Dashboard](https://vercel.com/blob) |
| `PROCESSOR_SERVICE_URL` | Railway 处理服务 URL | Railway 部署后获得 |

### Railway 配置 (api-video-processor/railway.toml)

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port 3001"
healthcheckPath = "/health"
```

---

## API 接口

### 1. 提交导出任务

```http
POST /export
Content-Type: application/json

{
  "videoUrl": "https://blob-url...",
  "clips": [
    {
      "startTime": 0.0,
      "endTime": 30.0,
      "cropPosition": { "x": 100, "y": 50 }
    }
  ],
  "width": 1080,
  "height": 1920,
  "strategy": "smart-crop"
}
```

**响应**:
```json
{
  "jobId": "uuid-xxxx-xxxx"
}
```

### 2. 查询任务状态

```http
GET /status/{jobId}
```

**响应**:
```json
{
  "jobId": "uuid-xxxx-xxxx",
  "status": "processing",  // pending | processing | completed | failed
  "progress": 45,
  "outputUrl": "...",      // 仅 status=completed 时
  "error": "..."           // 仅 status=failed 时
}
```

### 3. 健康检查

```http
GET /health
```

**响应**:
```json
{
  "status": "ok",
  "service": "video-processor"
}
```

---

## 前端使用

在 `app/page.tsx` 中：

```typescript
import { serverSideExport } from '@/lib/serverExport';

const blob = await serverSideExport(
  videoFile,           // File
  clips,               // VideoClip[]
  width,               // 输出宽度
  height,              // 输出高度
  'smart-crop',        // 策略
  (percent) => {},     // 进度回调
  abortSignal,         // 中止信号
  { width, height }    // 源裁剪区域
);
```

---

## 故障排查

### 问题 1: Railway 服务 404

**原因**: Root Directory 未正确设置

**解决**: 在 Railway 项目设置中，将 Root Directory 改为 `api-video-processor`

### 问题 2: FFmpeg 未找到

**原因**: Dockerfile 未正确安装 FFmpeg

**解决**: 确认 Dockerfile 包含：
```dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

### 问题 3: 处理超时

**原因**: Railway 免费版有执行时间限制

**解决**: 升级到付费计划或优化 FFmpeg 参数（使用 `-preset ultrafast`）

### 问题 4: 音画不同步

**原因**: FFmpeg filter 未正确调整时间戳

**解决**: 确认 filter 中包含 `setpts=PTS-STARTPTS` 和 `asetpts=PTS-STARTPTS`

---

## 成本估算

### Railway (处理服务)

| 计划 | 价格 | 限制 |
|------|------|------|
| Free | $0/月 | $5 免费额度，512MB RAM |
| Basic | $5/月 | 更高限制 |

### Vercel Blob (存储)

| 使用量 | 价格 |
|--------|------|
| 存储 | $0.15/GB/月 |
| 下载 | $0.36/GB |

### 月成本估算 (1k DAU)

假设：
- 每用户处理 1 个 1 分钟视频
- 平均 20MB 输入，15MB 输出

```
Railway:        ~$10-20/月
Vercel Blob:    ~$5-10/月
───────────────────────
总计:          ~$15-30/月
```

---

## 后续优化建议

1. **添加 Redis**: 存储任务状态，支持重启恢复
2. **添加队列**: 使用 Celery + Redis 处理任务队列
3. **CDN 加速**: 为输出视频添加 CDN
4. **错误重试**: 添加失败任务自动重试机制
5. **监控告警**: 添加 Sentry 错误监控

---

## 联系方式

如有问题，请联系开发团队。
