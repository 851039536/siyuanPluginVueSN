<template>
  <div class="single-card-view">
    <div class="flashcard-large">
      <div class="card-title-large">
        {{ currentCard?.title }}
      </div>
      <div class="card-content-large">
        {{ currentCard?.content }}
      </div>
      <div class="card-meta-large">
        <span class="tag tag-info">{{ currentCard?.category }}</span>
        <span class="tag tag-success">{{ i18n.practiceCount || '练习次数' }}: {{ currentCard?.practiceCount || 0 }}</span>
      </div>
      <Button
        variant="primary"
        size="large"
        icon="play"
        @click="$emit('play', currentCard)"
      >
        {{ i18n.play || '播放' }}
      </Button>
    </div>

    <div class="card-navigation">
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

defineProps<{
  currentCard: Flashcard | null
  currentIndex: number
  totalCards: number
  i18n: I18n
}>()

defineEmits<{
  play: [card: Flashcard | null]
  previous: []
  next: []
  random: []
}>()
</script>
