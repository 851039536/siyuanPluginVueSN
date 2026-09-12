/**
 * 组件预览清单 — Message 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、code（对应可复制模板）
 *
 * 注 1：`severity` 取值逐字对齐 PrimeVue Message（warn / error / contrast），与库内 Button 的
 *      severity 命名有意不统一，勿按库内命名「修正」。
 * 注 2：尺寸四档（官方仅 small / large + 默认档，属有意差异），故标 `sizeable`；
 *      ⚠️ 尺寸演示统一由面板头部 XS/S/M/L 档位切换驱动，本分区不单设「尺寸」示例卡。
 * 注 3：`close` 事件只作通报，**组件不自动隐藏** ⇒ closable / life 示例在快照中始终可见，
 *      事件语义见 componentPreview/README.md「事件契约」表。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"
import Message from "@/components/Message.vue"

/**
 * 图标插槽示例：自定义图标内容。
 * ⚠️ 不传 `size` —— IconWrapper 的 svg 宽高取 `1em`，随消息自身档位字号自动缩放，
 * 因此这里无需复制 Message 内部的档位图标尺寸表。
 */
const customIcon = (): VNode => h(IconWrapper, { name: "lightbulb" })

export const messageGroup: PreviewGroup = {
  id: "message",
  component: Message,
  name: "Message",
  summary: "内联消息提示：默认外观 + 六档语义（secondary/success/info/warn/error/contrast）、图标（prop 或插槽）、可关闭、life 定时关闭；四档尺寸，关闭按钮复用共享 Button",
  importCode: "import Message from \"@/components/Message.vue\"",
  sizeable: true,
  examples: [
    {
      title: "默认外观（未传 severity）",
      props: {},
      slotText: "当前已是最新版本。",
      code: "<Message>当前已是最新版本。</Message>",
    },
    {
      title: "secondary",
      props: { severity: "secondary" },
      slotText: "离线模式：改动将在恢复连接后同步。",
      code: "<Message severity=\"secondary\">离线模式：改动将在恢复连接后同步。</Message>",
    },
    {
      title: "success",
      props: { severity: "success" },
      slotText: "设置已保存。",
      code: "<Message severity=\"success\">设置已保存。</Message>",
    },
    {
      title: "info",
      props: { severity: "info" },
      slotText: "检测到新版本 v2.4.0，可升级体验。",
      code: "<Message severity=\"info\">检测到新版本 v2.4.0，可升级体验。</Message>",
    },
    {
      title: "warn",
      props: { severity: "warn" },
      slotText: "订阅将于 3 天后到期，请及时续费。",
      code: "<Message severity=\"warn\">订阅将于 3 天后到期，请及时续费。</Message>",
    },
    {
      title: "error",
      props: { severity: "error" },
      slotText: "保存失败，请检查网络后重试。",
      code: "<Message severity=\"error\">保存失败，请检查网络后重试。</Message>",
    },
    {
      title: "contrast",
      props: { severity: "contrast" },
      slotText: "当前为只读模式，编辑已禁用。",
      code: "<Message severity=\"contrast\">当前为只读模式，编辑已禁用。</Message>",
    },
    {
      title: "带图标（icon prop）",
      props: { severity: "success", icon: "checkCircle" },
      slotText: "全部文件已上传完成。",
      code: "<Message severity=\"success\" icon=\"checkCircle\">全部文件已上传完成。</Message>",
    },
    {
      title: "图标随语义变化",
      props: { severity: "warn", icon: "alertCircle" },
      slotText: "磁盘剩余空间不足 10%。",
      code: "<Message severity=\"warn\" icon=\"alertCircle\">磁盘剩余空间不足 10%。</Message>",
    },
    {
      title: "icon 插槽（自定义图标）",
      props: { severity: "info" },
      slotText: "按住 ⌘ 可多选条目。",
      slots: { icon: customIcon },
      code: `<Message severity="info">
  <template #icon>
    <!-- 不传 size ⇒ 取 1em，随消息档位字号自动缩放 -->
    <IconWrapper name="lightbulb" />
  </template>
  按住 ⌘ 可多选条目。
</Message>`,
    },
    {
      title: "可关闭",
      props: { severity: "info", closable: true },
      slotText: "已切换到手动排序模式。",
      code: `<Message severity="info" closable @close="handleClose">
  已切换到手动排序模式。
</Message>`,
    },
    {
      title: "长文案换行（可与关闭同用）",
      props: { severity: "warn", icon: "alertCircle", closable: true },
      slotText: "当前工作区尚未配置本地路径，Git 操作将跳过该项目；请在各项目的编辑对话框中补充多设备路径后再试。",
      code: `<Message severity="warn" icon="alertCircle" closable>
  当前工作区尚未配置本地路径，Git 操作将跳过该项目；请在各项目的编辑对话框中补充多设备路径后再试。
</Message>`,
    },
    {
      title: "life 定时关闭",
      props: { severity: "success", life: 3000 },
      slotText: "操作已完成，3 秒后自动派发 close。",
      code: `<Message v-if="show" severity="success" :life="3000" @close="show = false">
  操作已完成。
</Message>`,
    },
  ],
}

export const messagePreviewGroups: PreviewGroup[] = [messageGroup]
