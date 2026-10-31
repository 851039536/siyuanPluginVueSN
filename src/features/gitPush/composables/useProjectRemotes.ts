// Git 远程仓库检测与编辑逻辑：读取 .git/config、增删改远程、保存后同步远程映射
import type { RemoteRowItem } from "../components/common/EditableRemoteList.vue"
import type { SelectOption } from "@/components/Select.vue"
import type { GitProject, GitPushManager, GitRemoteInfo } from "../types"
import { computed, onUnmounted, ref, watch } from "vue"
import { showMessage } from "siyuan"
import { copyToClipboard } from "@/utils/domUtils"
import { getErrorMessage } from "@/utils/stringUtils"
import { PLATFORM_META } from "../types"
import { hasPlatformRemote, resolveRemotePlatform, resolveValidPath } from "../utils"

/** 路径变更后重新检测远程的防抖间隔 */
const DETECT_DEBOUNCE_MS = 500

export interface UseProjectRemotesOptions {
  projectId: () => string
  manager: () => GitPushManager
  i18n: () => Record<string, any>
  alive: () => boolean
  project: () => GitProject | null
  /** 当前表单解析出的仓库路径（strict=true 时要求路径真实存在） */
  getPath: (strict?: boolean) => string
  /** 路径候选的响应式键（路径行增删改时变化） */
  pathKey: () => string
  /** 允许自动重新检测（弹窗已初始化完成） */
  enabled: () => boolean
}

export function useProjectRemotes(opts: UseProjectRemotesOptions) {
  const remoteList = ref<GitRemoteInfo[]>([])
  const error = ref("")
  /** 递增序号：丢弃过期/乱序的远程检测结果 */
  let detectSeq = 0
  /** 最近一次已写入 remoteList 的检测路径（相同路径不重复执行 git remote -v） */
  let lastDetectedPath = ""

  /** 识别为平台的远程用统一 label + icon 展示，key 仍为真实远程名供 git 操作 */
  const rows = computed<RemoteRowItem[]>(() =>
    remoteList.value.map((r) => {
      const pm = resolveRemotePlatform(r)
      return {
        key: r.name,
        name: pm ? pm.label : r.name,
        url: r.url,
        icon: pm?.icon,
      }
    }),
  )

  /** 平台下拉仅列出尚未添加的平台（已存在的远程不允许重复添加） */
  const addOptions = computed<SelectOption[]>(() =>
    PLATFORM_META
      .filter((pl) => !hasPlatformRemote(remoteList.value, pl.key))
      .map((pl) => ({
        value: pl.key,
        label: pl.label,
      })),
  )

  async function load(): Promise<void> {
    if (!opts.project()) {
      return
    }
    const seq = ++detectSeq
    // 严格解析：路径不存在（正在输入半成品路径 / 换机未同步）时不执行 git remote -v，避免错误提示闪烁
    const path = opts.getPath(true)
    // 无有效路径时清空远程列表（避免沿用旧路径的检测结果）
    if (!path) {
      if (seq === detectSeq) {
        remoteList.value = []
        error.value = ""
        lastDetectedPath = ""
      }
      return
    }
    // 同一路径已有最新检测结果时跳过重复检测（打开弹窗/路径变化/远程操作后的重复调用）
    if (lastDetectedPath === path) {
      return
    }
    try {
      const list = await opts.manager().detectRemotes(path)
      if (seq !== detectSeq || !opts.alive()) {
        return
      }
      remoteList.value = list
      error.value = ""
      lastDetectedPath = path
    } catch (e: unknown) {
      if (seq !== detectSeq || !opts.alive()) {
        return
      }
      error.value = getErrorMessage(e) || opts.i18n().errDetectRemotes
    }
  }

  /** 统一远程操作骨架：清错 → 严格路径校验 → 执行 → 重新检测并写回 */
  async function runRemoteOp(fallbackMsg: string, op: (repoPath: string) => Promise<void>): Promise<boolean> {
    if (!opts.project()) {
      return false
    }
    error.value = ""
    const repoPath = opts.getPath(true)
    if (!repoPath) {
      error.value = opts.i18n().errNoValidPath
      return false
    }
    try {
      await op(repoPath)
      // 单次检测同时刷新界面列表；路径与持久化路径一致时再写回项目远程映射，
      // 路径草稿未保存时只更新 UI，留到 save() 成功后统一写回
      const list = await opts.manager().detectRemotes(repoPath)
      if (!opts.alive()) {
        return false
      }
      remoteList.value = list
      error.value = ""
      lastDetectedPath = repoPath
      const project = opts.project()
      if (project && repoPath === resolveValidPath(project)) {
        await opts.manager().applyRemotes(opts.projectId(), list)
      }
      return true
    } catch (e: unknown) {
      if (opts.alive()) {
        error.value = getErrorMessage(e) || fallbackMsg
      }
      return false
    }
  }

  function add(name: string, url: string): Promise<boolean> {
    return runRemoteOp(opts.i18n().errAddRemote, (p) => opts.manager().addRemote(p, name, url))
  }

  function update(name: string, url: string): Promise<boolean> {
    return runRemoteOp(opts.i18n().errUpdateRemote, (p) => opts.manager().setRemoteUrl(p, name, url))
  }

  function remove(name: string): Promise<boolean> {
    return runRemoteOp(opts.i18n().errRemoveRemote, (p) => opts.manager().removeRemote(p, name))
  }

  /** 复制远程仓库 URL（按远程名在检测列表中查找） */
  function copy(name: string): void {
    const url = remoteList.value.find((r) => r.name === name)?.url || ""
    if (!url) {
      return
    }
    void copyToClipboard(url)
    showMessage(opts.i18n().copiedLink, 2000, "info")
  }

  /**
   * 保存成功后同步远程映射：路径未变化且已有检测结果时直接复用，否则按新路径重新检测。
   * 返回是否成功（失败仅提示，不阻塞保存流程）。
   */
  async function syncAfterSave(savedPath: string): Promise<boolean> {
    try {
      if (lastDetectedPath === savedPath) {
        await opts.manager().applyRemotes(opts.projectId(), remoteList.value)
      } else {
        await opts.manager().refreshRemotes(opts.projectId(), savedPath)
      }
      return true
    } catch {
      return false
    }
  }

  // 路径行变动时防抖重新检测远程（输入本地路径后无需关闭重开）
  let detectTimer: ReturnType<typeof setTimeout> | null = null
  watch(opts.pathKey, () => {
    if (!opts.enabled()) {
      return
    }
    error.value = ""
    if (detectTimer) {
      clearTimeout(detectTimer)
    }
    detectTimer = setTimeout(() => {
      void load()
    }, DETECT_DEBOUNCE_MS)
  })

  onUnmounted(() => {
    if (detectTimer) {
      clearTimeout(detectTimer)
      detectTimer = null
    }
  })

  return { rows, addOptions, error, load, add, update, remove, copy, syncAfterSave }
}
