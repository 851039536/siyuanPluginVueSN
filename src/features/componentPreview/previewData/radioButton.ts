/**
 * 组件预览清单 — RadioButton 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、code（对应可复制模板），两者必须严格一致
 * 注：单选组是「多实例互相约束」的语义，单卡片快照只能呈现一个实例，
 *     故组用法在 code 与 `componentPreview/README.md` 中说明。
 */
import type { PreviewGroup } from "../types"
import RadioButton from "@/components/RadioButton.vue"

export const radioButtonGroup: PreviewGroup = {
  id: "radioButton",
  component: RadioButton,
  name: "RadioButton",
  summary: "单选框：单选组 / 二值模式 / 尺寸 / 描边实底 / 禁用只读错误",
  importCode: "import RadioButton from \"@/components/RadioButton.vue\"",
  sizeable: true,
  examples: [
    {
      title: "未选中",
      props: {
        modelValue: "head",
        value: "all",
        label: "全部分支",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" label=\"全部分支\" />",
    },
    {
      title: "选中",
      props: {
        modelValue: "all",
        value: "all",
        label: "全部分支",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" label=\"全部分支\" />",
    },
    {
      title: "单选组（同 v-model + 同 name）",
      props: {
        modelValue: "head",
        value: "head",
        name: "branch-mode",
        label: "仅当前分支 (HEAD)",
      },
      code: `<RadioButton v-model="branchMode" name="branch-mode" value="all" label="全部分支 (--all)" />
<RadioButton v-model="branchMode" name="branch-mode" value="head" label="仅当前分支 (HEAD)" />`,
    },
    {
      title: "二值模式",
      props: {
        modelValue: true,
        binary: true,
        label: "保留原提交日期",
      },
      code: "<RadioButton v-model=\"preserveDate\" binary label=\"保留原提交日期\" />",
    },
    {
      title: "尺寸",
      props: {
        modelValue: "large",
        value: "large",
        size: "large",
        label: "large",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"large\" size=\"large\" label=\"large\" />",
    },
    {
      title: "实底变体",
      props: {
        modelValue: "head",
        value: "all",
        variant: "filled",
        label: "实底",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" variant=\"filled\" label=\"实底\" />",
    },
    {
      title: "标签在前",
      props: {
        modelValue: "all",
        value: "all",
        label: "全部分支",
        labelBefore: true,
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" label=\"全部分支\" labelBefore />",
    },
    {
      title: "纯圆框（无标签）",
      props: {
        modelValue: "all",
        value: "all",
        inputId: "branch-all",
        ariaLabel: "全部分支",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" input-id=\"branch-all\" aria-label=\"全部分支\" />",
    },
    {
      title: "辅助说明",
      props: {
        modelValue: "all",
        value: "all",
        label: "全部分支",
        hint: "推送该远程仓库的所有本地分支",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" label=\"全部分支\" hint=\"推送该远程仓库的所有本地分支\" />",
    },
    {
      title: "错误状态",
      props: {
        modelValue: "",
        value: "all",
        label: "全部分支",
        error: "必须选择一个推送范围",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" label=\"全部分支\" error=\"必须选择一个推送范围\" />",
    },
    {
      title: "禁用",
      props: {
        modelValue: "all",
        value: "all",
        disabled: true,
        label: "禁用",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" disabled label=\"禁用\" />",
    },
    {
      title: "只读",
      props: {
        modelValue: "all",
        value: "all",
        readonly: true,
        label: "只读",
      },
      code: "<RadioButton v-model=\"branchMode\" value=\"all\" readonly label=\"只读\" />",
    },
  ],
}

export const radioButtonPreviewGroups: PreviewGroup[] = [
  radioButtonGroup,
]
