/**
 * 封面偏好设置：加载（启动即加载）+ 防抖自动保存 + Logo 上传/移除
 */
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import type { ImageCreationI18n } from "../types"
import type { CoverSettings } from "../types/storage"
import {
  onUnmounted,
  ref,
  watch,
} from "vue"
import { showMessage } from "siyuan"
import { getFile, putFile } from "@/api"
import { fileToDataUrl } from "../utils/coverHtml"
import {
  cloneCoverSettings,
  DEFAULT_COVER_SETTINGS,
  ImageCreationStorage,
  LOGO_ALLOWED_EXTENSIONS,
  mergeCoverSettings,
} from "../types/storage"

/** 封面设置服务（CoverTab / CoverDecorationSettings / CoverPreview 共享同一实例） */
export interface CoverSettingsService {
  /** 偏好设置（响应式） */
  settings: Ref<CoverSettings>
  /** Logo 图片 dataURL（会话内缓存，生成与缩略图共用） */
  logoDataUrl: Ref<string>
  /** 首次加载完成标记 */
  ready: Promise<void>
  /** 上传 Logo（校验类型 + putFile + 更新设置与缓存） */
  uploadLogo: (file: File) => Promise<void>
  /** 移除 Logo */
  removeLogo: () => Promise<void>
  /** 从工作区路径加载 Logo dataURL（会话内缓存） */
  loadLogoDataUrl: (path: string) => Promise<string>
}

export function useCoverSettings(plugin: Plugin, i18n: ImageCreationI18n): CoverSettingsService {
  const storage = new ImageCreationStorage(plugin)
  const settings = ref<CoverSettings>(cloneCoverSettings(DEFAULT_COVER_SETTINGS))
  const logoDataUrl = ref("")
  const loading = ref(true)

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const save = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void storage.cover.save(settings.value)
    }, 500)
  }

  // 防抖自动保存（深度监听；加载完成前不落盘）
  watch(
    settings,
    () => {
      if (loading.value) return
      save()
    },
    { deep: true },
  )

  // 卸载时冲刷未保存的修改
  onUnmounted(() => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      void storage.cover.save(settings.value)
    }
  })

  const loadLogoDataUrl = async (path: string): Promise<string> => {
    if (logoDataUrl.value) return logoDataUrl.value
    try {
      const blob = await getFile(path)
      if (!blob) return ""
      const url = await fileToDataUrl(blob)
      logoDataUrl.value = url
      return url
    } catch (error) {
      console.error("Logo 加载失败:", error)
      return ""
    }
  }

  const ready = (async () => {
    try {
      const saved = await storage.cover.loadOrDefault()
      settings.value = mergeCoverSettings(saved)
    } finally {
      loading.value = false
    }
    // 已有持久化 Logo 时后台预载 dataURL（缩略图 + 生成复用）
    const lg = settings.value.logo
    if (lg.enabled && lg.path) {
      void loadLogoDataUrl(lg.path).catch(() => { /* 预载失败由生成时降级处理 */ })
    }
  })()

  const uploadLogo = async (file: File): Promise<void> => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (!(LOGO_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      showMessage(i18n.msgLogoTypeInvalid, 3000, "error")
      return
    }
    try {
      const path = `data/storage/petal/${plugin.name}/cover/cover-logo-${Date.now()}.${ext}`
      await putFile(path, false, file)
      settings.value.logo.path = path
      settings.value.logo.enabled = true
      logoDataUrl.value = await fileToDataUrl(file)
      // Logo 关键操作立即落盘（不等防抖）
      void storage.cover.save(settings.value)
    } catch (error) {
      console.error("Logo 上传失败:", error)
      showMessage(i18n.msgLogoUploadFailed, 3000, "error")
    }
  }

  const removeLogo = async (): Promise<void> => {
    settings.value.logo.path = ""
    settings.value.logo.enabled = false
    logoDataUrl.value = ""
    void storage.cover.save(settings.value)
    showMessage(i18n.msgLogoRemoved, 2000, "info")
  }

  return {
    settings,
    logoDataUrl,
    ready,
    uploadLogo,
    removeLogo,
    loadLogoDataUrl,
  }
}
