---
name: s3backup-node-http-request
overview: 将 s3Client.ts 的 request() 方法从浏览器 fetch() 改为 Node.js http/https 模块，绕过思源 HTTPS 界面的 Mixed Content 限制。保持所有调用方零改动，通过返回类 Response 对象实现接口兼容。
todos:
  - id: rewrite-request-method
    content: 重写 s3Client.ts request() 方法：新增 requireHttp() + NodeResponse 接口，用 Node http/https 替代 fetch()
    status: completed
  - id: update-vite-external
    content: vite.config.ts external 数组追加 node:http 和 node:https
    status: completed
  - id: verify-build
    content: 运行 lint + tsc 验证零新增错误
    status: completed
    dependencies:
      - rewrite-request-method
      - update-vite-external
---

## 问题诊断

思源笔记界面运行在 HTTPS（`https://127.0.0.1:60039`），S3 服务器配置 `useSSL=false` 导致请求 URL 为 HTTP。浏览器安全策略禁止 HTTPS 页面通过 `fetch()` 发起 HTTP 请求（Mixed Content），所有 S3 请求被拦截。

## 产品概述

将 S3Client 的网络请求层从浏览器 `fetch()` 改为 Node.js `http`/`https` 模块，绕过浏览器的 Mixed Content 限制，使 HTTP 和 HTTPS 的 S3 服务器都能正常访问。

## 核心功能

- S3Client 的 `request()` 方法改用 Node.js `http`/`https` 模块发请求
- 返回兼容 `Response` 接口的对象，所有调用方零改动
- 支持 HTTP 和 HTTPS（含自签名证书）
- 请求超时保护（30 秒）
- Vite 构建外部化 `node:http`/`node:https`

## Tech Stack

- 语言：TypeScript
- 运行环境：Electron（思源笔记桌面端）
- 网络模块：Node.js 内置 `http` / `https`
- 构建工具：Vite（library 模式，CJS 输出）

## Implementation Approach

### 策略

用 Node.js `http`/`https` 模块替换 `s3Client.ts` 中 `request()` 方法内的 `fetch()` 调用。定义一个 `NodeResponse` 接口模拟浏览器 `Response` 的 `.ok`/`.status`/`.text()`/`.arrayBuffer()` 四个成员，使所有调用方（`tryHeadBucket`/`tryListObjects`/`upload`/`uploadBuffer`/`download`/`list`/`delete`）零改动。

### 关键决策

1. **`requireHttp()` 放在 s3Client.ts 内部**：与已有的 `requireCrypto()`/`requireFsPath()` 风格一致，不修改 `nodeModules.ts`（http/https 仅 S3Client 使用）。
2. **`NodeResponse` 接口结构兼容**：调用方全部使用鸭子类型访问 `.ok`/`.status`/`.text()`/`.arrayBuffer()`，定义等价接口即可零改动。
3. **HTTPS 自签名证书**：S3 兼容服务（MinIO/Ceph/OpenList）常用自签名证书，`rejectUnauthorized: false` 保证实用性。不新增 S3Config 字段，避免触发 8 步注册清单。
4. **30 秒超时**：`req.setTimeout(30000)` + `req.destroy()` 防止大文件上传挂起。
5. **Vite 外部化补充**：`node:http`/`node:https` 加入 `external` 数组，避免打包进 bundle。

### 性能与可靠性

- Node.js `http`/`https` 是流式模块，但此处用 `Buffer.concat()` 收集完整响应体，适合 S3 API 的中小响应。大文件上传通过 `req.write(buffer)` 一次性写入。
- 超时机制防止网络异常时 Promise 永久挂起。
- 错误信息保持与原 `fetch` 版本一致（`S3 请求失败: ${err.message}`），调用方的 catch 逻辑无需调整。

## Implementation Notes

- **签名逻辑零改动**：`signRequest()` 函数和 header 构建逻辑不变，只是请求传输层从 fetch 换成 Node http/https。
- **`buildUrl()` 的 protocol 选择保留**：仍然根据 `useSSL` 决定 `http`/`https`，但 Node 模块不再受浏览器 Mixed Content 限制，HTTP 请求可以正常发出。
- **Buffer 转换**：原代码 `new Uint8Array(body.buffer, body.byteOffset, body.byteLength)` 转换不再需要，Node http 直接接受 Buffer 写入。
- **Vite external 数组**（`vite.config.ts:154`）：当前为 `["siyuan", "process", "node:fs", "node:path", "node:child_process", "node:os"]`，需追加 `"node:http"`, `"node:https"`。

## Architecture Design

改动范围极小，仅触及 2 个文件，不涉及架构变更：

```
s3Client.ts 内部改动:
  requireHttp()  ← 新增工具函数
  NodeResponse   ← 新增接口
  request()      ← 重写实现（fetch → Node http/https）
  其余 7 个公开方法 → 零改动（通过 NodeResponse 鸭子类型兼容）
```

## Directory Structure

```
src/features/s3Backup/types/
└── s3Client.ts    # [MODIFY] 新增 requireHttp() + NodeResponse 接口；重写 request() 方法用 Node http/https 替代 fetch()

vite.config.ts     # [MODIFY] external 数组追加 "node:http"、"node:https"
```

## Key Code Structures

```typescript
/** Node http/https 响应的兼容接口（模拟浏览器 Response） */
interface NodeResponse {
  ok: boolean
  status: number
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

/** 获取 Node.js http/https 模块 */
function requireHttp(): { http: any; https: any } {
  const http = require("node:http")
  const https = require("node:https")
  return { http, https }
}
```