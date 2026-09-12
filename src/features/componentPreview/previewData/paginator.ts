/**
 * 组件预览清单 — Paginator 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、code（对应可复制模板）
 * 注：本组件无默认插槽与具名插槽，故示例全部只用 props + code。
 * 注：组件以 `v-model:page` 驱动，而预览框架只识别 `modelValue` ⇒ 示例为静态快照
 *     （点击页码不会改变高亮），故特意用不同 `page` 值覆盖贴左 / 居中 / 贴右 / 省略号等形态。
 */
import type { PreviewGroup } from "../types"
import Paginator from "@/components/Paginator.vue"

/** 每页条数候选（纯数字形式） */
const rowsOptionsPlain = [10, 20, 50, 100]

/** 每页条数候选（带本地化文案的对象形式，label 可承载「张/页」这类模板文案） */
const rowsOptionsLabeled = [
  {
    value: 20,
    label: "20 张/页",
  },
  {
    value: 30,
    label: "30 张/页",
  },
  {
    value: 50,
    label: "50 张/页",
  },
]

export const paginatorGroup: PreviewGroup = {
  id: "paginator",
  component: Paginator,
  name: "Paginator",
  summary: "分页器：页码 / 每页条数 / 总条数三要素驱动，可开关首末页、页码链接、数字报告、每页条数与跳页",
  importCode: "import Paginator from \"@/components/Paginator.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（无页码链接）",
      props: {
        page: 2,
        rows: 10,
        total: 25,
        showPageLinks: false,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"25\" :show-page-links=\"false\" />",
    },
    {
      title: "带页码链接",
      props: {
        page: 1,
        rows: 10,
        total: 25,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"25\" />",
    },
    {
      title: "大总量（省略号折叠）",
      props: {
        page: 10,
        rows: 10,
        total: 200,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"200\" />",
    },
    {
      title: "贴末页（右侧折叠）",
      props: {
        page: 20,
        rows: 10,
        total: 200,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"200\" />",
    },
    {
      title: "窗口大小 3（pageLinkSize）",
      props: {
        page: 6,
        rows: 10,
        total: 300,
        pageLinkSize: 3,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"300\" :page-link-size=\"3\" />",
    },
    {
      title: "每页条数下拉（纯数字）",
      props: {
        page: 1,
        rows: 20,
        total: 120,
        rowsPerPageOptions: rowsOptionsPlain,
      },
      code: "<Paginator v-model:page=\"page\" v-model:rows=\"rows\" :total=\"120\" :rows-per-page-options=\"[10, 20, 50, 100]\" />",
    },
    {
      title: "每页条数下拉（带本地化文案）",
      props: {
        page: 1,
        rows: 30,
        total: 120,
        rowsPerPageOptions: rowsOptionsLabeled,
      },
      code: "<Paginator v-model:page=\"page\" v-model:rows=\"rows\" :total=\"120\" :rows-per-page-options=\"perPageOptions\" />",
    },
    {
      title: "跳页输入（showJumpInput）",
      props: {
        page: 1,
        rows: 10,
        total: 120,
        showJumpInput: true,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"120\" show-jump-input />",
    },
    {
      title: "自定义报告模板",
      props: {
        page: 2,
        rows: 10,
        total: 120,
        reportTemplate: "{first}-{last} / 共 {total} 条",
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"120\" report-template=\"{first}-{last} / 共 {total} 条\" />",
    },
    {
      title: "无首末页（showFirstLast）",
      props: {
        page: 3,
        rows: 10,
        total: 80,
        showFirstLast: false,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"80\" :show-first-last=\"false\" />",
    },
    {
      title: "单页隐藏（alwaysShow）",
      props: {
        page: 1,
        rows: 10,
        total: 5,
        showPageLinks: false,
        alwaysShow: false,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"5\" :show-page-links=\"false\" :always-show=\"false\" />",
    },
    {
      title: "禁用",
      props: {
        page: 3,
        rows: 10,
        total: 80,
        disabled: true,
      },
      code: "<Paginator v-model:page=\"page\" :rows=\"10\" :total=\"80\" disabled />",
    },
  ],
}

export const paginatorPreviewGroups: PreviewGroup[] = [
  paginatorGroup,
]
