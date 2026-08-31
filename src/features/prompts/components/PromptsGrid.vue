<!--
  提示词库 — 网格视图：两栏布局（分类侧边栏 + 搜索 + 卡片 + 复制）
-->
<template>
  <div class="vp-layout">
    <!-- 加载态 -->
    <div
      v-if="loading"
      class="vp-loading"
      role="status"
    >
      <!-- 加载文案："加载中..." -->
      {{ i18n?.loading }}
    </div>

    <template v-else>
      <!-- 左侧分类侧边栏 -->
      <CategorySidebar
        :all-categories="allCategories"
        :selected-category="selectedCategory"
        :category-counts="categoryCounts"
        :i18n="i18n"
        @select-category="$emit('selectCategory', $event)"
        @manage-categories="$emit('manageCategories')"
      />

      <!-- 右侧内容区 -->
      <div class="vp-content">
        <!-- 搜索与操作栏 -->
        <div class="vp-controls">
          <div class="vp-search">
            <IconWrapper
              name="search"
              :size="18"
              class="vp-search-icon"
            />
            <!-- 搜索占位文案："搜索提示词..."；无障碍标签："搜索提示词" -->
            <input
              :value="searchQuery"
              type="text"
              :placeholder="i18n?.search"
              class="vp-input vp-input--search"
              :aria-label="i18n?.searchPrompts"
              @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <!-- 按钮提示："添加提示词" -->
          <Button
            variant="primary"
            size="xsmall"
            icon="add"
            :title="i18n?.addPrompt"
            @click="$emit('addPrompt')"
          />
        </div>

        <!-- 提示词卡片网格 -->
        <div class="vp-grid">
          <div
            v-for="prompt in filteredPrompts"
            :key="prompt.id"
            class="vp-card"
            role="article"
            :aria-label="`${i18n?.promptCardLabel}: ${prompt.title}`"
          >
            <div class="vp-card-header">
              <div class="vp-card-title">
                <IconWrapper
                  name="star"
                  :size="18"
                  class="vp-card-icon"
                />
                <h3>{{ prompt.title }}</h3>
                <span
                  class="vp-tag"
                  :style="{
                    backgroundColor: prompt.catBgColor,
                    color: prompt.catColor,
                  }"
                >
                  {{ prompt.catName }}
                </span>
              </div>
              <div class="vp-card-actions">
                <Button
                  variant="ghost"
                  icon="edit"
                  size="xsmall"
                  @click="$emit('editPrompt', prompt)"
                />
                <Button
                  variant="danger"
                  icon="delete"
                  size="xsmall"
                  @click="$emit('requestDelete', prompt.id)"
                />
              </div>
            </div>
            <div class="vp-card-body">
              <div class="vp-card-desc">
                {{ prompt.description }}
              </div>

              <div
                v-for="slot in prompt.contents"
                :key="slot.id"
                class="vp-content-block"
              >
                <div class="vp-content-label">
                  <IconWrapper
                    name="textBox"
                    :size="16"
                  />
                  {{ slot.label }}
                </div>
                <div
                  class="vp-content-value"
                  role="button"
                  tabindex="0"
                  :aria-label="`${i18n?.clickCopyAria}${slot.label}: ${prompt.title}`"
                  @click="$emit('copyContent', slot.text)"
                  @keydown.enter="$emit('copyContent', slot.text)"
                  @keydown.space.prevent="$emit('copyContent', slot.text)"
                >
                  <pre>{{ slot.text }}</pre>
                  <div class="vp-copy-hint">
                    <IconWrapper
                      name="contentCopy"
                      :size="14"
                    />
                    <!-- 提示文案："复制" -->
                    {{ i18n?.clickToCopy }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="filteredPrompts.length === 0"
            class="vp-empty"
            role="status"
          >
            <!-- 空态文案："暂无提示词，点击添加" / "未找到匹配的提示词" -->
            {{ searchQuery ? i18n?.noPromptsFound : i18n?.noPrompts }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  Prompt,
  PromptCategory,
} from "../types"

import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import CategorySidebar from "./CategorySidebar.vue"

interface PromptDisplay extends Prompt {
  catName: string
  catColor: string
  catBgColor: string
}

defineProps<{
  filteredPrompts: PromptDisplay[]
  allCategories: PromptCategory[]
  selectedCategory: string
  searchQuery: string
  categoryCounts: Record<string, number>
  loading: boolean
  i18n?: Record<string, string>
}>()

defineEmits<{
  (e: "update:searchQuery", value: string): void
  (e: "selectCategory", id: string): void
  (e: "manageCategories"): void
  (e: "addPrompt"): void
  (e: "editPrompt", prompt: Prompt): void
  (e: "requestDelete", id: string): void
  (e: "copyContent", text: string): void
}>()
</script>

<style lang="scss" scoped>
@use '../styles/PromptsGrid.scss';
@use '../styles/index.scss';
</style>
