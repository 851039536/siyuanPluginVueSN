<template>
  <div class="panel-header">
    <h3 class="panel-title">
      <IconWrapper
        name="image"
        :size="20"
      />
      {{ title }}
    </h3>
    <div class="header-actions">
      <Button
        variant="ghost"
        size="xsmall"
        icon="delete"
        :icon-size="16"
        :title="clearTitle"
        @click="$emit('clear')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

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
