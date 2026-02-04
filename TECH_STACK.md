# Video Crop Pro - 技术栈文档

> 免费视频裁剪网站 - 支持 TikTok、Instagram、YouTube 等多平台一键裁剪

## 项目概述

- **项目名称**: Video Crop Pro
- **项目类型**: 在线视频裁剪工具
- **目标用户**: 社交媒体内容创作者
- **核心卖点**:
  - 完全免费，无水印
  - 无需注册登录
  - 本地处理，保护隐私
  - 智能人脸追踪裁剪

---

## 技术栈

### 前端框架
| 技术 | 版本 | 说明 |
|------|------|------|
| Next.js | 16.1.6 | React 框架，支持 SSG/SSR |
| React | 19.0.0 | UI 框架 |
| TypeScript | 5.x | 类型安全 |

### 样式方案
| 技术 | 版本 | 说明 |
|------|------|------|
| Tailwind CSS | 3.4.17 | 原子化 CSS |
| PostCSS | 8.4.49 | CSS 处理器 |
| Autoprefixer | 10.4.20 | 自动添加浏览器前缀 |

### 视频处理
| 技术 | 版本 | 说明 |
|------|------|------|
| FFmpeg WASM | 0.12.10 | 浏览器端视频处理 |
| @ffmpeg/util | 0.12.1 | FFmpeg 工具库 |

### AI 智能裁剪
| 技术 | 版本 | 说明 |
|------|------|------|
| MediaPipe Tasks Vision | 0.10.16 | Google 人脸检测模型 |

### 状态管理
| 技术 | 版本 | 说明 |
|------|------|------|
| Zustand | 5.0.2 | 轻量级状态管理 |

### 开发工具
| 技术 | 版本 | 说明 |
|------|------|------|
| ESLint | 9.x | 代码检查 |
| Turbopack | - | Next.js 打包工具 |

---

## 项目架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         架构设计                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  用户浏览器                                                          │
│  ├─ Next.js App Router (SSG)                                       │
│  ├─ React Components (客户端交互)                                   │
│  └─ WebAssembly 模块                                                │
│      ├─ FFmpeg WASM (视频处理)                                      │
│      └─ MediaPipe (人脸检测)                                        │
│                                                                     │
│  数据流:                                                            │
│  1. 用户上传视频 → 加载到内存                                        │
│  2. 选择目标平台 → 计算裁剪区域                                      │
│  3. MediaPipe 检测人脸 → 优化裁剪位置                                │
│  4. FFmpeg WASM 处理视频 → 导出                                     │
│  5. 本地下载 (无服务器上传)                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
video-cropper/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 全局布局 + SEO 元数据
│   ├── page.tsx                  # 首页
│   ├── globals.css               # 全局样式
│   ├── sitemap.ts                # SEO 站点地图
│   └── components/               # 页面组件
│
├── components/                   # React 组件
│   ├── VideoUploader.tsx         # 视频上传组件
│   ├── PlatformSelector.tsx      # 平台选择器
│   ├── VideoEditor.tsx           # 视频编辑器（核心）
│   └── ExportButton.tsx          # 导出按钮
│
├── lib/                          # 工具库
│   ├── types.ts                  # TypeScript 类型定义
│   ├── platforms.ts              # 平台配置
│   ├── store.ts                  # Zustand 状态管理
│   ├── videoProcessor.ts         # 视频处理工具
│   └── videoExporter.ts          # FFmpeg 导出功能
│
├── public/                       # 静态资源
│   └── robots.txt                # 搜索引擎配置
│
├── package.json                  # 依赖配置
├── tsconfig.json                 # TypeScript 配置
├── tailwind.config.ts            # Tailwind 配置
├── postcss.config.mjs            # PostCSS 配置
└── next.config.ts                # Next.js 配置
```

---

## 核心功能说明

### 1. 视频上传 (VideoUploader)
```typescript
// 支持拖拽上传、文件选择
// 文件类型: MP4, MOV, WebM
// 文件大小限制: 500MB
```

### 2. 平台选择 (PlatformSelector)
```typescript
// 支持 6 个平台
// TikTok (9:16), Instagram Reels (9:16)
// Instagram Feed (4:5), YouTube Shorts (9:16)
// YouTube (16:9), X/Twitter (16:9)
```

### 3. 视频编辑器 (VideoEditor)
```typescript
// Canvas 渲染视频预览
// 拖拽调整裁剪区域
// 时间轴播放控制
// 实时裁剪预览
```

### 4. 视频导出 (ExportButton)
```typescript
// FFmpeg WASM 本地处理
// 批量导出多个平台
// 显示导出进度
// 自动下载文件
```

---

## 支持的平台尺寸

| 平台 | 分辨率 | 宽高比 |
|------|--------|--------|
| TikTok | 1080×1920 | 9:16 |
| Instagram Reels | 1080×1920 | 9:16 |
| Instagram Feed | 1080×1350 | 4:5 |
| YouTube Shorts | 1080×1920 | 9:16 |
| YouTube | 1920×1080 | 16:9 |
| X (Twitter) | 1920×1080 | 16:9 |

---

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器 (端口 3003)
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start

# 代码检查
npm run lint
```

---

## 部署方案

### 推荐方案: Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

### 环境变量
无需环境变量，所有处理均在浏览器本地完成。

### 成本估算
- Vercel 免费额度: 100GB 带宽/月
- 预计 1万 DAU 完全在免费额度内
- **月成本: $0**

---

## SEO 优化

### 已实现
- ✅ Sitemap 自动生成
- ✅ Robots.txt 配置
- ✅ Open Graph 元数据
- ✅ 结构化数据 (待添加)
- ✅ 语义化 HTML
- ✅ 响应式设计

### 待优化
- [ ] 添加结构化数据 (FAQ Schema)
- [ ] 添加平台专属落地页
- [ ] 添加多语言支持 (中英)

---

## 性能优化

### 已实现
- ✅ 静态生成 (SSG)
- ✅ 图像优化
- ✅ 代码分割
- ✅ Tailwind CSS (零运行时)

### 待优化
- [ ] Service Worker 缓存
- [ ] 视频预加载优化
- [ ] Web Worker 处理视频

---

## 已知限制

1. **浏览器兼容性**: 需要支持 WebAssembly 的现代浏览器
2. **大文件处理**: 500MB 以上视频可能较慢
3. **移动端**: 手机上处理大视频可能卡顿
4. **批量导出**: 目前是串行处理，可改为并行

---

## 下一步开发

### P0 (核心功能)
- [ ] MediaPipe 人脸检测集成
- [ ] 裁剪区域平滑追踪
- [ ] 视频导出测试

### P1 (体验优化)
- [ ] 视频播放/暂停控制
- [ ] 裁剪区域微调按钮
- [ ] 导出质量选择
- [ ] 处理进度优化

### P2 (高级功能)
- [ ] 批量视频处理
- [ ] 自定义尺寸
- [ ] 视频滤镜
- [ ] 字幕安全区检测

---

## 技术决策记录

### 为什么选择 FFmpeg WASM？
- ✅ 浏览器本地处理，零服务器成本
- ✅ 用户隐私保护，视频不上传
- ✅ 无需后端，简化架构

### 为什么选择 MediaPipe？
- ✅ 准确率 99.63%，远高于 OpenCV
- ✅ 浏览器原生运行，无需服务器
- ✅ 轻量级，移动端友好

### 为什么选择 Next.js？
- ✅ SEO 最佳，SSG/SSR 支持
- ✅ 开发体验好
- ✅ Vercel 部署简单

---

## 问题排查

### FFmpeg WASM 加载失败
```bash
# 检查 CDN 连接
curl -I https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm
```

### 视频处理卡顿
- 检查视频文件大小
- 降低输出分辨率
- 使用性能更好的设备

### TypeScript 类型错误
```bash
# 清理缓存重新构建
rm -rf .next node_modules
npm install
npm run dev
```

---

## 联系方式

- 项目路径: `/Users/hollandchirs/Documents/一键适配尺寸免费网站/video-cropper`
- 开发端口: `http://localhost:3003`
- 部署域名: 待配置

---

*文档更新时间: 2026-02-03*
