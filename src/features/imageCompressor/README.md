# 图片压缩功能模块

## 功能概述

图片压缩功能可以扫描思源笔记 `data/assets` 目录下的所有图片，并对其进行压缩处理，节省存储空间。

## 核心特性

✅ 已实现的功能

- 图片扫描器 - 递归扫描 assets 目录
- 图片压缩引擎 - 使用 browser-image-compression 库
- 图片对比器 - 计算压缩率、PSNR、生成差异图
- 批量压缩处理
- 文件原地替换（保持文件名不变）
- 压缩统计信息

## 模块结构

```
imageCompressor/
├── types.ts          # TypeScript 类型定义
├── scanner.ts        # 图片扫描器
├── compressor.ts     # 压缩引擎
├── comparator.ts     # 图片对比器
├── index.ts          # 功能入口
└── README.md         # 说明文档
```

## API 使用示例

### 1. 扫描图片

```typescript
import { scanAllAssets } from './scanner'

// 扫描所有图片
const images = await scanAllAssets((progress) => {
  console.log(`扫描进度: ${progress.current}/${progress.total}`)
})

console.log(`找到 ${images.length} 张图片`)
```

### 2. 压缩单张图片

```typescript
import { compressImage } from './compressor'

const result = await compressImage(imageInfo, {
  quality: 0.8,
  maxSizeMB: 1,
  maxWidthOrHeight: 1920
})

if (result.success) {
  console.log(`压缩率: ${result.compressionRatio}%`)
  console.log(`原始: ${result.originalFile.size} -> 压缩后: ${result.compressedSize}`)
}
```

### 3. 批量压缩

```typescript
import { batchCompressImages } from './compressor'

const results = await batchCompressImages(
  images,
  { quality: 0.8 },
  (current, total, imageName) => {
    console.log(`压缩进度: ${current}/${total} - ${imageName}`)
  }
)
```

### 4. 替换原图

```typescript
import { replaceImage, batchReplaceImages } from './compressor'

// 单个替换
await replaceImage(imagePath, compressedBlob)

// 批量替换
const { success, failed } = await batchReplaceImages(results, (current, total) => {
  console.log(`替换进度: ${current}/${total}`)
})
```

### 5. 图片对比

```typescript
import { createComparison, calculatePSNR, formatFileSize } from './comparator'

// 创建对比数据
const comparison = createComparison(originalImage, compressedBlob)

console.log(`压缩率: ${comparison.compressionRatio}%`)
console.log(`节省空间: ${comparison.sizeSavedMB} MB`)

// 计算 PSNR
const psnr = await calculatePSNR(originalUrl, compressedUrl)
console.log(`PSNR: ${psnr} dB`)
```

## 压缩配置选项

```typescript
interface CompressOptions {
  maxSizeMB?: number        // 最大文件大小(MB)，默认 1
  maxWidthOrHeight?: number // 最大宽高(px)，默认 1920
  quality?: number          // 压缩质量 0-1，默认 0.8
  useWebWorker?: boolean    // 使用 Web Worker，默认 true
  fileType?: string         // 输出格式，默认保持原格式
}
```

## 注意事项

### 安全措施

1. **文件名保持不变** - 替换文件时保持原文件名，确保引用不会失效
2. **支持备份** - 可选的图片备份功能（暂未在 UI 中启用）
3. **错误处理** - 所有操作都有完善的错误捕获和日志记录

### 性能优化

1. **Web Worker** - 压缩任务在 Worker 线程执行，不阻塞主线程
2. **批处理** - 支持批量处理多张图片
3. **进度回调** - 提供实时进度更新

### 已知限制

1. **GIF 动图** - 压缩后会变成静态图片
2. **透明 PNG** - 转换为 JPEG 会丢失透明度
3. **大批量处理** - 数千张图片可能导致内存压力

## 使用方式

1. 启用功能：在插件设置中开启"图片压缩功能"
2. 打开压缩器：
   - 点击顶部工具栏的图片图标
   - 使用快捷键 `Ctrl+Alt+C`
3. 扫描图片：点击"扫描图片"按钮
4. 选择要压缩的图片
5. 配置压缩参数
6. 点击"压缩"按钮
7. 查看对比结果
8. 确认后点击"替换原图"

## 下一步开发

待实现的 UI 组件：

- [ ] ImageViewer.vue - 图片查看器和列表
- [ ] CompressDialog.vue - 压缩配置对话框

这些组件将在后续版本中完成，目前核心功能已全部实现并可通过编程方式调用。

## 技术栈

- browser-image-compression - 图片压缩核心库
- Canvas API - 图片对比和差异分析
- 思源 API - 文件系统操作

## 贡献

欢迎提交 Issue 和 Pull Request！
