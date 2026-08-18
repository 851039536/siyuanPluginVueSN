<!--
  极简浏览器 — 顶部工具栏：返回/前进/刷新/主页/地址栏/收藏/收藏侧栏/外部打开/设置
-->
<template>
  <div class="mb-toolbar">
    <!-- 导航按钮组 -->
    <Button
      icon="back"
      variant="ghost"
      size="xsmall"
      :disabled="!canGoBack"
      :title="i18n.back"
      @click="onBack"
    />
    <Button
      icon="forward"
      variant="ghost"
      size="xsmall"
      :disabled="!canGoForward"
      :title="i18n.forward"
      @click="onForward"
    />
    <Button
      icon="refresh"
      variant="ghost"
      size="xsmall"
      :title="i18n.refresh"
      @click="onRefresh"
    />
    <Button
      icon="home"
      variant="ghost"
      size="xsmall"
      :title="i18n.home"
      @click="onHome"
    />

    <!-- 地址栏 -->
    <div class="mb-address-bar">
      <input
        v-model="addressInput"
        class="mb-address-input"
        type="text"
        spellcheck="false"
        :placeholder="i18n.addressPlaceholder"
        @keydown.enter="handleGo"
      >
    </div>

    <!-- 收藏当前页 -->
    <Button
      icon="star"
      :variant="isCurrentFavorite ? 'primary' : 'ghost'"
      size="xsmall"
      :title="isCurrentFavorite ? i18n.unfavorite : i18n.favorite"
      @click="onToggleFavorite"
    />

    <!-- 收藏侧栏开关 -->
    <Button
      icon="starOutline"
      variant="ghost"
      size="xsmall"
      :title="i18n.favoritesTitle"
      @click="emit('toggleSidebar')"
    />

    <!-- 在外部浏览器打开（iframe 被站点拒绝时的兜底） -->
    <Button
      icon="openInNew"
      variant="ghost"
      size="xsmall"
      :title="i18n.openExternal"
      @click="onOpenExternal"
    />

    <!-- 设置 -->
    <Button
      icon="settings"
      variant="ghost"
      size="xsmall"
      :title="i18n.settings"
      @click="emit('openSettings')"
    />
  </div>
</template>

<script setup lang="ts">
import type { I18n } from "../types"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import {
  currentUrl,
  goBack,
  goForward,
  historyIndex,
  historyStack,
  isFavorite,
  navigate,
  refreshPage,
  resolveHomeUrl,
} from "../composables/useBrowserState"

defineProps<{
  i18n: I18n
}>()

const emit = defineEmits<{
  (e: "toggleSidebar"): void
  (e: "openSettings"): void
  (e: "toggleFavorite"): void
  (e: "openExternal"): void
  (e: "invalidUrl"): void
}>()

// 地址栏输入（与当前 URL 双向同步）
const addressInput = ref(currentUrl.value)
watch(currentUrl, (value) => {
  addressInput.value = value
})

const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value < historyStack.value.length - 1)

/** 当前 URL 是否已收藏（星标高亮依据） */
const isCurrentFavorite = computed(() => isFavorite(currentUrl.value) !== null)

const handleGo = () => {
  if (navigate(addressInput.value)) return
  // 非法地址：恢复为当前 URL，由父面板提示
  if (addressInput.value.trim()) {
    addressInput.value = currentUrl.value
    emit("invalidUrl")
  }
}

const onBack = () => {
  goBack()
}

const onForward = () => {
  goForward()
}

const onRefresh = () => {
  refreshPage()
}

/** 主页：已配置则导航，未配置则回到起始页（收藏列表） */
const onHome = () => {
  const home = resolveHomeUrl()
  if (home) {
    navigate(home)
    return
  }
  currentUrl.value = ""
  addressInput.value = ""
}

const onToggleFavorite = () => {
  emit("toggleFavorite")
}

const onOpenExternal = () => {
  emit("openExternal")
}
</script>

<style lang="scss">
@use '../styles/Toolbar.scss';
</style>
