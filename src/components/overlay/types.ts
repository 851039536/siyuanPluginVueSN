// 弹层类组件（Dialog / ConfirmDialog）共享的类型与常量（组件库私有模块，禁止 feature 直接导入）
// 沿 confirm/types.ts 的「类型集中 + 别名转出」先例：消费方仍从各自的私有模块取类型，外部公开名不变
// （ConfirmPopup 非模态、无遮罩，不使用本模块）

/**
 * 弹层位置（九档，对齐官方 Dialog 取值）：模板类驱动、零 JS 定位。
 * `center` 默认居中；`left` / `right` / `top` / `bottom` 贴对应边；四角为「边 + 端点」组合。
 */
export type OverlayPosition =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "topleft"
  | "topright"
  | "bottomleft"
  | "bottomright"

/** 尺寸档位（与全库控件阶梯一致：xsmall / small / medium / large） */
export type OverlaySize = "xsmall" | "small" | "medium" | "large"

/** 位置修饰类名（`si-dialog-mask--topleft` 形态）：遮罩基础类名前缀由各组件自定，拼接规则单点收敛 */
export const overlayPositionClass = (
  maskClass: string,
  position: OverlayPosition,
) => `${maskClass}--${position}`

/** 关闭按钮的无障碍名称默认值（中文默认，可被调用方覆盖为 i18n 文案 ⇒ 零 i18n 分片改动） */
export const DEFAULT_CLOSE_LABEL = "关闭"
