<!-- 分页器：按「当前页 / 每页条数 / 总条数」驱动，可开关首末页、页码链接、数字报告、每页条数与跳页 -->
<template>
  <div
    v-if="visible"
    :class="rootClasses"
  >
    <Button
      v-if="showFirstLast"
      variant="ghost"
      text
      :size="size"
      icon="chevronDoubleLeft"
      :aria-label="labels.first"
      :disabled="disabled || currentPage === 1"
      @click="goToPage(1)"
    />
    <Button
      variant="ghost"
      text
      :size="size"
      icon="chevronLeft"
      :aria-label="labels.prev"
      :disabled="disabled || currentPage === 1"
      @click="goToPage(currentPage - 1)"
    />

    <template v-if="showPageLinks">
      <template
        v-for="(link, index) in pageLinks"
        :key="typeof link === 'number' ? `p-${link}` : `e-${index}`"
      >
        <!-- 省略号为文本延续标记（非图标），对屏幕阅读器隐藏 -->
        <span
          v-if="link === PAGE_LINK_ELLIPSIS"
          class="si-paginator__ellipsis"
          aria-hidden="true"
        >…</span>
        <Button
          v-else
          :variant="link === currentPage ? 'primary' : 'ghost'"
          :text="link !== currentPage"
          :size="size"
          :aria-label="pageLinkLabel(link)"
          :aria-pressed="link === currentPage"
          :disabled="disabled"
          @click="goToPage(link)"
        >
          {{ link }}
        </Button>
      </template>
    </template>

    <span
      v-if="showReport"
      class="si-paginator__report"
      aria-live="polite"
    >{{ reportText }}</span>

    <Button
      variant="ghost"
      text
      :size="size"
      icon="chevronRight"
      :aria-label="labels.next"
      :disabled="disabled || currentPage === totalPages"
      @click="goToPage(currentPage + 1)"
    />
    <Button
      v-if="showFirstLast"
      variant="ghost"
      text
      :size="size"
      icon="chevronDoubleRight"
      :aria-label="labels.last"
      :disabled="disabled || currentPage === totalPages"
      @click="goToPage(totalPages)"
    />

    <Select
      v-if="rowsOptions.length"
      class="si-paginator__rows"
      :size="size"
      :options="rowsOptions"
      :model-value="state.rows"
      :aria-label="labels.rowsPerPage"
      :disabled="disabled"
      @update:model-value="handleRowsChange"
    />

    <Input
      v-if="showJumpInput"
      v-model="jumpValue"
      class="si-paginator__jump"
      :size="size"
      type="number"
      :placeholder="labels.jump"
      :disabled="disabled"
      @keydown="handleJumpKeydown"
      @blur="commitJump"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  PaginatorChangePayload as PaginatorChangePayloadShape,
  PaginatorLabels as PaginatorLabelsShape,
  PaginatorSize as PaginatorSizeShape,
} from "./paginator/types"
import type { SelectOption } from "./Select.vue"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import Button from "./Button.vue"
import Input from "./Input.vue"
import Select from "./Select.vue"
import { resolvePageLinks } from "./paginator/pageLinks"
import {
  formatReport,
  normalizeRows,
  resolvePaginatorState,
  toChangePayload,
} from "./paginator/state"
import {
  DEFAULT_LABELS,
  PAGE_LINK_ELLIPSIS,
} from "./paginator/types"
import "./kit/theme"

export type PaginatorChangePayload = PaginatorChangePayloadShape
export type PaginatorLabels = PaginatorLabelsShape
export type PaginatorSize = PaginatorSizeShape

interface Props {
  /** 当前页（1 基） */
  page?: number
  /** 每页条数 */
  rows?: number
  /** 总条数 */
  total?: number
  /** 尺寸档位 */
  size?: PaginatorSize
  /** 是否显示首页 / 末页 */
  showFirstLast?: boolean
  /** 是否显示页码链接 */
  showPageLinks?: boolean
  /** 页码链接窗口大小（不含省略号） */
  pageLinkSize?: number
  /** 是否显示数字报告 */
  showReport?: boolean
  /** 数字报告模板，占位符：{page} {totalPages} {rows} {total} {first} {last} */
  reportTemplate?: string
  /** 每页条数候选项：纯数字或带文案的选项对象（后者可承载本地化文案） */
  rowsPerPageOptions?: Array<number | SelectOption>
  /** 是否显示跳页输入 */
  showJumpInput?: boolean
  /** 只有一页时是否仍显示（默认显示） */
  alwaysShow?: boolean
  /** 整体禁用 */
  disabled?: boolean
  /** 导航控件文案（默认中文，可覆盖为调用方 i18n 文案） */
  labels?: PaginatorLabels
}

interface Emits {
  (e: "update:page", value: number): void
  (e: "update:rows", value: number): void
  (e: "change", payload: PaginatorChangePayload): void
}

const props = withDefaults(defineProps<Props>(), {
  page: 1,
  rows: 10,
  total: 0,
  size: "small",
  showFirstLast: true,
  showPageLinks: true,
  pageLinkSize: 5,
  showReport: true,
  reportTemplate: "{page} / {totalPages}",
  showJumpInput: false,
  alwaysShow: true,
  disabled: false,
})

const emit = defineEmits<Emits>()

/** 分页状态单一来源：兜底与越界收敛都在 resolvePaginatorState 内完成 */
const state = computed(() => resolvePaginatorState(props.page, props.rows, props.total))

const totalPages = computed(() => state.value.totalPages)
const currentPage = computed(() => state.value.page)

const pageLinks = computed(() =>
  resolvePageLinks(currentPage.value, totalPages.value, props.pageLinkSize),
)

const visible = computed(() => props.alwaysShow || totalPages.value > 1)

/** 导航文案：默认中文兜底，调用方可逐项覆盖为 i18n 文案 */
const labels = computed(() => ({ ...DEFAULT_LABELS, ...props.labels }))

/** 每页条数候选项归一：纯数字补 label，对象原样透传 */
const rowsOptions = computed<SelectOption[]>(() =>
  (props.rowsPerPageOptions ?? []).map((option) =>
    typeof option === "number" ? { value: option, label: String(option) } : option,
  ),
)

const reportText = computed(() => formatReport(props.reportTemplate, {
  page: state.value.page,
  totalPages: state.value.totalPages,
  rows: state.value.rows,
  total: state.value.total,
  first: state.value.first,
  last: state.value.last,
}))

const pageLinkLabel = (link: number | string) =>
  labels.value.pageLink.replace("{page}", String(link))

/** 唯一改变页码的入口：先收敛再派发，并与父级现值比较避免回环 */
const goToPage = (target: number | string) => {
  const parsed = Math.floor(Number(target))
  if (!Number.isFinite(parsed)) {
    return
  }
  const next = resolvePaginatorState(parsed, props.rows, props.total)
  if (next.page === props.page) {
    return
  }
  emit("update:page", next.page)
  emit("change", toChangePayload(next))
}

/** 每页条数变更后回到第 1 页（与迁移前的既有行为一致） */
const handleRowsChange = (value: unknown) => {
  const next = normalizeRows(value)
  if (next === state.value.rows) {
    return
  }
  emit("update:rows", next)
  if (props.page !== 1) {
    emit("update:page", 1)
  }
  emit("change", toChangePayload(resolvePaginatorState(1, next, props.total)))
}

const jumpValue = ref<string | number | null>("")

/** 跳页提交：非法输入静默忽略并清空；越界交给 goToPage 收敛 */
const commitJump = () => {
  const raw = Number(jumpValue.value)
  jumpValue.value = ""
  if (!Number.isFinite(raw) || raw <= 0) {
    return
  }
  goToPage(raw)
}

/** 回车提交跳页（显式判键，避免依赖组件自定义事件上的按键修饰符） */
const handleJumpKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    commitJump()
  }
}

// 父级传入的页码与派生范围不一致时回派一次，避免调用方停留在空页
const syncOutOfRangePage = () => {
  if (props.page !== currentPage.value) {
    emit("update:page", currentPage.value)
  }
}

watch([() => props.page, totalPages], syncOutOfRangePage)
onMounted(syncOutOfRangePage)

const rootClasses = computed(() => [
  "si-paginator",
  `si-paginator--${props.size}`,
  {
    "si-paginator--disabled": props.disabled,
  },
])
</script>

<style scoped lang="scss">
@use './styles/Paginator.scss';
</style>
