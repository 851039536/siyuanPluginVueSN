/**
 * 组件预览清单 — 聚合入口
 * 汇总各分组数据文件，导出主面板遍历渲染的 PREVIEW_GROUPS
 */
import type { PreviewGroup } from "../types"
import {
  buttonPreviewGroups,
} from "./button"
import {
  controlPreviewGroups,
} from "./control"
import {
  colorFieldPreviewGroups,
} from "./colorField"
import {
  checkboxPreviewGroups,
} from "./checkbox"
import {
  confirmDialogPreviewGroups,
} from "./confirmDialog"
import {
  datePickerPreviewGroups,
} from "./datePicker"
import {
  displayPreviewGroups,
} from "./display"
import {
  dividerPreviewGroups,
} from "./divider"
import {
  inputPreviewGroups,
} from "./input"
import {
  inputGroupPreviewGroups,
} from "./inputGroup"
import {
  listboxPreviewGroups,
} from "./listbox"
import {
  paginatorPreviewGroups,
} from "./paginator"
import {
  radioButtonPreviewGroups,
} from "./radioButton"
import {
  speedDialPreviewGroups,
} from "./speedDial"
import {
  tagAvatarPreviewGroups,
} from "./tagAvatar"
import {
  textareaPreviewGroups,
} from "./textarea"
import {
  timelinePreviewGroups,
} from "./timeline"
import {
  toggleButtonPreviewGroups,
} from "./toggleButton"

/** 全部组件预览分组（按分类数据文件合并，保持稳定顺序） */
export const PREVIEW_GROUPS: PreviewGroup[] = [
  ...buttonPreviewGroups,
  ...inputPreviewGroups,
  ...textareaPreviewGroups,
  ...inputGroupPreviewGroups,
  ...toggleButtonPreviewGroups,
  ...speedDialPreviewGroups,
  ...paginatorPreviewGroups,
  ...controlPreviewGroups,
  ...listboxPreviewGroups,
  ...colorFieldPreviewGroups,
  ...checkboxPreviewGroups,
  ...radioButtonPreviewGroups,
  ...datePickerPreviewGroups,
  ...tagAvatarPreviewGroups,
  ...timelinePreviewGroups,
  ...displayPreviewGroups,
  ...dividerPreviewGroups,
  ...confirmDialogPreviewGroups,
]
