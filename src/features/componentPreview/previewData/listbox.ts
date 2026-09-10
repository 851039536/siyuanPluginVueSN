/**
 * 组件预览清单 — Listbox 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、code（对应可复制模板）
 * 注：`option` 为作用域插槽，快照只能呈现默认插槽内容，故无法在本分区渲染，
 *     其用法登记在 `componentPreview/README.md` 的「具名插槽」表中。
 */
import type { PreviewGroup } from "../types"
import Listbox from "@/components/Listbox.vue"

// 选项数据遵循 SelectOption 形态（{ value, label, disabled?, keywords? }）；此处不显式导入该类型，
// 避免 `.ts` 文件从 `.vue` 导入类型触发 tsc 的 TS2614（tsc 不解析 .vue 导出，项目内已有同类既有噪声）

/** 单选 / 多选示例共用的选项数据 */
const FRAMEWORK_OPTIONS = [
  { value: "vue", label: "Vue" },
  { value: "react", label: "React" },
  { value: "svelte", label: "Svelte" },
  { value: "solid", label: "SolidJS" },
]

/** 带别名检索词的选项数据（筛选示例用，keywords 参与匹配） */
const SKILL_OPTIONS = [
  { value: "lint", label: "代码检查", keywords: "eslint 静态分析" },
  { value: "format", label: "代码格式化", keywords: "prettier 排版" },
  { value: "test", label: "单元测试", keywords: "vitest 断言" },
]

/** 含禁用项的选项数据 */
const MIXED_OPTIONS = [
  { value: "vue", label: "Vue" },
  { value: "react", label: "React" },
  { value: "angular", label: "Angular", disabled: true },
]

export const listboxGroup: PreviewGroup = {
  id: "listbox",
  component: Listbox,
  name: "Listbox",
  summary: "内联列表选择：单选 / 多选 / 复选与勾选指示 / 内置筛选 / 单项与整体禁用 / 错误态 / 尺寸",
  importCode: "import Listbox from \"@/components/Listbox.vue\"",
  sizeable: true,
  examples: [
    {
      title: "单选基础",
      props: {
        options: FRAMEWORK_OPTIONS,
        modelValue: "vue",
      },
      code: "<Listbox v-model=\"value\" :options=\"options\" />",
    },
    {
      title: "多选",
      props: {
        options: FRAMEWORK_OPTIONS,
        multiple: true,
        modelValue: ["vue", "svelte"],
      },
      code: "<Listbox v-model=\"values\" :options=\"options\" multiple />",
    },
    {
      title: "多选 + 复选指示",
      props: {
        options: FRAMEWORK_OPTIONS,
        multiple: true,
        checkbox: true,
        modelValue: ["vue", "react"],
      },
      code: "<Listbox v-model=\"values\" :options=\"options\" multiple checkbox />",
    },
    {
      title: "勾选指示（不高亮整行）",
      props: {
        options: FRAMEWORK_OPTIONS,
        checkmark: true,
        highlightOnSelect: false,
        modelValue: "react",
      },
      code: "<Listbox v-model=\"value\" :options=\"options\" checkmark :highlightOnSelect=\"false\" />",
    },
    {
      title: "内置筛选",
      props: {
        options: SKILL_OPTIONS,
        filter: true,
        modelValue: "lint",
      },
      code: "<Listbox v-model=\"value\" :options=\"options\" filter />",
    },
    {
      title: "空数据（空态）",
      props: {
        options: [],
        emptyText: "暂无可用选项",
      },
      code: "<Listbox v-model=\"value\" :options=\"options\" emptyText=\"暂无可用选项\" />",
    },
    {
      title: "单项禁用",
      props: {
        options: MIXED_OPTIONS,
        multiple: true,
        checkbox: true,
        modelValue: ["vue"],
      },
      code: "<Listbox v-model=\"values\" :options=\"options\" multiple checkbox />\n<!-- options 项：{ value: \"angular\", label: \"Angular\", disabled: true } -->",
    },
    {
      title: "整体禁用",
      props: {
        options: FRAMEWORK_OPTIONS,
        disabled: true,
        modelValue: "vue",
      },
      code: "<Listbox v-model=\"value\" :options=\"options\" disabled />",
    },
    {
      title: "校验失败",
      props: {
        options: FRAMEWORK_OPTIONS,
        label: "技术栈",
        error: "请至少选择一项",
        multiple: true,
        checkbox: true,
        modelValue: [],
      },
      code: "<Listbox v-model=\"values\" :options=\"options\" label=\"技术栈\" multiple checkbox error=\"请至少选择一项\" />",
    },
    {
      title: "带标签 + 必填 + 提示",
      props: {
        options: FRAMEWORK_OPTIONS,
        label: "技术栈",
        required: true,
        hint: "可多选，用于生成依赖清单",
        multiple: true,
        checkbox: true,
        modelValue: ["vue", "react", "svelte"],
      },
      code: "<Listbox v-model=\"values\" :options=\"options\" label=\"技术栈\" required hint=\"可多选，用于生成依赖清单\" multiple checkbox />",
    },
  ],
}

export const listboxPreviewGroups: PreviewGroup[] = [
  listboxGroup,
]
