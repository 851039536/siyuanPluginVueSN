/**
 * 代码图片偏好设置：加载（启动即加载）+ 防抖自动保存 + 背景图上传/移除
 */
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import type { ImageCreationI18n } from "../types"
import type { CodeImageSettings } from "../types/storage"
import {
  onUnmounted,
  ref,
  watch,
} from "vue"
import { showMessage } from "siyuan"
import { getFile, putFile } from "@/api"
import { fileToDataUrl } from "../utils/coverHtml"
import {
  BG_IMAGE_ALLOWED_EXTENSIONS,
  DEFAULT_CODE_IMAGE_SETTINGS,
  ImageCreationStorage,
} from "../types/storage"

/** 代码图片设置服务（CodeImageTab / 装饰设置 / 候选条共享同一实例） */
export interface CodeImageSettingsService {
  /** 偏好设置（响应式） */
  settings: Ref<CodeImageSettings>
  /** 背景图 dataURL（会话内缓存，预览/导出/缩略图共用） */
  bgImageDataUrl: Ref<string>
  /** 首次加载完成标记 */
  ready: Promise<void>
  /** 上传背景图（校验类型 + putFile + 更新设置与缓存） */
  uploadBgImage: (file: File) => Promise<void>
  /** 移除背景图 */
  removeBgImage: () => Promise<void>
  /** 从工作区路径加载背景图 dataURL（会话内缓存） */
  loadBgImageDataUrl: (path: string) => Promise<string>
  /** 从工作状态同步偏好（JSON 比对避免无谓落盘） */
  updatePrefs: (prefs: CodeImageSettings) => void
}

export function useCodeImageSettings(plugin: Plugin, i18n: ImageCreationI18n): CodeImageSettingsService {
  const storage = new ImageCreationStorage(plugin)
  const settings = ref<CodeImageSettings>({ ...DEFAULT_CODE_IMAGE_SETTINGS })
  const bgImageDataUrl = ref("")
  const loading = ref(true)

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const save = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void storage.codeImage.save(settings.value)
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
      void storage.codeImage.save(settings.value)
    }
  })

  const loadBgImageDataUrl = async (path: string): Promise<string> => {
    if (bgImageDataUrl.value) return bgImageDataUrl.value
    try {
      const blob = await getFile(path)
      if (!blob) return ""
      const url = await fileToDataUrl(blob)
      bgImageDataUrl.value = url
      return url
    } catch (error) {
      console.error("背景图加载失败:", error)
      return ""
    }
  }

  const ready = (async () => {
    try {
      const saved = await storage.codeImage.loadOrDefault()
      settings.value = { ...DEFAULT_CODE_IMAGE_SETTINGS, ...saved }
    } finally {
      loading.value = false
    }
    // 已有持久化背景图时后台预载 dataURL（预览/导出复用）
    if (settings.value.bgImagePath) {
      void loadBgImageDataUrl(settings.value.bgImagePath).catch(() => { /* 生成时降级 */ })
    }
  })()

  const updatePrefs = (prefs: CodeImageSettings): void => {
    if (JSON.stringify(settings.value) === JSON.stringify(prefs)) return
    settings.value = { ...prefs }
  }

  const uploadBgImage = async (file: File): Promise<void> => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (!(BG_IMAGE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      showMessage(i18n.msgBgImageTypeInvalid, 3000, "error")
      return
    }
    try {
      const path = `data/storage/petal/${plugin.name}/codeimage/bg-${Date.now()}.${ext}`
      await putFile(path, false, file)
      settings.value.bgImagePath = path
      bgImageDataUrl.value = await fileToDataUrl(file)
      // 背景图关键操作立即落盘（不等防抖）
      void storage.codeImage.save(settings.value)
    } catch (error) {
      console.error("背景图上传失败:", error)
      showMessage(i18n.msgBgImageUploadFailed, 3000, "error")
    }
  }

  const removeBgImage = async (): Promise<void> => {
    settings.value.bgImagePath = ""
    bgImageDataUrl.value = ""
    void storage.codeImage.save(settings.value)
  }

  return {
    settings,
    bgImageDataUrl,
    ready,
    uploadBgImage,
    removeBgImage,
    loadBgImageDataUrl,
    updatePrefs,
  }
}
