<!-- 单词阅读功能 - 单卡视图 -->
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
              size="xsmall"
              icon="fileCopy"
              :iconSize="16"
              :title="t.copyTitle || '复制标题'"
              @click="$emit('copyTitle', currentCard)"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="contentCopy"
              :iconSize="16"
              :title="t.copyContent"
              @click="$emit('copyContent', currentCard)"
            />
            <Button
              v-if="!hideActions"
              variant="ghost"
              size="xsmall"
              icon="edit"
              :iconSize="16"
              :title="t.editCard"
              @click="$emit('edit', currentCard)"
            />
            <Button
              v-if="!hideActions"
              variant="danger"
              size="xsmall"
              icon="delete"
              :iconSize="16"
              :title="t.deleteCard"
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
            <span class="tag tag-small tag-contrast">{{ t.practiceCount }}: {{ currentCard?.practiceCount || 0 }}</span>
          </div>
          <Button
            variant="primary"
            size="xsmall"
            icon="play"
            :iconSize="14"
            :title="t.play"
            @click="$emit('play', currentCard)"
          >
            {{ t.play }}
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
        :title="t.previous"
        @click="$emit('previous')"
      />
      <Button
        variant="ghost"
        icon="shuffle"
        :title="t.randomCard"
        @click="$emit('random')"
      />
      <span class="tag tag-rounded">{{ currentIndex + 1 }} / {{ totalCards }}</span>
      <Button
        variant="ghost"
        icon="chevronRight"
        :disabled="currentIndex === totalCards - 1"
        :title="t.next"
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
import { useI18n } from "../composables/useI18n"

const props = withDefaults(
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

const t = useI18n(props.i18n)
</script>

<style scoped lang="scss">
@use '../styles/SingleCardView.scss';
</style>
