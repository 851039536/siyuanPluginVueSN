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
  checkboxPreviewGroups,
} from "./checkbox"
import {
  displayPreviewGroups,
} from "./display"
import {
  inputPreviewGroups,
} from "./input"
import {
  tagAvatarPreviewGroups,
} from "./tagAvatar"

/** 全部组件预览分组（按分类数据文件合并，保持稳定顺序） */
export const PREVIEW_GROUPS: PreviewGroup[] = [
  ...buttonPreviewGroups,
  ...inputPreviewGroups,
  ...controlPreviewGroups,
  ...checkboxPreviewGroups,
  ...tagAvatarPreviewGroups,
  ...displayPreviewGroups,
]
