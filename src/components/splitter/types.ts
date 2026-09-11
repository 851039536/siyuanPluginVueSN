// Splitter / SplitterPanel 共享的类型与常量（私有模块，禁止 feature 直接导入）
import type { InjectionKey } from "vue"

/** 面板方向（与官方一致） */
export type SplitterLayout = "horizontal" | "vertical"

/** 尺寸数组：各面板百分比，按「注册顺序 = DOM 顺序」对齐 */
export type SplitterSizes = number[]

/** 分隔条默认尺寸（px）与方向键默认步进（百分比），取官方默认值 */
export const DEFAULT_GUTTER_SIZE = 4
export const DEFAULT_STEP = 5

/** 分隔条无障碍名称兜底（可被调用方覆盖为 i18n 文案 ⇒ 组件内零 i18n 分片改动） */
export const DEFAULT_RESIZE_LABEL = "调整面板大小"

/**
 * SplitterPanel 注册到 Splitter 的只读能力。
 * 全部用 getter 取值：注册之后 `props` 变化仍能读到最新约束。
 */
export interface SplitterPanelApi {
  /** 面板唯一标识 */
  readonly id: symbol
  /** 初始尺寸（百分比；未指定时由 Splitter 与其它未指定面板均分剩余空间） */
  getSize: () => number | undefined
  /** 最小尺寸（百分比） */
  getMinSize: () => number
  /** 最大尺寸（百分比） */
  getMaxSize: () => number
  /** 是否允许折叠 */
  getCollapsible: () => boolean
  /** 折叠尺寸（百分比） */
  getCollapsedSize: () => number
}

/** Splitter 通过 provide 暴露给 SplitterPanel 的上下文（字段用 getter，读取即建立响应式依赖） */
export interface SplitterContext {
  /** 面板方向 */
  readonly layout: SplitterLayout
  /** 当前尺寸数组 */
  readonly sizes: readonly number[]
  /** 是否禁用调整 */
  readonly disabled: boolean
  /** 是否拖拽中 */
  readonly resizing: boolean
  /** 分隔条尺寸（px） */
  readonly gutterSize: number
  /** 分隔条无障碍名称 */
  readonly resizeLabel: string
  /** 按面板标识取当前索引（-1 表示未注册） */
  indexOf: (id: symbol) => number
  /** 分隔条的 aria 数值（取左侧面板的当前尺寸与其约束） */
  getGutterMetrics: (id: symbol) => { now: number; min: number; max: number }
  /** 注册面板，返回注销函数 */
  register: (api: SplitterPanelApi) => () => void
  /** 以下为分隔条上的交互入口（由 SplitterPanel 转发，参数带面板标识以免索引过期） */
  onGutterPointerDown: (event: PointerEvent, id: symbol) => void
  onGutterPointerMove: (event: PointerEvent) => void
  onGutterPointerUp: (event: PointerEvent) => void
  onGutterKeydown: (event: KeyboardEvent, id: symbol) => void
}

/** 注入键：Splitter 提供、SplitterPanel 消费；未注入时 SplitterPanel 退化为普通容器 */
export const SPLITTER_CONTEXT_KEY: InjectionKey<SplitterContext> = Symbol("siSplitter")
