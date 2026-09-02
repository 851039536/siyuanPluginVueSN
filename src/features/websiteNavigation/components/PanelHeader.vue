<!--
  网站导航面板头部工具栏 — 标题 + 计数徽章 + 添加按钮 + 搜索框（对齐 gitPush 头部布局）
-->
<template>
  <div class="wn-header">
    <div class="wn-header-left">
      <IconWrapper
        name="browser"
        :size="16"
      />
      <!-- 面板标题 -->
      <span class="wn-title">{{ i18n.panelTitle }}</span>
      <span
        v-if="totalCount > 0"
        class="wn-count-badge"
      >{{ count }}/{{ totalCount }}</span>
    </div>
    <div class="wn-header-btns">
      <!-- 添加网站 -->
      <Button
        icon="add"
        variant="primary"
        size="xsmall"
        :title="i18n.addWebsite"
        @click="emit('add')"
      />
      <!-- 项目搜索框（placeholder："搜索网站名称、网址或描述..."） -->
      <div
        v-if="totalCount > 0"
        class="wn-header-search"
      >
        <Input
          v-model="searchQuery"
          size="xsmall"
          :placeholder="i18n.searchPlaceholder"
          prefix-icon="search"
          clearable
          autocomplete="off"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { I18n } from "../types"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  i18n: I18n
  count: number
  totalCount: number
}>()

const emit = defineEmits<{
  (e: "add"): void
}>()

// ── 双向绑定（defineModel 收敛 props + update: emit 样板） ──
const searchQuery = defineModel<string>("searchQuery", { default: "" })
</script>

<style lang="scss">
@use "../styles/PanelHeader.scss";
</style>
