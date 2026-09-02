<!-- 分类分配弹出菜单：选择功能归属的自定义分类，点击外部关闭 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="category-assign-overlay"
      @click="emit('close')"
    />
    <div
      v-if="visible"
      class="category-assign-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
    >
      <!-- 菜单项：未分类 -->
      <button
        class="category-assign-item"
        :class="{ active: currentId === null }"
        @click="handleSelect(null)"
      >
        <!-- 未分类选项文案 -->
        未分类
      </button>
      <!-- 自定义分类选项列表 -->
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="category-assign-item"
        :class="{ active: currentId === cat.id }"
        @click="handleSelect(cat.id)"
      >
        {{ cat.name }}
      </button>
      <!-- 空分类提示 -->
      <div
        v-if="categories.length === 0"
        class="category-assign-empty"
      >
        <!-- 无分类时的提示文案 -->
        暂无分类，请先在「管理分类」中新建
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { StatusBarCategory } from "../types/index"

interface Props {
  visible: boolean
  categories: StatusBarCategory[]
  currentId: string | null
  x: number
  y: number
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
  select: [categoryId: string | null]
}>()

const handleSelect = (categoryId: string | null) => {
  emit("select", categoryId)
  emit("close")
}
</script>
