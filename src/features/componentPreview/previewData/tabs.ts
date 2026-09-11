/**
 * 组件预览清单 — Tabs 五件套分组数据（Tabs / TabList / Tab / TabPanels / TabPanel 共用一个分区）
 *
 * 注 1：五件套必须成组使用，示例统一用 `render` 组装子树 —— render 的返回值是 **Tabs 的子节点**
 *      （TabList / TabPanels），而不是 Tabs 本身（与 inputGroup 同约定）。
 * 注 2：`render` 里在组件内新建 VNode，故「标签层级」不能跨示例复用数据。
 * 注 3：示例统一传一个初始 `value` 让首屏就有激活项；预览框架只给 `modelValue` 注入受控绑定，
 *      Tabs 的 `value` 不受其接管 —— 点击切换由组件内部自持（官方同款非受控语义），无需桥接。
 * 注 4：`code` 展示标准写法（v-model:value + 同 value 配对的 Tab / TabPanel）。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { IconKey } from "@/components/kit/icons"
import type { PreviewGroup } from "../types"
import Card from "@/components/Card.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Tab from "@/components/Tab.vue"
import TabList from "@/components/TabList.vue"
import TabPanel from "@/components/TabPanel.vue"
import TabPanels from "@/components/TabPanels.vue"
import Tabs from "@/components/Tabs.vue"

/** 单个标签（含对应面板内容）的示例数据 */
interface TabMeta {
  value: string
  title: string
  /** 标签前置图标（必须来自 kit/icons.ts 的 IconKey） */
  icon?: IconKey
  disabled?: boolean
  /** 面板纯文本内容 */
  content?: string
  /** 面板富内容（优先于 content） */
  panel?: () => VNode | VNode[]
}

/** 组装一棵标签页子树：TabList 承载 Tab，TabPanels 承载同 value 的 TabPanel */
const buildTabs = (tabs: TabMeta[]): VNode[] => [
  h(TabList, null, {
    default: () => tabs.map((tab) => h(Tab, {
      key: tab.value,
      value: tab.value,
      disabled: tab.disabled,
    }, {
      default: () => (tab.icon
        ? [h(IconWrapper, { name: tab.icon, size: 13 }), tab.title]
        : [tab.title]),
    })),
  }),
  h(TabPanels, null, {
    default: () => tabs.map((tab) => h(TabPanel, {
      key: tab.value,
      value: tab.value,
    }, {
      default: () => (tab.panel ? tab.panel() : h("div", null, tab.content)),
    })),
  }),
]

/** 基础三页 */
const BASIC_TABS: TabMeta[] = [
  { value: "overview", title: "概览", content: "标签与面板通过同一个 value 配对。" },
  { value: "usage", title: "用量", content: "点击标签即切换；未激活面板默认保留渲染结果。" },
  { value: "settings", title: "设置", content: "切换标签不会重置面板内的状态。" },
]

/** 带图标的标签 */
const ICON_TABS: TabMeta[] = [
  { value: "overview", title: "概览", icon: "chartLine", content: "标签内容可以是图标 + 文本。" },
  { value: "usage", title: "用量", icon: "list", content: "图标取 kit/icons.ts 已注册的 IconKey。" },
  { value: "settings", title: "设置", icon: "settings", content: "推荐 13 ~ 14px，与标签字号同档。" },
]

/** 含禁用项的标签 */
const DISABLED_TABS: TabMeta[] = [
  { value: "overview", title: "概览", content: "禁用项不可点击，键盘导航也会跳过它。" },
  { value: "usage", title: "用量（禁用）", disabled: true, content: "本面板无法切到。" },
  { value: "settings", title: "设置", content: "方向键会在「概览 ↔ 设置」之间回绕。" },
]

/** 面板内放输入框：演示 lazy 与默认（保留状态）的差异 */
const STATEFUL_TABS: TabMeta[] = [
  {
    value: "draft",
    title: "草稿",
    panel: () => h(Input, { placeholder: "输入内容后切到别的标签再回来" }),
  },
  { value: "history", title: "历史", content: "切回来看看草稿还在不在。" },
]

/** 长标签栏：演示横向溢出滚动与激活项自动滚入视野 */
const MANY_TABS: TabMeta[] = Array.from({ length: 20 }, (_, index) => ({
  value: `t${index}`,
  title: `标签 ${index + 1}`,
  content: `第 ${index + 1} 个面板：激活项会自动滚入可视区。`,
}))

/** 富内容面板：复用 Card 承载标题与正文 */
const richPanel = (title: string, subtitle: string, body: string) => () =>
  h(Card, { title, subtitle }, { default: () => body })

export const tabsGroup: PreviewGroup = {
  id: "tabs",
  component: Tabs,
  name: "Tabs",
  summary: "标签页五件套：Tabs / TabList / Tab / TabPanels / TabPanel，用同一个 value 配对；非受控可直接切换，键盘漫游 + 溢出自动滚入视野",
  importCode: "import Tabs from \"@/components/Tabs.vue\"\nimport TabList from \"@/components/TabList.vue\"\nimport Tab from \"@/components/Tab.vue\"\nimport TabPanels from \"@/components/TabPanels.vue\"\nimport TabPanel from \"@/components/TabPanel.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础三页",
      props: { value: "overview" },
      render: () => buildTabs(BASIC_TABS),
      code: `<Tabs v-model:value="active">
  <TabList>
    <Tab value="overview">概览</Tab>
    <Tab value="usage">用量</Tab>
    <Tab value="settings">设置</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="overview">标签与面板通过同一个 value 配对。</TabPanel>
    <TabPanel value="usage">点击标签即切换。</TabPanel>
    <TabPanel value="settings">切换标签不会重置面板内的状态。</TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "标签前置图标",
      props: { value: "overview" },
      render: () => buildTabs(ICON_TABS),
      code: `<Tabs v-model:value="active">
  <TabList>
    <Tab value="overview">
      <IconWrapper name="chartLine" :size="13" />
      概览
    </Tab>
    <Tab value="usage">
      <IconWrapper name="list" :size="13" />
      用量
    </Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="overview">标签内容可以是图标 + 文本。</TabPanel>
    <TabPanel value="usage">图标取已注册的 IconKey。</TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "含禁用项",
      props: { value: "overview" },
      render: () => buildTabs(DISABLED_TABS),
      code: `<Tabs v-model:value="active">
  <TabList>
    <Tab value="overview">概览</Tab>
    <Tab value="usage" disabled>用量（禁用）</Tab>
    <Tab value="settings">设置</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="overview">禁用项不可点击，键盘导航也会跳过它。</TabPanel>
    <TabPanel value="usage">本面板无法切到。</TabPanel>
    <TabPanel value="settings">方向键会在两项之间回绕。</TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "指定当前标签（value = settings）",
      props: { value: "settings" },
      render: () => buildTabs(BASIC_TABS),
      code: `<!-- 传入即受控：初始激活「设置」，切换时派发 update:value -->
<Tabs v-model:value="active">
  <TabList>
    <Tab value="overview">概览</Tab>
    <Tab value="usage">用量</Tab>
    <Tab value="settings">设置</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="overview">…</TabPanel>
    <TabPanel value="usage">…</TabPanel>
    <TabPanel value="settings">首屏即为激活项。</TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "lazy 惰性渲染（切走即重置）",
      props: {
        value: "draft",
        lazy: true,
      },
      render: () => buildTabs(STATEFUL_TABS),
      code: `<Tabs v-model:value="active" lazy>
  <TabList>
    <Tab value="draft">草稿</Tab>
    <Tab value="history">历史</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="draft">
      <Input v-model="draft" placeholder="切走再回来会被重置" />
    </TabPanel>
    <TabPanel value="history">切回来草稿已丢失。</TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "默认保留状态（lazy 关闭）",
      props: { value: "draft" },
      render: () => buildTabs(STATEFUL_TABS),
      code: `<Tabs v-model:value="active">
  <TabList>
    <Tab value="draft">草稿</Tab>
    <Tab value="history">历史</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="draft">
      <Input v-model="draft" placeholder="切走再回来内容仍在" />
    </TabPanel>
    <TabPanel value="history">面板只被隐藏，状态不丢。</TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "富内容面板",
      props: { value: "detail" },
      render: () => buildTabs([
        {
          value: "detail",
          title: "详情",
          panel: richPanel("构建详情", "2026-09-11", "面板可放任意组件：卡片、列表、表单都可直接嵌入。"),
        },
        {
          value: "raw",
          title: "原始数据",
          panel: richPanel("原始数据", "JSON", "{\"status\":\"success\"}"),
        },
      ]),
      code: `<Tabs v-model:value="active">
  <TabList>
    <Tab value="detail">详情</Tab>
    <Tab value="raw">原始数据</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="detail">
      <Card title="构建详情" subtitle="2026-09-11">面板可放任意组件。</Card>
    </TabPanel>
    <TabPanel value="raw">
      <Card title="原始数据" subtitle="JSON">{"status":"success"}</Card>
    </TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "长标签栏（自动滚入视野）",
      props: { value: "t14" },
      render: () => buildTabs(MANY_TABS),
      code: `<!-- 20 个标签：横向溢出时可滚动（滚动条隐藏），激活项自动滚入可视区 -->
<Tabs v-model:value="active">
  <TabList>
    <Tab v-for="tab in tabs" :key="tab.value" :value="tab.value">{{ tab.title }}</Tab>
  </TabList>
  <TabPanels>
    <TabPanel v-for="tab in tabs" :key="tab.value" :value="tab.value">{{ tab.content }}</TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "滚动策略居中（scrollStrategy=\"center\"）",
      props: {
        value: "t18",
        scrollStrategy: "center",
      },
      render: () => buildTabs(MANY_TABS),
      code: `<!-- 默认 nearest：仅贴边时才滚动；center：始终把激活项居中 -->
<Tabs v-model:value="active" scroll-strategy="center">
  <TabList>
    <Tab v-for="tab in tabs" :key="tab.value" :value="tab.value">{{ tab.title }}</Tab>
  </TabList>
  <TabPanels>
    <TabPanel v-for="tab in tabs" :key="tab.value" :value="tab.value">{{ tab.content }}</TabPanel>
  </TabPanels>
</Tabs>`,
    },
    {
      title: "尺寸 - large",
      props: {
        value: "overview",
        size: "large",
      },
      render: () => buildTabs(BASIC_TABS),
      code: `<Tabs v-model:value="active" size="large">
  <TabList>
    <Tab value="overview">概览</Tab>
    <Tab value="usage">用量</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="overview">档位驱动字号与内边距。</TabPanel>
    <TabPanel value="usage">…</TabPanel>
  </TabPanels>
</Tabs>`,
    },
  ],
}

export const tabsPreviewGroups: PreviewGroup[] = [
  tabsGroup,
]
