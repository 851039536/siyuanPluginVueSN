<template>
  <div class="single-card-view">
    <Card
      variant="bordered"
      size="medium"
      class="flashcard-item flashcard-item--single"
    >
      <template #header>
        <div class="card-header">
          <span class="card-title card-title--single">{{ currentCard?.title }}</span>
          <div class="card-actions">
            <Button
              variant="ghost"
              size="small"
              icon="fileCopy"
              :iconSize="16"
              :title="i18n.copyTitle || '复制标题'"
              @click="$emit('copyTitle', currentCard)"
            />
            <Button
              variant="ghost"
              size="small"
              icon="contentCopy"
              :iconSize="16"
              :title="i18n.copyContent || '复制内容'"
              @click="$emit('copyContent', currentCard)"
            />
            <Button
              v-if="!hideActions"
              variant="ghost"
              size="small"
              icon="edit"
              :iconSize="16"
              :title="i18n.editCard || '编辑'"
              @click="$emit('edit', currentCard)"
            />
            <Button
              v-if="!hideActions"
              variant="danger"
              size="small"
              icon="delete"
              :iconSize="16"
              :title="i18n.deleteCard || '删除'"
              @click="$emit('delete', currentCard)"
            />
          </div>
        </div>
      </template>
      <div class="card-content">
        {{ currentCard?.content }}
      </div>
      <template #footer>
        <div class="card-footer card-footer--single">
          <div class="card-footer__meta">
            <span class="tag tag-small tag-info">{{ currentCard?.category }}</span>
            <span class="tag tag-small tag-contrast">{{ i18n.practiceCount || '练习' }}: {{ currentCard?.practiceCount || 0 }}</span>
          </div>
          <Button
            variant="primary"
            size="small"
            icon="play"
            :iconSize="14"
            :title="i18n.play || '播放'"
            @click="$emit('play', currentCard)"
          >
            {{ i18n.play || '播放' }}
          </Button>
        </div>
      </template>
    </Card>

    <div
      v-if="!hideNavigation"
      class="card-navigation"
    >
      <Button
        variant="ghost"
        icon="chevronLeft"
        :disabled="currentIndex === 0"
        :title="i18n.previous || '上一个'"
        @click="$emit('previous')"
      />
      <Button
        variant="ghost"
        icon="shuffle"
        :title="i18n.randomCard || '随机'"
        @click="$emit('random')"
      />
      <span class="tag tag-rounded">{{ currentIndex + 1 }} / {{ totalCards }}</span>
      <Button
        variant="ghost"
        icon="chevronRight"
        :disabled="currentIndex === totalCards - 1"
        :title="i18n.next || '下一个'"
        @click="$emit('next')"
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
import Card from "@/components/Card.vue"

withDefaults(
  defineProps<{
    currentCard: Flashcard | null
    currentIndex: number
    totalCards: number
    i18n: I18n
    hideNavigation?: boolean
    hideActions?: boolean
  }>(),
  {
    hideNavigation: false,
    hideActions: false,
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
