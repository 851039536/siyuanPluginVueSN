/**
 * Everything搜索配置持久化 composable
 * 托管 config/options 响应式状态、存储加载（冲刷-再加载）与防抖保存
 */
import type { Plugin } from "siyuan"
import type {
  EverythingConfig,
  SearchOptions,
} from "../types"
import {
  nextTick,
  onUnmounted,
  reactive,
  watch,
} from "vue"
import {
  TimerRegistry,
  type TimerHandle,
} from "@/utils/timerRegistry"
import {
  DEFAULT_CONFIG,
  DEFAULT_OPTIONS,
  EverythingSearchStorage,
} from "../types/storage"

/** 配置防抖保存延迟（毫秒） */
const SAVE_DEBOUNCE_MS = 500

/**
 * 配置持久化：加载用存储值回填，变更经防抖写回存储
 */
export function useSearchConfig(plugin: Plugin) {
  const storage = new EverythingSearchStorage(plugin)
  const timerRegistry = new TimerRegistry()
  const config = reactive<EverythingConfig>({ ...DEFAULT_CONFIG })
  const options = reactive<SearchOptions>({ ...DEFAULT_OPTIONS })
  let saveTimer: TimerHandle | null = null
  // 正在从存储加载配置（避免加载触发 watch 回写）
  let isLoadingConfig = false

  /** 立即落盘当前 config/options */
  const persist = async () => {
    try {
      await storage.config.save(config)
      await storage.options.save(options)
    } catch (error) {
      console.error("保存配置到插件存储失败:", error)
    }
  }

  /** 从插件存储加载配置（覆盖式回填） */
  const loadConfig = async () => {
    // 先冲刷未落盘的防抖保存再加载，避免"旧存储值覆盖内存修改 + 回滚值被写回"竞态
    if (saveTimer !== null) {
      timerRegistry.clear(saveTimer)
      saveTimer = null
      await persist()
    }
    isLoadingConfig = true
    try {
      const savedData = await storage.init()
      Object.assign(config, savedData.config)
      Object.assign(options, savedData.options)
    } catch (error) {
      console.error("从插件存储加载配置失败:", error)
    } finally {
      // 延迟一个 tick 重置，确保 watch 已跳过本次加载触发的回调
      await nextTick()
      isLoadingConfig = false
    }
  }

  /** 保存配置到插件存储（带防抖） */
  const saveConfigToPlugin = () => {
    timerRegistry.clear(saveTimer)
    saveTimer = timerRegistry.setTimeout(() => {
      saveTimer = null
      void persist()
    }, SAVE_DEBOUNCE_MS)
  }

  /** 监听配置变化（reactive 源隐式 deep；加载触发的变更不回写存储，消除"读后即写"） */
  watch([config, options], () => {
    if (isLoadingConfig) return
    saveConfigToPlugin()
  })

  /** 更新单个搜索选项 */
  const updateOption = (
    key: keyof SearchOptions,
    value: SearchOptions[keyof SearchOptions],
  ) => {
    Object.assign(options, { [key]: value })
  }

  /** 更新单个服务配置项 */
  const updateConfig = (
    key: keyof EverythingConfig,
    value: EverythingConfig[keyof EverythingConfig],
  ) => {
    Object.assign(config, { [key]: value })
  }

  /** 添加常用关键字 */
  const addKeyword = (keyword: string) => {
    options.frequentKeywords.push(keyword)
  }

  /** 删除常用关键字 */
  const deleteKeyword = (keyword: string) => {
    const idx = options.frequentKeywords.indexOf(keyword)
    if (idx !== -1) {
      options.frequentKeywords.splice(idx, 1)
    }
  }

  onUnmounted(() => {
    timerRegistry.clearAll()
  })

  return {
    config,
    options,
    loadConfig,
    updateOption,
    updateConfig,
    addKeyword,
    deleteKeyword,
  }
}
