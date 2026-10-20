// cacheClean 子组件共享的纯类型：根目录行的视图模型（容器拍平后交给纯展示组件）

import type { IconKey } from "@/components/kit/icons"
import type { CacheRisk, CacheRootId } from "../../types"

/**
 * 根目录行视图模型。
 *
 * 由 `useCacheClean` 从「`CACHE_ROOTS` 定义 + 已解析路径 + 扫描结果 + 勾选状态」拍平而来，
 * 子组件只做渲染，不再回查这些数据源（AGENTS_ARCH：禁止把逻辑下放给子组件）。
 */
export interface CacheRootRow {
  id: CacheRootId
  /** 已本地化的分类名（由 `labelKey` 取 i18n 文案） */
  label: string
  icon: IconKey
  risk: CacheRisk
  /** 已解析到的绝对路径（同类多候选时可能有多条；为空表示目录不存在） */
  paths: string[]
  /** 该分类是否被勾选为扫描位置（用户偏好，缺省取 `defaultEnabled`） */
  enabled: boolean
  /** 勾选框勾选态：扫描后由「已选条目数」决定，未扫描时回落到 `enabled` */
  checked: boolean
  /** 半选态：该分类下仅部分条目被选中 */
  indeterminate: boolean
  /** 扫描到的体积合计（字节） */
  size: number
  /** 扫描到的条目数 */
  files: number
  /** 未解析/不可读原因（成功为空串） */
  message: string
}

/** 面板内展示型反馈（扫描取消/失败、清理成功/失败） */
export interface CachePanelFeedback {
  severity: "success" | "warn" | "error"
  text: string
}
