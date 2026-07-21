<!-- Skills 查看器 — 复制 Skill 到其他工具弹窗 -->
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
            name="list"
            :size="16"
          />
          <span class="sv-modal-title">{{ i18n.copySkillTitle || '复制 Skill 到其他工具' }}</span>
        </div>
        <div class="sv-modal-body">
          <p>{{ i18n.copySkillConfirm || '选择目标 AI 编程工具，将当前 Skill 复制到对应 skills 目录' }}</p>
          <p
            v-if="sourceSkill"
            class="sv-modal-skill-name"
          >
            {{ sourceSkill.name }}
          </p>
          <div class="sv-modal-tool-select">
            <div
              v-for="tool in targetTools"
              :key="tool.id"
              class="sv-modal-tool-option"
              :class="{ active: selectedToolId === tool.id }"
              :style="{ '--tool-color': tool.color }"
              @click="selectedToolId = tool.id"
            >
              <span class="sv-modal-tool-option-icon"><IconWrapper :name="tool.icon" :size="16" /></span>
              <span class="sv-modal-tool-option-name">{{ tool.name }}</span>
            </div>
          </div>
        </div>
        <div class="sv-modal-footer">
          <SiButton
            variant="ghost"
            size="xsmall"
            @click="$emit('cancel')"
          >
            {{ i18n.cancel || '取消' }}
          </SiButton>
          <SiButton
            variant="primary"
            size="xsmall"
            :loading="loading"
            :disabled="!selectedToolId"
            @click="$emit('confirm', selectedToolId!)"
          >
            {{ i18n.copyTo || '复制到' }} {{ selectedToolId && toolNameMap.get(selectedToolId) }}
          </SiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AIToolType } from "../types/SkillsViewerManager"
import type { SkillInfo } from "../types/SkillsViewerManager"
import { computed, ref, watch } from "vue"
import SiButton from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { AI_TOOLS } from "../types/SkillsViewerManager"

interface Props {
  visible: boolean
  sourceSkill: SkillInfo | null
  loading: boolean
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  confirm: [targetToolId: AIToolType]
  cancel: []
}>()

const selectedToolId = ref<AIToolType | null>(null)

const targetTools = computed(() =>
  AI_TOOLS.filter((t) => t.id !== props.sourceSkill?.tool),
)

const toolNameMap = new Map<AIToolType, string>(
  AI_TOOLS.map((t) => [t.id, t.name]),
)

watch(() => props.visible, (v) => {
  if (v) selectedToolId.value = null
})
</script>

<style scoped lang="scss">
@use "../styles/CopySkillModal.scss";
@use "../styles/index.scss";
</style>
