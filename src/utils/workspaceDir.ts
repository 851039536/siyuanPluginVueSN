/**
 * 读取思源工作区根目录（纯浏览器 API，不触碰 `@/api`，可在纯 Node 单测中加载）。
 *
 * 优先读渲染进程已加载的内核配置（无网络往返）；未就绪时退回 `/api/system/getConf`。
 * 两者都失败返回空串，由调用方的重试逻辑兜底。
 *
 * ⚠️ 模块纯度：这里**不 import `@/api`**。`api.ts` 顶层对 `siyuan` 做值导入，
 * 会把运行时依赖钉进本模块的模块图，使本模块无法在纯 Node 环境（单元测试）中加载。
 * （原位于 `utils/sqliteDb.ts`，因 skills 管理等消费方需要而抽出共享。）
 */
export async function readWorkspaceDir(): Promise<string> {
  // 1. 已加载的配置（思源刷新配置后可用）
  try {
    const dir = window.siyuan?.config?.system?.workspaceDir
    if (typeof dir === "string" && dir) return dir
  } catch {
    // window/globalThis 不可用（纯 Node 单测）：继续走下一步
  }

  // 2. 回退：直接请求内核配置（与 @/api 的 getConf 等价，但不引入其依赖）
  try {
    const resp = await fetch("/api/system/getConf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    if (!resp.ok) return ""
    const json = await resp.json() as { code?: number, data?: { conf?: { system?: { workspaceDir?: string } } } }
    if (json?.code !== 0) return ""
    return json.data?.conf?.system?.workspaceDir || ""
  } catch {
    return ""
  }
}
