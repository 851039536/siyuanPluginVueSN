/**
 * 组件预览清单 — ProgressBar 分组数据
 *
 * 注 1：`value` 是普通数值（非受控模型），故纯清单数据即可表达全部形态，无需演示宿主。
 * 注 2：⚠️ `indeterminate` 示例在快照中是**静态**的 —— 动画本就无法靠快照呈现，
 *      但示例卡里的条会真实扫动（预览面板是真实渲染），可目视节奏是否顺滑。
 * 注 3：尺寸四档（官方无 `size` prop，属本项目按库规范扩展）⇒ 标 `sizeable`；
 *      ⚠️ 尺寸演示统一由面板头部 XS/S/M/L 档位切换驱动，本分区不单设「尺寸」示例卡。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import ProgressBar from "@/components/ProgressBar.vue"

export const progressBarPreviewGroup: PreviewGroup = {
  id: "progressBar",
  component: ProgressBar,
  name: "ProgressBar",
  summary: "进度条：单值进度（determinate 定长 + indeterminate 往复扫过）、数值标签、超限钳制；四档尺寸",
  importCode: "import ProgressBar from \"@/components/ProgressBar.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基本用法",
      props: { value: 60 },
      code: "<ProgressBar :value=\"60\" />",
    },
    {
      title: "不显示数值（showValue: false）",
      props: { value: 45, showValue: false },
      code: "<ProgressBar :value=\"45\" :show-value=\"false\" />",
    },
    {
      title: "不定态（进度未知）",
      props: { mode: "indeterminate" },
      code: `<!-- 不定态忽略 value，aria-valuenow 缺省，改由 aria-valuetext 说明状态 -->
<ProgressBar mode="indeterminate" indeterminate-label="正在上传…" />`,
    },
    {
      title: "零值（不渲染标签，条为空）",
      props: { value: 0 },
      code: "<ProgressBar :value=\"0\" />  <!-- 对齐官方：value 为 0 时不渲染标签 -->",
    },
    {
      title: "满值",
      props: { value: 100 },
      code: "<ProgressBar :value=\"100\" />",
    },
    {
      title: "超限自动钳制",
      props: { value: 150 },
      code: `<ProgressBar :value="150" />   <!-- 钳到 100%，不会溢出容器 -->
<ProgressBar :value="-20" />  <!-- 钳到 0% -->`,
    },
    {
      title: "小数值（短条下标签仍可读）",
      props: { value: 3 },
      code: `<!-- ⚠️ 与官方结构差异：标签是轨道的兄弟节点（官方嵌在条内），
     故条极短时标签依然完整可读、不会被裁 -->
<ProgressBar :value="3" />`,
    },
    {
      title: "自定义标签内容",
      props: { value: 72 },
      slots: {
        default: (): VNode => h("span", "已完成 72%"),
      },
      code: `<ProgressBar :value="72">
  <template #default>已完成 72%</template>
</ProgressBar>`,
    },
  ],
}

export const progressBarPreviewGroups: PreviewGroup[] = [progressBarPreviewGroup]
