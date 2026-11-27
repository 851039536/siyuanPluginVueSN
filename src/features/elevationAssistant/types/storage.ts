/**
 * 提权助手 - 持久化层
 *
 * 仅保存工具元数据与快捷方式记录；诊断结果只存在内存，避免每次打开面板写盘。
 */
import type { Plugin } from "siyuan"
import type { ElevationTool } from "./index"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import { sanitizeTools } from "../utils/tools"

const TOOLS_KEY = "elevation-assistant-tools"

export class ElevationAssistantStorage {
  private readonly tools: TypedStorage<ElevationTool[]>
  private writeQueue: Promise<unknown> = Promise.resolve()

  constructor(plugin: Plugin) {
    this.tools = new TypedStorage<ElevationTool[]>(
      new PluginStorage(plugin),
      TOOLS_KEY,
      [],
    )
  }

  /** 读取并清洗工具清单 */
  async loadTools(): Promise<ElevationTool[]> {
    const data = await this.tools.loadOrDefault()
    return sanitizeTools(data)
  }

  /** 串行整份写盘（工具数量有上限，整份重写的放大可接受） */
  async saveTools(tools: readonly ElevationTool[]): Promise<boolean> {
    const next = sanitizeTools(tools)
    const run = this.writeQueue.then(
      () => this.tools.save(next),
      () => this.tools.save(next),
    )
    this.writeQueue = run.catch(() => undefined)
    return run
  }
}
