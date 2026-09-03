/**
 * 工具合集 - 集中式工具注册表
 * 新增工具只需在此文件添加一条配置，无需修改 index.vue
 */
import type { ToolMeta } from "../types"
import Base64ImageTool from "./base64Image/index.vue"
import ColorPickerTool from "./colorPicker/index.vue"
import DeepSeekCostTool from "./deepSeekCost/index.vue"
import JsonFormatterTool from "./jsonFormatter/index.vue"
import RegexTesterTool from "./regexTester/index.vue"
import UnitConverterTool from "./unitConverter/index.vue"
import TimeConverterTool from "./timeConverter/index.vue"
import WordQueryTool from "./wordQuery/index.vue"
import PdfViewerTool from "./pdfViewer/index.vue"

/**
 * 工具注册表（静态配置）
 *
 * label 字段在 index.vue 中由 i18n 运行时填充，
 * 此处留空字符串作为占位（PanelI18n 类型保证运行时非空）。
 */
export const TOOL_REGISTRY: ToolMeta[] = [
  {
    id: "deepSeekCost",
    label: "",
    component: DeepSeekCostTool,
  },
  {
    id: "wordQuery",
    label: "",
    component: WordQueryTool,
  },
  {
    id: "jsonFormatter",
    label: "",
    component: JsonFormatterTool,
  },
  {
    id: "regexTester",
    label: "",
    component: RegexTesterTool,
  },
  {
    id: "colorPicker",
    label: "",
    component: ColorPickerTool,
  },
  {
    id: "base64Image",
    label: "",
    component: Base64ImageTool,
  },
  {
    id: "unitConverter",
    label: "",
    component: UnitConverterTool,
  },
  {
    id: "timeConverter",
    label: "",
    component: TimeConverterTool,
  },
  {
    id: "pdfViewer",
    label: "",
    component: PdfViewerTool,
  },
]

/** 工具 ID → i18n label 解析映射 */
export const TOOL_LABEL_KEYS: Record<string, (i18n: any) => string> = {
  deepSeekCost: (i18n) => i18n.deepSeekCost?.title ?? "DeepSeek Cost",
  wordQuery: (i18n) => i18n.wordQuery?.title ?? "Word Query",
  jsonFormatter: (i18n) => i18n.jsonFormatter?.title ?? "JSON Formatter",
  regexTester: (i18n) => i18n.regexTester?.title ?? "Regex Tester",
  colorPicker: (i18n) => i18n.colorPicker?.title ?? "Color Picker",
  base64Image: (i18n) => i18n.base64Image ?? "Base64 Image",
  unitConverter: (i18n) => i18n.unitConverter ?? "Unit Converter",
  timeConverter: (i18n) => i18n.timeConverter?.title ?? "Time Converter",
  pdfViewer: (i18n) => i18n.pdfViewer?.title ?? "PDF Viewer",
}
