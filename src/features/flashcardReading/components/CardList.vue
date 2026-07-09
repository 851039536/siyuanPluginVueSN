<!-- 单词阅读功能 - 卡片列表视图 -->
<template>
  <div class="card-list">
    <Card
      v-for="card in cards"
      :key="card.id"
      variant="bordered"
      size="xsmall"
      class="flashcard-item"
    >
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ card.title }}</span>
          <div class="card-actions">
            <Button
              variant="ghost"
              size="xsmall"
              icon="play"
              :iconSize="14"
              :title="t.play"
              @click="$emit('play', card)"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="contentCopy"
              :iconSize="14"
              :title="t.copyTitle"
              @click="$emit('copyTitle', card)"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="contentCopy"
              :iconSize="14"
              :title="t.copyContent"
              @click="$emit('copyContent', card)"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="edit"
              :iconSize="14"
              :title="t.editCard"
              @click="$emit('edit', card)"
            />
            <Button
              variant="danger"
              size="xsmall"
              icon="delete"
              :iconSize="14"
              :title="t.deleteCard"
              @click="$emit('delete', card)"
            />
          </div>
        </div>
      </template>
      <div class="card-content">
        {{ card.content }}
      </div>
      <template #footer>
        <div class="card-footer">
          <span class="tag tag-small">{{ card.category }}</span>
          <span class="tag tag-small tag-contrast">{{ t.practiceCount }}: {{ card.practiceCount || 0 }}</span>
        </div>
      </template>
    </Card>
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

const props = defineProps<{
  cards: Flashcard[]
  i18n: I18n
}>()

defineEmits<{
  play: [card: Flashcard]
  copyTitle: [card: Flashcard]
  copyContent: [card: Flashcard]
  edit: [card: Flashcard]
  delete: [card: Flashcard]
}>()

const t = useI18n(props.i18n)
</script>
