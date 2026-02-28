<template>
  <div class="panel-header">
    <h3 class="panel-title">
      <IconWrapper name="image" :size="20" />
      {{ title }}
    </h3>
    <div class="header-actions">
      <Button
        variant="ghost"
        size="small"
        icon="delete"
        :icon-size="16"
        @click="$emit('clear')"
        :title="clearTitle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'
import Button from '@/components/Button.vue'

interface Props {
  title: string
  clearTitle: string
}

defineProps<Props>()
defineEmits<{
  clear: []
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
