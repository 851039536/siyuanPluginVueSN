<!-- Skills 管理 — 复制 Skill 到其他工具弹窗（外壳复用共享 Dialog） -->
<template>
  <Dialog
    :visible="visible"
    size="small"
    :close-label="i18n.close"
    @update:visible="$emit('cancel')"
  >
    <!-- 标题栏：列表图标 + 标题 -->
    <template
      #header="{
        class: titleClass, headerId,
      }"
    >
      <IconWrapper
        class="sv-modal-icon"
        name="list"
        :size="16"
      />
      <span
        :id="headerId"
        :class="titleClass"
      >{{ i18n.copySkillTitle }}</span>
    </template>

    <div class="sv-modal-body">
      <!-- 复制说明 -->
      <p>{{ i18n.copySkillConfirm }}</p>
      <p
        v-if="sourceSkill"
        class="sv-modal-skill-name"
      >
        {{ sourceSkill.name }}
      </p>
      <div
        class="sv-modal-tool-select"
        role="group"
        :aria-label="i18n.copySkillTitle"
      >
        <!-- 目标工具选项：可点击 + 可键盘操作（Enter/空格）的单选按钮 -->
        <div
          v-for="tool in targetTools"
          :key="tool.id"
          class="sv-modal-tool-option"
          :class="{ active: selectedToolId === tool.id }"
          :style="{ '--tool-color': tool.color }"
          role="button"
          tabindex="0"
          :aria-pressed="selectedToolId === tool.id"
          :aria-label="tool.name"
          @click="selectedToolId = tool.id"
          @keydown.enter.prevent="selectedToolId = tool.id"
          @keydown.space.prevent="selectedToolId = tool.id"
        >
          <span class="sv-modal-tool-option-icon"><IconWrapper
            :name="tool.icon"
            :size="16"
          /></span>
          <span class="sv-modal-tool-option-name">{{ tool.name }}</span>
        </div>
      </div>
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
      <!-- 复制确认按钮（显示目标工具名） -->
      <Button
        variant="primary"
        size="xsmall"
        :loading="loading"
        :disabled="!selectedToolId"
        @click="selectedToolId && $emit('confirm', selectedToolId)"
      >
        {{ i18n.copyTo }} {{ selectedToolId && getAITool(selectedToolId)?.name }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { SkillInfo } from "../../SkillsManager"
import type { AIToolType } from "@/config/aiTools"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  AI_TOOLS,
  getAITool,
} from "@/config/aiTools"

interface Props {
  visible: boolean
  sourceSkill: SkillInfo | null
  loading: boolean
  i18n: Record<string, string>
}

const props = defineProps<Props>()

defineEmits<{
  confirm: [targetToolId: AIToolType]
  cancel: []
}>()

const selectedToolId = ref<AIToolType | null>(null)

const targetTools = computed(() =>
  AI_TOOLS.filter((t) => t.id !== props.sourceSkill?.tool),
)

watch(() => props.visible, (v) => {
  if (v) selectedToolId.value = null
})
</script>

<style scoped lang="scss">
@use "../styles/CopySkillModal.scss";
</style>
