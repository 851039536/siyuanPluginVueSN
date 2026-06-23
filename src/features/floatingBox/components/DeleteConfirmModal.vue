<template>
  <div
    v-if="targetId"
    class="vp-overlay"
    @click="$emit('cancel')"
    @keydown.escape="$emit('cancel')"
  >
    <div
      class="vp-modal vp-modal--small"
      @click.stop
    >
      <div class="vp-modal-header">
        <div class="vp-modal-title">
          <IconWrapper
            name="delete"
            :size="20"
            class="vp-modal-icon vp-modal-icon--danger"
          />
          <h2>{{ i18n?.deleteConfirmTitle || '确认删除' }}</h2>
        </div>
        <Button
          variant="ghost"
          icon="close"
          size="small"
          @click="$emit('cancel')"
        />
      </div>
      <div class="vp-modal-body">
        <p class="vp-delete-msg">
          {{ i18n?.deleteConfirmMsg || '确定要删除此提示词吗？此操作不可撤销。' }}
        </p>
        <div class="vp-form-actions">
          <Button
            variant="secondary"
            size="small"
            @click="$emit('cancel')"
          >
            {{ i18n?.cancel || '取消' }}
          </Button>
          <Button
            variant="danger"
            size="small"
            @click="$emit('confirm')"
          >
            {{ i18n?.deleteConfirmOK || '确认删除' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  targetId: string | null
  i18n?: Record<string, string>
}>()

defineEmits<{
  (e: "confirm"): void
  (e: "cancel"): void
}>()
</script>

<style lang="scss" scoped>
@use '../styles/PromptsModal.scss';
</style>
