<!-- AI 设置 - 「配置档案」Tab：整套 AI 配置的命名快照管理 -->
<template>
  <div class="ai-profile-settings">
    <SettingGroup>
      <template #label>
        <!-- 分组标签："配置档案" -->
        {{ i18n.aiProfileTitle }}
      </template>
      <AiProfileManager
        :profiles="profiles"
        :i18n="i18n"
        @save="$emit('save', $event)"
        @apply="$emit('apply', $event)"
        @delete="$emit('delete', $event)"
      />
    </SettingGroup>
  </div>
</template>

<script setup lang="ts">
import type { AiProfileConfig } from "@/types/ai"
import AiProfileManager from "./AiProfileManager.vue"
import SettingGroup from "./SettingGroup.vue"

interface Props {
  profiles: AiProfileConfig[]
  i18n: Record<string, any>
}

interface Emits {
  (e: "save", name: string): void
  (e: "apply", name: string): void
  (e: "delete", name: string): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>
