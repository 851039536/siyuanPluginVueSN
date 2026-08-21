<!-- Skills 查看器 — 删除确认弹窗 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="sv-modal-overlay"
      @click.self="$emit('cancel')"
    >
      <div class="sv-modal">
        <div class="sv-modal-header">
          <IconWrapper
            class="sv-modal-icon"
            name="warning"
            :size="16"
          />
          <!-- 弹窗标题："确认删除 Skill" -->
          <span class="sv-modal-title">{{ i18n.deleteSkillTitle }}</span>
        </div>
        <div class="sv-modal-body">
          <!-- 删除确认提示 -->
          <p>{{ i18n.deleteSkillConfirm }}</p>
          <p class="sv-modal-skill-name">{{ skillName }}</p>
          <p class="sv-modal-skill-path">{{ skillPath }}</p>
        </div>
        <div class="sv-modal-footer">
          <!-- 取消按钮 -->
          <SiButton
            variant="ghost"
            size="xsmall"
            @click="$emit('cancel')"
          >
            {{ i18n.cancel }}
          </SiButton>
          <!-- 确认删除按钮 -->
          <SiButton
            variant="danger"
            size="xsmall"
            :loading="loading"
            @click="$emit('confirm')"
          >
            {{ i18n.confirmDelete }}
          </SiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import SiButton from "@/components/Button.vue"
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
