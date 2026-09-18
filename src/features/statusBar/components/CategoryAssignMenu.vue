<!-- 分类分配弹出菜单 — 复用共享 TieredMenu 的 popup 模式（事件坐标弹出） -->
<template>
  <TieredMenu
    ref="menuRef"
    :model="items"
    popup
    size="xsmall"
    :aria-label="i18n.assignMenuLabel"
    @select="onSelect"
    @update:visible="onVisibleChange"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { TieredMenuItem } from "@/components/TieredMenu.vue"
import TieredMenu from "@/components/TieredMenu.vue"
import type { StatusBarCategory } from "../types/index"

interface Props {
  visible: boolean
  categories: StatusBarCategory[]
  /** 当前归属分类 id（null 表示「未分类」） */
  currentId: string | null
  /** 触发坐标（视口坐标，由调用方从 MouseEvent 取） */
  x: number
  y: number
  /** i18n 文案（statusBar 分片） */
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  select: [categoryId: string | null]
}>()

const menuRef = ref<InstanceType<typeof TieredMenu> | null>(null)

/** 「未分类」项的保留 key（`null` 无法作为 v-for key，故用哨兵值再归一） */
const NONE_KEY = "__none__"

/** 菜单模型：「未分类」+ 各自定义分类；当前归属项追加勾选标记表意 */
const items = computed<TieredMenuItem[]>(() => {
  const none = props.i18n.categoryNone
  return [
    { key: NONE_KEY, label: props.currentId === null ? `${none} ✓` : none },
    ...props.categories.map((c) => ({
      key: c.id,
      label: c.id === props.currentId ? `${c.name} ✓` : c.name,
    })),
  ]
})

/**
 * 由父级 visible + 坐标驱动共享菜单的开合。
 * TieredMenu 的 show() 需要事件对象取触发点，此处构造等价的最小载荷
 * （仅 clientX/clientY 参与定位，见 useTieredMenu.captureTriggerPoint）。
 */
watch(
  () => [props.visible, props.x, props.y] as const,
  ([visible, x, y]) => {
    if (!visible) {
      menuRef.value?.hide()
      return
    }
    menuRef.value?.show({ clientX: x, clientY: y } as MouseEvent)
  },
  { immediate: true, flush: "post" },
)

/** 叶子项点击：上抛分类 id（哨兵值归一为 null 表示移出分类） */
function onSelect(item: TieredMenuItem): void {
  emit("select", item.key === NONE_KEY ? null : item.key)
  emit("close")
}

/** 菜单因点击外部 / Esc 收起时同步父级状态 */
function onVisibleChange(visible: boolean): void {
  if (!visible) { emit("close") }
}
</script>
