<template>
  <div class="single-card-view">
    <div class="flashcard-large">
      <div class="card-title-large">
        {{ currentCard?.title }}
        <div class="card-actions-single">
          <Button
            variant="ghost"
            size="small"
            icon="contentCopy"
            :iconSize="14"
            :title="i18n.copyTitle || '复制标题'"
            @click.stop="$emit('copyTitle', currentCard)"
          />
          <Button
            variant="ghost"
            size="small"
            icon="contentCopy"
            :iconSize="14"
            :title="i18n.copyContent || '复制内容'"
            @click.stop="$emit('copyContent', currentCard)"
          />
          <Button
            v-if="!hideActions"
            variant="ghost"
            size="small"
            icon="edit"
            :iconSize="14"
            :title="i18n.editCard || '编辑'"
            @click.stop="$emit('edit', currentCard)"
          />
          <Button
            v-if="!hideActions"
            variant="danger"
            size="small"
            icon="delete"
            :iconSize="14"
            :title="i18n.deleteCard || '删除'"
            @click.stop="$emit('delete', currentCard)"
          />
        </div>
      </div>
      <div class="card-content-large">
        {{ currentCard?.content }}
      </div>
      <div class="card-meta-large">
        <span class="tag tag-info">{{ currentCard?.category }}</span>
        <span class="tag tag-success">{{ i18n.practiceCount || '练习次数' }}: {{ currentCard?.practiceCount || 0 }}</span>
      </div>
      <Button
        :variant="variant === 'dialog' ? 'success' : 'primary'"
        size="large"
        icon="play"
        @click="$emit('play', currentCard)"
      >
        {{ i18n.play || '播放' }}
      </Button>
    </div>

    <div
      v-if="!hideNavigation"
      class="card-navigation"
    >
      <Button
        variant="ghost"
        icon="chevronLeft"
        :disabled="currentIndex === 0"
        :title="i18n.previous || '上一个'"
        @click.stop="$emit('previous')"
      />
      <Button
        variant="ghost"
        icon="shuffle"
        :title="i18n.randomCard || '随机'"
        @click.stop="$emit('random')"
      />
      <span class="tag tag-rounded">{{ currentIndex + 1 }} / {{ totalCards }}</span>
      <Button
        variant="ghost"
        icon="chevronRight"
        :disabled="currentIndex === totalCards - 1"
        :title="i18n.next || '下一个'"
        @click.stop="$emit('next')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  Flashcard,
  I18n,
} from "../types"
import Button from "@/components/Button.vue"

withDefaults(
  defineProps<{
    currentCard: Flashcard | null
    currentIndex: number
    totalCards: number
    i18n: I18n
    hideNavigation?: boolean
    hideActions?: boolean
    variant?: "default" | "dialog"
  }>(),
  {
    hideNavigation: false,
    hideActions: false,
    variant: "default",
  },
)

defineEmits<{
  play: [card: Flashcard | null]
  previous: []
  next: []
  random: []
  copyTitle: [card: Flashcard | null]
  copyContent: [card: Flashcard | null]
  edit: [card: Flashcard | null]
  delete: [card: Flashcard | null]
}>()
</script>
