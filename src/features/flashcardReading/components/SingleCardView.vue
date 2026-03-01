<template>
  <div class="single-card-view">
    <div class="flashcard-large">
      <div class="card-title-large">{{ currentCard?.title }}</div>
      <div class="card-content-large">{{ currentCard?.content }}</div>
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
        @click.stop="$emit('previous')"
        :title="i18n.previous || '上一个'"
      />
      <Button
        variant="ghost"
        icon="shuffle"
        @click.stop="$emit('random')"
        :title="i18n.randomCard || '随机'"
      />
      <span class="tag tag-rounded">{{ currentIndex + 1 }} / {{ totalCards }}</span>
      <Button
        variant="ghost"
        icon="chevronRight"
        :disabled="currentIndex === totalCards - 1"
        @click.stop="$emit('next')"
        :title="i18n.next || '下一个'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'
import type { Flashcard, I18n } from '../types'

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
