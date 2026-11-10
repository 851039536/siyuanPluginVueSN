/**
 * 技能加载来源偏好 — 模块级单例
 *
 * 面板（useSkillsLoader → scanSkills）与 Skills 管理弹窗（useSkillsManager）读写同一份状态：
 * 弹窗内切换开关后无需跨组件传参，面板下次扫描即按新配置生效。
 * 采用「禁用列表」而非「启用列表」——新增工具/路径默认参与扫描，旧配置无需迁移。
 */
import type { Plugin } from "siyuan"
import type { AISkillScope, AIToolType } from "@/config/aiTools"
import {
  isKnownSkillSourceId,
  SKILL_SOURCES,
  skillSourceId,
} from "@/config/aiTools"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import {
  computed,
  ref,
} from "vue"

/** 持久化结构 */
interface SkillSourcePrefs {
  /** 不参与扫描的来源 id（空数组 = 全部启用） */
  disabled: string[]
}

const STORAGE_KEY = "ai-content-generator-skill-sources"
const DEFAULT_PREFS: SkillSourcePrefs = { disabled: [] }

/** 被禁用的来源 id 集合（响应式，供 UI 计算勾选态与启用数量） */
const disabledIds = ref<ReadonlySet<string>>(new Set())

let storage: TypedStorage<SkillSourcePrefs> | null = null
let initPromise: Promise<void> | null = null

/**
 * 初始化并加载偏好；幂等。
 * 面板与弹窗可能先后触发，重复调用共享同一 Promise，避免并发读盘互相覆盖。
 */
export function initSkillSourcePrefs(plugin?: Plugin | null): Promise<void> {
  if (!plugin) return Promise.resolve()
  if (initPromise) return initPromise

  storage = new TypedStorage<SkillSourcePrefs>(new PluginStorage(plugin), STORAGE_KEY, DEFAULT_PREFS)
  initPromise = (async () => {
    try {
      const saved = await storage!.loadOrDefault()
      // 过滤已下线/改名的来源：残留记录不得让新路径永久处于禁用态
      disabledIds.value = new Set((saved.disabled ?? []).filter(isKnownSkillSourceId))
    } catch (error) {
      // 读取失败按「全部启用」处理，保证技能列表始终可用
      console.error("加载技能来源偏好失败:", error)
      disabledIds.value = new Set()
    }
  })()
  return initPromise
}

/** 指定路径是否参与扫描（扫描器逐条判定；未初始化时全部启用） */
export function isSkillPathEnabled(
  toolId: AIToolType,
  scope: AISkillScope,
  relPath: string,
): boolean {
  return !disabledIds.value.has(skillSourceId(toolId, scope, relPath))
}

/** 单个来源是否启用（id 来自 SKILL_SOURCES） */
export function isSkillSourceEnabled(id: string): boolean {
  return !disabledIds.value.has(id)
}

/** 已启用来源数量（响应式，用于折叠头 "n/m"） */
export const enabledSkillSourceCount = computed(
  () => SKILL_SOURCES.filter((source) => !disabledIds.value.has(source.id)).length,
)

/** 写入集合并落盘（内部统一出口，保证内存态与磁盘态同源） */
async function commit(next: Set<string>): Promise<void> {
  disabledIds.value = next
  if (!storage) return
  const ok = await storage.save({ disabled: [...next] })
  if (!ok) console.error("保存技能来源偏好失败")
}

/** 单个来源启用/禁用 */
export async function setSkillSourceEnabled(id: string, enabled: boolean): Promise<void> {
  const next = new Set(disabledIds.value)
  if (enabled) {
    next.delete(id)
  } else {
    next.add(id)
  }
  await commit(next)
}

/** 批量启用/禁用（全选 / 全不选，一次落盘避免逐条写） */
export async function setAllSkillSourcesEnabled(
  ids: readonly string[],
  enabled: boolean,
): Promise<void> {
  const next = new Set(disabledIds.value)
  for (const id of ids) {
    if (enabled) {
      next.delete(id)
    } else {
      next.add(id)
    }
  }
  await commit(next)
}
