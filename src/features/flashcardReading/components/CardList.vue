<template>
  <div class="card-list">
    <Card
      v-for="card in cards"
      :key="card.id"
      variant="bordered"
      size="small"
      class="flashcard-item"
    >
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ card.title }}</span>
          <div class="card-actions">
            <Button
              variant="ghost"
              size="small"
              icon="play"
              :iconSize="14"
              @click="$emit('play', card)"
              :title="i18n.play || '播放'"
            />
            <Button
              variant="ghost"
              size="small"
              icon="contentCopy"
              :iconSize="14"
              @click="$emit('copyTitle', card)"
              :title="i18n.copyTitle || '复制单词'"
            />
            <Button
              variant="ghost"
              size="small"
              icon="contentCopy"
              :iconSize="14"
              @click="$emit('copyContent', card)"
              :title="i18n.copyContent || '复制内容'"
            />
            <Button
              variant="ghost"
              size="small"
              icon="edit"
              :iconSize="14"
              @click="$emit('edit', card)"
              :title="i18n.editCard || '编辑'"
            />
            <Button
              variant="danger"
              size="small"
              icon="delete"
              :iconSize="14"
              @click="$emit('delete', card)"
              :title="i18n.deleteCard || '删除'"
            />
          </div>
        </div>
      </template>
      <div class="card-content">{{ card.content }}</div>
      <template #footer>
        <span class="tag tag-small">{{ card.category }}</span>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from "@/components/Card.vue";
import Button from "@/components/Button.vue";
import type { Flashcard, I18n } from "../types";

defineProps<{
	cards: Flashcard[];
	i18n: I18n;
}>();

defineEmits<{
	play: [card: Flashcard];
	copyTitle: [card: Flashcard];
	copyContent: [card: Flashcard];
	edit: [card: Flashcard];
	delete: [card: Flashcard];
}>();
</script>
