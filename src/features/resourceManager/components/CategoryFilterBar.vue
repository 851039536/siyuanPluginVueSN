<!-- 图片/文件页签分类筛选栏：分类 chip 切换 + 「分类设置」入口（分类管理在独立弹窗中完成） -->
<template>
  <div class="rm-category-bar">
    <!-- 按钮："待分类"（空筛选仅显示未归入分类目录的资源） -->
    <button
      class="rm-btn small"
      :class="{ active: activeKey === '' }"
      @click="emit('select', '')"
    >
      {{ i18n.uncategorized }}
    </button>
    <!-- 分类 chip："图片 / NET / tool / 其他" 及自定义分类 -->
    <button
      v-for="cat in categories"
      :key="cat.key"
      class="rm-btn small"
      :class="{ active: activeKey === cat.key }"
      @click="emit('select', cat.key)"
    >
      {{ cat.label }}
    </button>
    <!-- 按钮："分类设置"（打开分类管理弹窗：删除空分类 / 恢复内置分类） -->
    <button
      class="rm-btn small rm-category-bar__manage"
      :title="i18n.categorySettings"
      @click="emit('manage')"
    >
      <IconWrapper
        name="settings"
        :size="12"
      />
      {{ i18n.categorySettings }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CategoryItem, ResourceManagerI18n } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  i18n: ResourceManagerI18n
  /** 分类栏可见条目（内置 + 自定义） */
  categories: CategoryItem[]
  /** 当前激活的分类 key（空串 = 待分类） */
  activeKey: string
}

interface Emits {
  /** 切换分类筛选（空串 = 待分类） */
  (e: "select", key: string): void
  /** 打开分类设置弹窗 */
  (e: "manage"): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<style scoped lang="scss">
@use "../styles/CategoryFilterBar.scss";
@use "../styles/index.scss";
</style>
