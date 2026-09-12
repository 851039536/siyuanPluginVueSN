<!-- 组件预览 — 导航侧栏：组件锚点列表 + 当前高亮，点击滚动到对应分区 -->
<template>
  <aside
    class="cp-nav"
    :aria-label="i18n.title"
  >
    <!-- 组件列表标题 -->
    <div class="cp-nav__label">{{ i18n.title }}</div>
    <ul class="cp-nav__list">
      <li
        v-for="group in groups"
        :key="group.id"
      >
        <button
          type="button"
          class="cp-nav__item"
          :class="{ 'cp-nav__item--active': group.id === activeId }"
          :aria-current="group.id === activeId ? 'true' : undefined"
          :title="group.summary"
          @click="emit('select', group.id)"
        >
          <span class="cp-nav__item-name">{{ group.name }}</span>
          <span class="cp-nav__item-count">{{ group.examples.length }}</span>
        </button>
      </li>
    </ul>
    <!-- 空态提示："没有匹配的组件" -->
    <div
      v-if="groups.length === 0"
      class="cp-nav__empty"
    >
      {{ i18n.noMatch }}
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { I18n, PreviewGroup } from "../types"

interface Props {
  groups: PreviewGroup[]
  activeId: string
  i18n: I18n
}

defineProps<Props>()

const emit = defineEmits<{
  (e: "select", id: string): void
}>()
</script>

<style lang="scss">
// 面板级样式（styles/index.scss）由根组件 index.vue 统一引入，侧栏不再重复引入
@use '../styles/NavSidebar.scss';
</style>
