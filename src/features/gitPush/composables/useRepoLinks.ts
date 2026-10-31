// 仓库链接（手动平台 URL）编辑逻辑：回填、增删改即时持久化、复制（编辑项目弹窗使用）
import type { RemoteRowItem } from "../components/common/EditableRemoteList.vue"
import type { SelectOption } from "@/components/Select.vue"
import type { GitProject, GitPushManager } from "../types"
import { computed, reactive, ref, watch } from "vue"
import { showMessage } from "siyuan"
import { copyToClipboard } from "@/utils/domUtils"
import { getErrorMessage } from "@/utils/stringUtils"
import { PLATFORM_META } from "../types"

/** 由 PLATFORM_META 推导的平台 URL 字段名联合类型（避免各处硬编码键名） */
type PlatformUrlProp = (typeof PLATFORM_META)[number]["urlProp"]

export interface UseRepoLinksOptions {
  projectId: () => string
  manager: () => GitPushManager
  i18n: () => Record<string, any>
  /** 组件仍挂载（异步落点守卫由调用方提供） */
  alive: () => boolean
  /** 持久化成功后通知父组件刷新列表 */
  onUpdated: () => void
}

export function useRepoLinks(opts: UseRepoLinksOptions) {
  const urlInputs = reactive<Record<string, string>>(
    Object.fromEntries(PLATFORM_META.map((pl) => [pl.urlProp, ""])),
  )
  const error = ref("")

  /** 由项目数据回填平台 URL */
  function initFrom(project: GitProject) {
    for (const pl of PLATFORM_META) {
      urlInputs[pl.urlProp] = project[pl.urlProp] || ""
    }
  }

  const rows = computed<RemoteRowItem[]>(() =>
    PLATFORM_META
      .filter((pl) => urlInputs[pl.urlProp])
      .map((pl) => ({
        key: pl.key,
        name: pl.label,
        icon: pl.icon,
        url: urlInputs[pl.urlProp],
      })),
  )

  /** 平台下拉仅列出尚未配置 URL 的平台 */
  const addOptions = computed<SelectOption[]>(() =>
    PLATFORM_META
      .filter((pl) => !urlInputs[pl.urlProp])
      .map((pl) => ({
        value: pl.key,
        label: `${pl.label}${opts.i18n().notConfiguredSuffix}`,
      })),
  )

  /** 将 urlInputs 全量持久化，返回是否成功（失败写入 error） */
  async function persist(): Promise<boolean> {
    if (!opts.alive()) {
      return false
    }
    try {
      const patch = {} as Partial<Record<PlatformUrlProp, string>>
      for (const pl of PLATFORM_META) {
        patch[pl.urlProp] = urlInputs[pl.urlProp] || undefined
      }
      const updated = await opts.manager().updateProjectMeta(opts.projectId(), patch)
      if (!updated) {
        if (opts.alive()) {
          error.value = opts.i18n().errSaveRepoLinks
        }
        return false
      }
      if (!opts.alive()) {
        return false
      }
      error.value = ""
      opts.onUpdated()
      return true
    } catch (e: unknown) {
      if (opts.alive()) {
        error.value = getErrorMessage(e) || opts.i18n().errSaveRepoLinks
      }
      return false
    }
  }

  /** 添加与编辑共用：写入平台 URL 后持久化 */
  async function upsert(platform: string, url: string): Promise<boolean> {
    const pl = PLATFORM_META.find((p) => p.key === platform)
    if (!pl) {
      return false
    }
    urlInputs[pl.urlProp] = url
    return persist()
  }

  async function remove(platform: string): Promise<boolean> {
    return upsert(platform, "")
  }

  /** 复制指定平台的链接地址到剪贴板 */
  function copy(platform: string): void {
    const pl = PLATFORM_META.find((p) => p.key === platform)
    const url = pl ? urlInputs[pl.urlProp] : ""
    if (!url) {
      return
    }
    void copyToClipboard(url)
    showMessage(opts.i18n().copiedLink, 2000, "info")
  }

  // 编辑时清除旧错误提示，避免失败后残留
  watch(
    () => PLATFORM_META.map((pl) => urlInputs[pl.urlProp]).join("\n"),
    () => {
      if (error.value) {
        error.value = ""
      }
    },
  )

  return { urlInputs, error, rows, addOptions, initFrom, persist, upsert, remove, copy }
}
