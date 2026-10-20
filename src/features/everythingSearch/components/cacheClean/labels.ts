// cacheClean 面板的全部 i18n 派生文案（纯展示计算，与状态机解耦）

import type { ComputedRef } from "vue"
import type {
  CacheCleanResult,
  CacheEntry,
  CacheRisk,
  CacheScanProgress,
  CacheScanResult,
} from "../../types"
import type { CachePanelFeedback } from "./types"
import { computed } from "vue"
import {
  buildCleanFeedback,
  buildConfirmMessage,
  buildElapsedText,
  buildScanFeedback,
  buildScanLabel,
  buildSelectedText,
  type Translate,
} from "./format"

/** 进度二元组（扫描与清理共用形状） */
export interface ProgressPair {
  done: number
  total: number
}

/** 文案构建所需的响应式数据源（全部以 getter 传入，便于在不持有 ref 的情况下构建） */
export interface CacheCleanTextSources {
  scanStatus: () => "idle" | "scanning"
  scanResult: () => CacheScanResult | null
  scanProgress: () => CacheScanProgress | null
  scanError: () => string
  scanCancelled: () => boolean
  cleanProgress: () => ProgressPair | null
  cleanResult: () => CacheCleanResult | null
  cleanError: () => string
  selectedEntries: () => CacheEntry[]
  selectedSize: () => number
}

/** 面板文案集合（computed 均随依赖自动更新） */
export interface CacheCleanTexts {
  scanLabel: ComputedRef<string>
  elapsedText: ComputedRef<string>
  selectedText: ComputedRef<string>
  confirmTitle: ComputedRef<string>
  confirmAcceptLabel: ComputedRef<string>
  confirmRejectLabel: ComputedRef<string>
  confirmMessage: ComputedRef<string>
  scanProgressText: ComputedRef<string>
  cleanProgressText: ComputedRef<string>
  scanFeedback: ComputedRef<CachePanelFeedback | null>
  cleanFeedback: ComputedRef<CachePanelFeedback | null>
  riskLabel: (risk: CacheRisk) => string
}

/** 构建面板全部展示文案 */
export function buildCacheCleanTexts(
  t: Translate,
  src: CacheCleanTextSources,
): CacheCleanTexts {
  return {
    scanLabel: computed(() => buildScanLabel(t, src.scanStatus() === "scanning", !!src.scanResult())),
    elapsedText: computed(() => buildElapsedText(t, src.scanResult()?.elapsed)),
    selectedText: computed(() => buildSelectedText(t, src.selectedEntries().length, src.selectedSize())),
    confirmTitle: computed(() => t("cacheCleanConfirmTitle")),
    confirmAcceptLabel: computed(() => t("cacheCleanConfirmAccept")),
    confirmRejectLabel: computed(() => t("cancel")),
    confirmMessage: computed(() => buildConfirmMessage(
      t,
      src.selectedEntries().length,
      src.selectedSize(),
    )),
    scanProgressText: computed(() => toProgressText(src.scanProgress())),
    cleanProgressText: computed(() => toProgressText(src.cleanProgress())),
    scanFeedback: computed(() => buildScanFeedback(t, src.scanError(), src.scanCancelled())),
    cleanFeedback: computed(() => buildCleanFeedback(t, src.cleanError(), src.cleanResult())),
    riskLabel: (risk: CacheRisk): string => t(risk === "safe" ? "cacheRiskSafe" : "cacheRiskCaution"),
  }
}

/** 进度百分比（无进度或总数为 0 时为 0） */
export function toPercent(progress: ProgressPair | null): number {
  if (!progress || progress.total <= 0) return 0
  return Math.round((progress.done / progress.total) * 100)
}

/** 进度文案 `done/total`（无进度时为空串） */
export function toProgressText(progress: ProgressPair | null): string {
  if (!progress || progress.total <= 0) return ""
  return `${progress.done}/${progress.total}`
}
