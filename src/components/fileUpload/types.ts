// FileUpload 类型与常量：模式 / 校验结果字面量类型 + 默认中文文案
// （FileUpload.vue 的私有模块，禁止 feature 直接导入）
import type { OverlaySize } from "../overlay/types"

/**
 * 展示模式：`advanced`（默认，带拖拽区 + 文件列表 + 操作按钮）/ `basic`（仅一个选择按钮）。
 * 对齐官方取值。
 */
export type FileUploadMode = "advanced" | "basic"

/** 尺寸档位（与全库控件阶梯一致；定义在 `overlay/types.ts`） */
export type FileUploadSize = OverlaySize

/** 单条校验失败信息（`message` 已按模板插值完成，可直接渲染） */
export interface FileUploadError {
  /** 出错的文件名 */
  fileName: string
  /** 失败原因分类：超出大小 / 类型不符 / 超出数量上限 */
  reason: "size" | "type" | "limit"
  /** 已插值的可读文案 */
  message: string
}

/**
 * 默认中文文案（沿用 Panel / Splitter / Paginator / Tooltip 惯例：
 * 均可被调用方覆盖为 i18n 文案 ⇒ 零 i18n 分片改动）。
 * 含 `{0}` / `{1}` 占位符的与官方默认文案同形，由组件内插值。
 */
export const DEFAULT_CHOOSE_LABEL = "选择文件"
export const DEFAULT_UPLOAD_LABEL = "上传"
export const DEFAULT_CANCEL_LABEL = "取消"
export const DEFAULT_INVALID_SIZE_MESSAGE = "{0}：文件过大，应小于 {1}"
export const DEFAULT_INVALID_TYPE_MESSAGE = "{0}：文件类型不允许"
export const DEFAULT_INVALID_LIMIT_MESSAGE = "最多只能上传 {0} 个文件"
export const DEFAULT_EMPTY_TEXT = "拖拽文件到此处，或点击选择"

/** 把 `{0}` / `{1}` 占位符按顺序替换为实参（官方文案模板同款插值规则） */
export const interpolate = (template: string, ...values: (string | number)[]) =>
  template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = values[Number(index)]
    return value === undefined ? match : String(value)
  })
