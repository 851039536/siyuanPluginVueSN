<!-- Skills 管理 — 删除确认弹窗（外壳复用共享 Dialog） -->
<template>
  <Dialog
    :visible="visible"
    size="small"
    :close-label="i18n.close"
    @update:visible="$emit('cancel')"
  >
    <!-- 标题栏：警告图标 + 标题 -->
    <template
      #header="{
        class: titleClass, headerId,
      }"
    >
      <IconWrapper
        class="sv-modal-icon"
        name="warning"
        :size="16"
      />
      <span
        :id="headerId"
        :class="titleClass"
      >{{ i18n.deleteSkillTitle }}</span>
    </template>

    <div class="sv-modal-body">
      <!-- 删除确认提示 -->
      <p>{{ i18n.deleteSkillConfirm }}</p>
      <p class="sv-modal-skill-name">
        {{ skillName }}
      </p>
      <p class="sv-modal-skill-path">
        {{ skillPath }}
      </p>
    </div>

    <template #footer>
      <!-- 取消按钮 -->
      <Button
        variant="ghost"
        size="xsmall"
        @click="$emit('cancel')"
      >
        {{ i18n.cancel }}
      </Button>
      <!-- 确认删除按钮 -->
      <Button
        variant="danger"
        size="xsmall"
        :loading="loading"
        @click="$emit('confirm')"
      >
        {{ i18n.confirmDelete }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  visible: boolean
  skillName: string
  skillPath: string
  loading: boolean
  i18n: Record<string, string>
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<style scoped lang="scss">
@use "../styles/modal";
</style>
