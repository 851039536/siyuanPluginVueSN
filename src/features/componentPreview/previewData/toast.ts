/**
 * 组件预览清单 — Toast 分组数据
 *
 * 注 1：Toast 的消息队列是**受控** `v-model:messages`，纯清单数据无法表达「队列 + 关闭后移除」
 *      ⇒ 这里内联一个**演示宿主**（一个 Toast + 宿主自持的队列），把它作为 `PreviewGroup.component`；
 *      示例通过 props 组合消息 / 方位 / 分组等，全局尺寸档位由 `resolveProps` 注入宿主并透传。
 * 注 2：宿主**默认常显**（`persistent` 为 true 时由宿主持有队列并保持快照稳定）——
 *      否则 `life` 示例与关闭按钮在快照里会立刻消失，无法目视形态。关闭按钮仍可真实点击，便于验证事件契约。
 * 注 3：`scaffoldQueue` 为预览脚手架专用：直接指定首帧队列（不接 `update:messages`），
 *      用于「多消息堆叠」「长文案」这类需要固定队列的静态对比示例。
 * 注 4：宿主自身只是预览脚手架，转发 props 时用宽松对象（与渲染层 `PreviewStage` 同法）。
 * 注 5：尺寸四档（官方无 `size` prop，属本项目扩展）⇒ 标 `sizeable`；
 *      ⚠️ 尺寸演示统一由面板头部 XS/S/M/L 档位切换驱动，本分区不单设「尺寸」示例卡。
 */
import type {
  Component,
  PropType,
  VNode,
} from "vue"
import {
  defineComponent,
  h,
  ref,
} from "vue"
import type { PreviewGroup } from "../types"
import Toast from "@/components/Toast.vue"
import type {
  ToastPosition,
  ToastSize,
} from "@/components/toast/types"

/** 队列条目形态（与 Toast 的 ToastMessageOptions 同形；此处用宽松类型避免脚手架与组件类型耦合） */
type QueueItem = Record<string, any>

/** 预览脚手架默认队列：一条 info 消息（未指定 scaffoldQueue 时使用） */
const DEFAULT_QUEUE: QueueItem[] = [
  { severity: "info", summary: "已同步到云端。", detail: "共 12 个文件，用时 1.4s。" },
]

/**
 * 演示宿主：自持消息队列并接线 `update:messages`，使关闭按钮与 `life` 到期在预览中**真实可用**。
 * - `scaffoldQueue` 传入时直接作为首帧队列（静态快照，用于固定形态对比）
 * - `persistent` 为 false 时同样走自持队列（关闭后不再补回），便于观察「关闭后队列变空」
 */
const ToastDemo = defineComponent({
  name: "ToastDemo",
  props: {
    // ⚠️ 联合类型必须用 `PropType` 收窄：只写 `type: String` 会让 props 退化为 `string`，
    //    传给组件的严格联合（ToastPosition / ToastSize）时报 TS2769
    size: { type: String as PropType<ToastSize>, default: "small" },
    position: { type: String as PropType<ToastPosition>, default: "top-right" },
    group: { type: String, default: undefined },
    closeLabel: { type: String, default: "关闭" },
    ariaLabel: { type: String, default: "消息通知" },
    /** 预览脚手架：首帧队列（不传则用 DEFAULT_QUEUE） */
    scaffoldQueue: { type: Array as unknown as () => QueueItem[], default: undefined },
  },
  setup(props) {
    /** 宿主自持的队列：初值取脚手架队列（或默认单条） */
    const messages = ref<QueueItem[]>([
      ...(props.scaffoldQueue ?? DEFAULT_QUEUE).map(item => ({ ...item })),
    ])

    return (): VNode => h(Toast, {
      messages: messages.value,
      position: props.position,
      group: props.group,
      closeLabel: props.closeLabel,
      ariaLabel: props.ariaLabel,
      size: props.size,
      // 受控回写：组件派发「移除后的剩余队列」，宿主覆盖本地副本
      "onUpdate:messages": (next: QueueItem[]) => {
        messages.value = next
      },
    })
  },
})

export const toastGroup: PreviewGroup = {
  id: "toast",
  component: ToastDemo as Component,
  name: "Toast",
  summary: "消息通知浮层：八向停靠的消息堆栈（受控 v-model:messages）、六档语义、life 悬停暂停、closeicon/message/messageicon/container 插槽；四档尺寸，关闭按钮复用共享 Button",
  importCode: "import Toast from \"@/components/Toast.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基本用法（info）",
      props: {},
      code: `<Toast v-model:messages="messages" />

<!-- messages 队列 -->
const messages = ref([
  { severity: "info", summary: "已同步到云端。", detail: "共 12 个文件，用时 1.4s。" },
])`,
    },
    {
      title: "success",
      props: {
        scaffoldQueue: [
          { severity: "success", summary: "设置已保存。", detail: "改动已写入插件配置。" },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  { severity: "success", summary: "设置已保存。", detail: "改动已写入插件配置。" },
])`,
    },
    {
      title: "warn",
      props: {
        scaffoldQueue: [
          { severity: "warn", summary: "订阅将于 3 天后到期。", detail: "请及时续费以免同步中断。" },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  { severity: "warn", summary: "订阅将于 3 天后到期。", detail: "请及时续费以免同步中断。" },
])`,
    },
    {
      title: "error",
      props: {
        scaffoldQueue: [
          { severity: "error", summary: "保存失败。", detail: "请检查网络后重试。" },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  { severity: "error", summary: "保存失败。", detail: "请检查网络后重试。" },
])`,
    },
    {
      title: "secondary",
      props: {
        scaffoldQueue: [
          { severity: "secondary", summary: "离线模式。", detail: "改动将在恢复连接后同步。" },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  { severity: "secondary", summary: "离线模式。", detail: "改动将在恢复连接后同步。" },
])`,
    },
    {
      title: "contrast",
      props: {
        scaffoldQueue: [
          { severity: "contrast", summary: "当前为只读模式。", detail: "编辑已禁用。" },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  { severity: "contrast", summary: "当前为只读模式。", detail: "编辑已禁用。" },
])`,
    },
    {
      title: "仅 summary（无 detail）",
      props: {
        scaffoldQueue: [
          { severity: "success", summary: "已复制到剪贴板。" },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  { severity: "success", summary: "已复制到剪贴板。" },
])`,
    },
    {
      title: "多消息堆叠",
      props: {
        scaffoldQueue: [
          { severity: "success", summary: "项目 A 推送完成。" },
          { severity: "info", summary: "项目 B 正在推送…", detail: "已完成 3 / 8 个提交。" },
          { severity: "error", summary: "项目 C 推送失败。", detail: "远端分支受保护。" },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  { severity: "success", summary: "项目 A 推送完成。" },
  { severity: "info", summary: "项目 B 正在推送…", detail: "已完成 3 / 8 个提交。" },
  { severity: "error", summary: "项目 C 推送失败。", detail: "远端分支受保护。" },
])`,
    },
    {
      title: "life 定时关闭（悬停暂停）",
      props: {
        scaffoldQueue: [
          { severity: "info", summary: "3 秒后自动关闭。", detail: "鼠标移入可暂停倒计时。", life: 3000 },
        ],
      },
      code: `<Toast v-model:messages="messages" />

// life 到期后组件派发 update:messages（已移除该条），
// 鼠标悬停期间暂停计时、移出后按剩余时长继续
const messages = ref([
  { severity: "info", summary: "3 秒后自动关闭。", detail: "鼠标移入可暂停倒计时。", life: 3000 },
])`,
    },
    {
      title: "不可关闭（closable: false）",
      props: {
        scaffoldQueue: [
          { severity: "warn", summary: "正在执行数据库迁移…", detail: "完成前请勿关闭窗口。", closable: false },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  { severity: "warn", summary: "正在执行数据库迁移…", detail: "完成前请勿关闭窗口。", closable: false },
])`,
    },
    {
      title: "长文案换行",
      props: {
        scaffoldQueue: [
          {
            severity: "error",
            summary: "推送失败：远端分支受保护。",
            detail: "当前工作区尚未配置本地路径，Git 操作将跳过该项目；请在各项目的编辑对话框中补充多设备路径后再试。",
          },
        ],
      },
      code: `<Toast v-model:messages="messages" />

const messages = ref([
  {
    severity: "error",
    summary: "推送失败：远端分支受保护。",
    detail: "当前工作区尚未配置本地路径，Git 操作将跳过该项目；请在各项目的编辑对话框中补充多设备路径后再试。",
  },
])`,
    },
    {
      title: "方位 bottom-left",
      props: {
        position: "bottom-left",
        scaffoldQueue: [
          { severity: "info", summary: "已停靠在左下角。" },
        ],
      },
      code: `<Toast v-model:messages="messages" position="bottom-left" />`,
    },
    {
      title: "方位 top-center",
      props: {
        position: "top-center",
        scaffoldQueue: [
          { severity: "success", summary: "已停靠在顶部居中。" },
        ],
      },
      code: `<Toast v-model:messages="messages" position="top-center" />`,
    },
    {
      title: "方位 center",
      props: {
        position: "center",
        scaffoldQueue: [
          { severity: "warn", summary: "已停靠在视口中央。" },
        ],
      },
      code: `<Toast v-model:messages="messages" position="center" />`,
    },
    {
      title: "分组（group）",
      props: {
        group: "sync",
        scaffoldQueue: [
          { severity: "info", summary: "同步队列中的消息。", group: "sync" },
        ],
      },
      code: `<!-- 仅渲染 group 与之相等的消息（undefined 只匹配未指定 group 的消息） -->
<Toast v-model:messages="messages" group="sync" />

const messages = ref([
  { severity: "info", summary: "将显示。", group: "sync" },
  { severity: "info", summary: "不会显示（group 不匹配）。", group: "other" },
])`,
    },
  ],
}

export const toastPreviewGroups: PreviewGroup[] = [toastGroup]
