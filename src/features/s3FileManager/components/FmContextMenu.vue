<!-- 右键菜单 — 复用共享 TieredMenu 的 popup 模式（事件坐标弹出），菜单项按选中态由父层生成 -->
<template>
  <TieredMenu
    ref="menuRef"
    :model="items"
    popup
    size="xsmall"
    :aria-label="ariaLabel"
    @select="onSelect"
    @update:visible="onVisibleChange"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue"
import type { TieredMenuItem } from "@/components/TieredMenu.vue"
import TieredMenu from "@/components/TieredMenu.vue"

interface Props {
  visible: boolean
  /** 触发坐标（视口坐标，由调用方从 MouseEvent 取） */
  x: number
  y: number
  items: TieredMenuItem[]
  /** 菜单的无障碍名称 */
  ariaLabel?: string
}

// 不设 ariaLabel 默认值：留 undefined 以沿用 TieredMenu 自身的默认无障碍名称，
// 显式传 "" 会把子组件的有意义默认值压掉
const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  /** 叶子项被选中，载荷为该项 key（动作标识） */
  select: [action: string]
}>()

const menuRef = ref<InstanceType<typeof TieredMenu> | null>(null)

/**
 * 由父级 visible + 坐标驱动共享菜单的开合。
 * TieredMenu 的 show() 需要事件对象取触发点，此处构造等价的最小载荷
 * （仅 clientX/clientY 参与定位，见 useTieredMenu.captureTriggerPoint）。
 */
function syncMenu(visible: boolean, x: number, y: number): void {
  if (!visible) {
    menuRef.value?.hide()
    return
  }
  menuRef.value?.show({ clientX: x, clientY: y } as MouseEvent)
}

watch(
  () => [props.visible, props.x, props.y] as const,
  ([visible, x, y]) => syncMenu(visible, x, y),
  { flush: "post" },
)

// 挂载后补一次同步：immediate 首次执行时子组件 ref 尚未就绪（show/hide 静默 no-op），
// 故以 visible 为 true 初始化的调用方此前会看到菜单不弹出
onMounted(() => syncMenu(props.visible, props.x, props.y))

/** 叶子项点击：上抛动作标识（菜单自身已收起） */
function onSelect(item: TieredMenuItem): void {
  emit("select", item.key)
  emit("close")
}

/** 菜单因点击外部 / Esc 收起时同步父级状态 */
function onVisibleChange(visible: boolean): void {
  if (!visible) { emit("close") }
}
</script>
