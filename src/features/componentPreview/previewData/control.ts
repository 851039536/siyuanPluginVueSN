/**
 * 组件预览清单 — Select / Switch / Slider 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、code（对应可复制模板）
 */
import type { PreviewGroup } from "../types"
import Select from "@/components/Select.vue"
import Switch from "@/components/Switch.vue"
import Slider from "@/components/Slider.vue"

export const selectGroup: PreviewGroup = {
  id: "select",
  component: Select,
  name: "Select",
  summary: "下拉选择：单选 / 分组 / 筛选 / 可清空 / 禁用 / 尺寸",
  importCode: "import Select from \"@/components/Select.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础选择",
      props: {
        options: [
          { value: "vue", label: "Vue" },
          { value: "react", label: "React" },
          { value: "svelte", label: "Svelte" },
        ],
        modelValue: "vue",
      },
      code: "<Select v-model=\"value\" :options=\"options\" />",
    },
    {
      title: "占位符",
      props: {
        options: [
          { value: "vue", label: "Vue" },
          { value: "react", label: "React" },
        ],
        placeholder: "请选择框架",
      },
      code: "<Select v-model=\"value\" :options=\"options\" placeholder=\"请选择框架\" />",
    },
    {
      title: "带标签 + 必填",
      props: {
        label: "技术栈",
        required: true,
        options: [
          { value: "vue", label: "Vue" },
          { value: "react", label: "React" },
        ],
        modelValue: "vue",
      },
      code: "<Select v-model=\"value\" label=\"技术栈\" required :options=\"options\" />",
    },
    {
      title: "分组选项",
      props: {
        options: [
          {
            isGroup: true,
            label: "前端",
            options: [
              { value: "vue", label: "Vue" },
              { value: "react", label: "React" },
            ],
          },
          {
            isGroup: true,
            label: "后端",
            options: [
              { value: "node", label: "Node" },
              { value: "go", label: "Go" },
            ],
          },
        ],
        modelValue: "node",
      },
      code: "<Select v-model=\"value\" :options=\"groupedOptions\" />",
    },
    {
      title: "可筛选",
      props: {
        filterable: true,
        filterPlaceholder: "搜索框架",
        options: [
          { value: "vue", label: "Vue" },
          { value: "react", label: "React" },
          { value: "angular", label: "Angular" },
          { value: "svelte", label: "Svelte" },
          { value: "solid", label: "SolidJS" },
        ],
      },
      code: "<Select v-model=\"value\" filterable :options=\"options\" />",
    },
    {
      title: "关键词筛选（keywords）",
      props: {
        filterable: true,
        filterPlaceholder: "搜索技能名或来源",
        modelValue: "lint",
        options: [
          { value: "lint", label: "代码检查", keywords: "eslint 静态分析" },
          { value: "format", label: "代码格式化", keywords: "prettier 排版" },
        ],
      },
      code: "<Select v-model=\"value\" filterable :options=\"options\" />\n<!-- options 项：{ value: \"lint\", label: \"代码检查\", keywords: \"eslint 静态分析\" } -->",
    },
    {
      title: "可清空",
      props: {
        clearable: true,
        options: [
          { value: "vue", label: "Vue" },
          { value: "react", label: "React" },
        ],
        modelValue: "vue",
      },
      code: "<Select v-model=\"value\" clearable :options=\"options\" />",
    },
    {
      title: "禁用",
      props: {
        disabled: true,
        options: [
          { value: "vue", label: "Vue" },
        ],
        modelValue: "vue",
      },
      code: "<Select v-model=\"value\" disabled :options=\"options\" />",
    },
    {
      title: "带提示",
      props: {
        hint: "选择后用于生成代码",
        label: "语言",
        options: [
          { value: "ts", label: "TypeScript" },
          { value: "js", label: "JavaScript" },
        ],
        modelValue: "ts",
      },
      code: "<Select v-model=\"value\" label=\"语言\" hint=\"选择后用于生成代码\" :options=\"options\" />",
    },
    {
      title: "无障碍命名（无可见标签）",
      props: {
        ariaLabel: "技术栈",
        options: [
          { value: "vue", label: "Vue" },
          { value: "react", label: "React" },
        ],
        modelValue: "vue",
      },
      code: "<Select v-model=\"value\" aria-label=\"技术栈\" :options=\"options\" />",
    },
  ],
}

export const switchGroup: PreviewGroup = {
  id: "switch",
  component: Switch,
  name: "Switch",
  summary: "开关：开/关 / 带标签 / 尺寸 / 禁用 / 加载",
  importCode: "import Switch from \"@/components/Switch.vue\"",
  sizeable: true,
  examples: [
    {
      title: "开",
      props: { modelValue: true },
      code: "<Switch v-model=\"checked\" />",
    },
    {
      title: "关",
      props: { modelValue: false },
      code: "<Switch v-model=\"checked\" />",
    },
    {
      title: "带标签",
      props: {
        modelValue: true,
        label: "自动同步",
      },
      code: "<Switch v-model=\"checked\" label=\"自动同步\" />",
    },
    {
      title: "标签在前",
      props: {
        modelValue: true,
        label: "启用",
        labelBefore: true,
      },
      code: "<Switch v-model=\"checked\" label=\"启用\" labelBefore />",
    },
    {
      title: "自定义激活色",
      props: {
        modelValue: true,
        activeColor: "#10b981",
        label: "绿色",
      },
      code: "<Switch v-model=\"checked\" activeColor=\"#10b981\" label=\"绿色\" />",
    },
    {
      title: "禁用",
      props: {
        modelValue: true,
        disabled: true,
        label: "禁用",
      },
      code: "<Switch v-model=\"checked\" disabled label=\"禁用\" />",
    },
    {
      title: "加载中",
      props: {
        modelValue: true,
        loading: true,
        label: "处理中",
      },
      code: "<Switch v-model=\"checked\" loading label=\"处理中\" />",
    },
  ],
}

export const sliderGroup: PreviewGroup = {
  id: "slider",
  component: Slider,
  name: "Slider",
  summary: "滑块：值 / 范围 / 步长 / 当前值与极值展示 / 禁用与只读",
  importCode: "import Slider from \"@/components/Slider.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础滑块",
      props: { modelValue: 40 },
      code: "<Slider v-model=\"value\" />",
    },
    {
      title: "显示当前值",
      props: {
        modelValue: 60,
        showValue: true,
      },
      code: "<Slider v-model=\"value\" showValue />",
    },
    {
      title: "限制范围 + 步长",
      props: {
        modelValue: 30,
        min: 0,
        max: 100,
        step: 10,
        showValue: true,
      },
      code: "<Slider v-model=\"value\" :min=\"0\" :max=\"100\" :step=\"10\" showValue />",
    },
    {
      title: "带标签",
      props: {
        modelValue: 50,
        label: "音量",
        showValue: true,
      },
      code: "<Slider v-model=\"value\" label=\"音量\" showValue />",
    },
    {
      title: "自定义格式化",
      props: {
        modelValue: 75,
        showValue: true,
        formatValue: (v: number) => `${v}%`,
        label: "进度",
      },
      code: "<Slider v-model=\"value\" :format-value=\"(v) => `${v}%`\" showValue />",
    },
    {
      title: "禁用",
      props: {
        modelValue: 30,
        disabled: true,
        showValue: true,
      },
      code: "<Slider v-model=\"value\" disabled showValue />",
    },
    {
      title: "显示极值范围",
      props: {
        modelValue: 30,
        showMinMax: true,
        label: "音量",
      },
      code: "<Slider v-model=\"value\" label=\"音量\" showMinMax />",
    },
    {
      title: "极值 + 当前值",
      props: {
        modelValue: 65,
        min: 10,
        max: 90,
        showValue: true,
        showMinMax: true,
        formatValue: (v: number) => `${v}%`,
      },
      code: "<Slider v-model=\"value\" :min=\"10\" :max=\"90\" showValue showMinMax :format-value=\"(v) => `${v}%`\" />",
    },
    {
      title: "只读",
      props: {
        modelValue: 50,
        readonly: true,
        showValue: true,
        label: "固定比例",
      },
      code: "<Slider v-model=\"value\" readonly showValue label=\"固定比例\" />",
    },
    {
      title: "错误状态",
      props: {
        modelValue: 80,
        error: "数值超出允许范围",
        label: "超限配置",
      },
      code: "<Slider v-model=\"value\" error=\"数值超出允许范围\" label=\"超限配置\" />",
    },
  ],
}

export const controlPreviewGroups: PreviewGroup[] = [
  selectGroup,
  switchGroup,
  sliderGroup,
]
