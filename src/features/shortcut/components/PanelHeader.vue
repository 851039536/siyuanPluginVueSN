<template>
  <div class="shortcut-header">
    <Input
      :model-value="searchKeyword"
      :placeholder="placeholder"
      prefix-icon="search"
      size="medium"
      @update:model-value="$emit('update:searchKeyword', $event)"
    />
    <Button variant="primary" size="small" icon="add" :title="addTitle" @click="$emit('add')" />
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import Input from "@/components/Input.vue";

interface Props {
  searchKeyword: string;
  placeholder: string;
  addTitle: string;
}

defineProps<Props>();

defineEmits<{
  "update:searchKeyword": [value: string];
  add: [];
}>();
</script>

<style scoped lang="scss">
.shortcut-header {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}
</style>
