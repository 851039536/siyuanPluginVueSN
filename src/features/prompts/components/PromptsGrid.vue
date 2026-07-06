<template>
  <div class="vp-modal-body">
    <div
      v-if="loading"
      class="vp-loading"
      role="status"
    >
      {{ i18n?.loading || '加载中...' }}
    </div>

    <template v-else>
      <!-- 分类筛选 -->
      <div class="vp-category-filter">
        <button
          v-for="cat in allCategories"
          :key="cat.id"
          class="vp-chip"
          :class="{ active: selectedCategory === cat.id }"
          :aria-pressed="selectedCategory === cat.id"
          @click="$emit('selectCategory', cat.id)"
        >
          <span
            class="vp-chip-dot"
            :style="{ backgroundColor: cat.color }"
          />
          {{ cat.name }}
          <span
            v-if="cat.id !== 'all'"
            class="vp-chip-count"
          >{{ categoryCounts[cat.id] || 0 }}</span>
        </button>
      </div>

      <!-- 搜索与操作栏 -->
      <div class="vp-controls">
        <div class="vp-search">
          <IconWrapper
            name="search"
            :size="18"
            class="vp-search-icon"
          />
          <input
            :value="searchQuery"
            type="text"
            :placeholder="i18n?.search || '搜索提示词...'"
            class="vp-input vp-input--search"
            aria-label="搜索提示词"
            @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <Button
          variant="primary"
          size="xsmall"
          icon="add"
          :title="i18n?.addPrompt || '添加提示词'"
          @click="$emit('addPrompt')"
        />
      </div>

      <!-- 提示词网格 -->
      <div class="vp-grid">
        <div
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          class="vp-card"
          role="article"
          :aria-label="`提示词: ${prompt.title}`"
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
                :aria-label="`点击复制${slot.label}: ${prompt.title}`"
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
                  {{ i18n?.clickToCopy || '复制' }}
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
          {{ searchQuery ? i18n?.noPromptsFound || '未找到匹配的提示词' : i18n?.noPrompts || '暂无提示词，点击添加' }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  Prompt,
  PromptCategory,
  PromptContent,
} from "../types"

import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

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
