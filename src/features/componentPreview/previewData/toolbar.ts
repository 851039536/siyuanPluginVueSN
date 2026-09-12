/**
 * 组件预览清单 — Toolbar 分组数据
 *
 * 注 1：三个插槽均**无作用域参数**且容器恒渲染，示例统一用 `slots` 字段组装（工厂首参忽略即可）。
 * 注 2：工厂第二参是「注入全局档位后的实际渲染 props」⇒ 插槽内的共享控件取 `p.size`，
 *      使容器与内部控件同档（Toolbar 的 size 传不进插槽，这是 Vue 的固有限制，也是文档要求调用方自行对齐的点）。
 *      ⚠️ 尺寸演示统一由面板头部的 XS/S/M/L 档位切换驱动，本分区不再单独设「尺寸」示例卡。
 * 注 3：内部控制一律复用共享 Button / Input，不为示例新增 SCSS。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { IconKey } from "@/components/kit/icons"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Toolbar from "@/components/Toolbar.vue"

/** 取消 / 保存这一对常用操作按钮（档位取自容器注入的 props） */
const saveCancelActions = (p: Record<string, any>): VNode[] => [
  h(Button, { size: p.size, variant: "secondary", outlined: true }, "取消"),
  h(Button, { size: p.size, variant: "primary" }, "保存"),
]

/** 纯图标按钮（无可见文案 ⇒ 必须给 ariaLabel，项目既有红线） */
const iconAction = (p: Record<string, any>, icon: IconKey, label: string): VNode =>
  h(Button, {
    size: p.size,
    variant: "secondary",
    outlined: true,
    icon,
    ariaLabel: label,
  })

export const toolbarGroup: PreviewGroup = {
  id: "toolbar",
  component: Toolbar,
  name: "Toolbar",
  summary: "工具栏：三段式容器（start 左 / center 居中 / end 右），三种外观 × 四档尺寸，内边距与换行可开关；纯布局无事件（⚠️ 容器档位不注入插槽，内部共享控件需自行传同档 size）",
  importCode: "import Toolbar from \"@/components/Toolbar.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础：start 标题 + end 操作",
      props: {},
      slots: {
        start: () => h("span", null, "项目设置"),
        end: (_slotProps, p) => saveCancelActions(p),
      },
      code: `<Toolbar>
  <template #start>项目设置</template>
  <template #end>
    <Button variant="secondary" outlined>取消</Button>
    <Button variant="primary">保存</Button>
  </template>
</Toolbar>`,
    },
    {
      title: "三段齐全：center 状态文本",
      props: {},
      slots: {
        start: () => h("span", null, "差异对比"),
        center: () => h("span", null, "共 12 处变更"),
        end: (_slotProps, p) => [
          iconAction(p, "download", "导出"),
          h(Button, { size: p.size, variant: "primary" }, "应用"),
        ],
      },
      code: `<!-- center 在「仅 start / 仅 end / start+end / 三者皆有」下均精确居中 -->
<Toolbar>
  <template #start>差异对比</template>
  <template #center>共 12 处变更</template>
  <template #end>
    <Button variant="secondary" outlined icon="download" aria-label="导出" />
    <Button variant="primary">应用</Button>
  </template>
</Toolbar>`,
    },
    {
      title: "center 分段切换",
      props: {},
      slots: {
        start: () => h("span", null, "视图"),
        center: (_slotProps, p) => [
          h(Button, {
            size: p.size,
            variant: "secondary",
            outlined: true,
            "aria-pressed": "true",
          }, "列表"),
          h(Button, {
            size: p.size,
            variant: "secondary",
            outlined: true,
            "aria-pressed": "false",
          }, "网格"),
        ],
        end: (_slotProps, p) => [iconAction(p, "settings", "设置")],
      },
      code: `<!-- 一组互斥选项的分段切换沿用项目范式：Button 分组 + :aria-pressed -->
<Toolbar>
  <template #start>视图</template>
  <template #center>
    <Button variant="secondary" outlined :aria-pressed="mode === 'list'">列表</Button>
    <Button variant="secondary" outlined :aria-pressed="mode === 'grid'">网格</Button>
  </template>
  <template #end>
    <Button variant="secondary" outlined icon="settings" aria-label="设置" />
  </template>
</Toolbar>`,
    },
    {
      title: "搜索栏：start 输入框 + end 按钮",
      props: {},
      slots: {
        start: (_slotProps, p) => h(Input, {
          size: p.size,
          prefixIcon: "magnify",
          placeholder: "搜索项目",
        }),
        end: (_slotProps, p) => [
          h(Button, { size: p.size, variant: "primary" }, "搜索"),
        ],
      },
      code: `<Toolbar>
  <template #start>
    <Input v-model="keyword" prefix-icon="magnify" placeholder="搜索项目" />
  </template>
  <template #end>
    <Button variant="primary" @click="search">搜索</Button>
  </template>
</Toolbar>`,
    },
    {
      title: "外观 filled（实底无边框）",
      props: { variant: "filled" },
      slots: {
        start: () => h("span", null, "批量操作"),
        end: (_slotProps, p) => saveCancelActions(p),
      },
      code: `<Toolbar variant="filled">
  <template #start>批量操作</template>
  <template #end>
    <Button variant="secondary" outlined>取消</Button>
    <Button variant="primary">保存</Button>
  </template>
</Toolbar>`,
    },
    {
      title: "外观 borderless（贴合型）",
      props: { variant: "borderless" },
      slots: {
        start: () => h("span", null, "已选中 3 项"),
        end: (_slotProps, p) => [
          h(Button, { size: p.size, variant: "secondary", text: true }, "全选"),
          h(Button, { size: p.size, variant: "secondary", text: true }, "删除"),
        ],
      },
      code: `<Toolbar variant="borderless">
  <template #start>已选中 3 项</template>
  <template #end>
    <Button variant="secondary" text>全选</Button>
    <Button variant="secondary" text>删除</Button>
  </template>
</Toolbar>`,
    },
    {
      title: "无内边距（padded=false）",
      props: { padded: false },
      slots: {
        start: () => h("span", null, "四向贴合"),
        end: (_slotProps, p) => [h(Button, { size: p.size, variant: "primary" }, "运行")],
      },
      code: `<!-- 关闭内边距供贴合场景使用；最小高度仍按档位保留，高度不会随内容跳动 -->
<Toolbar :padded="false">
  <template #start>四向贴合</template>
  <template #end>
    <Button variant="primary">运行</Button>
  </template>
</Toolbar>`,
    },
    {
      title: "窄容器换行（wrap）",
      props: { wrap: true },
      slots: {
        start: () => h("span", null, "长标题会占用整行"),
        center: () => h("span", null, "状态"),
        end: (_slotProps, p) => [
          iconAction(p, "download", "导出"),
          h(Button, { size: p.size, variant: "secondary", outlined: true }, "刷新"),
          h(Button, { size: p.size, variant: "primary" }, "提交"),
        ],
      },
      code: `<!-- wrap 开启：start 独占首行，center / end 落在次行并分居两端 -->
<Toolbar wrap>
  <template #start>长标题会占用整行</template>
  <template #center>状态</template>
  <template #end>
    <Button variant="secondary" outlined icon="download" aria-label="导出" />
    <Button variant="secondary" outlined>刷新</Button>
    <Button variant="primary">提交</Button>
  </template>
</Toolbar>`,
    },
    {
      title: "只有 start（极简区块头）",
      props: {},
      slots: {
        start: () => h("span", null, "统计概览"),
      },
      code: `<Toolbar>
  <template #start>统计概览</template>
</Toolbar>`,
    },
  ],
}

export const toolbarPreviewGroups: PreviewGroup[] = [
  toolbarGroup,
]
