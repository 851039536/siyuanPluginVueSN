<!-- 超级面板 AI 配置档案管理器：档案下拉选择、应用/保存/删除操作行 -->
<template>
  <div class="profile-manager">
    <!-- 下拉选择已保存档案（仅选中，不改动任何 AI 配置字段） -->
    <select
      class="setting-select profile-select"
      :value="selectedName"
      @change="handleSelect"
    >
      <!-- 占位选项文案："选择已保存的配置…" -->
      <option value="">{{ i18n.profileSelectPlaceholder }}</option>
      <option
        v-for="profile in profiles"
        :key="profile.name"
        :value="profile.name"
      >
        {{ profile.name }}
      </option>
    </select>

    <!-- 操作行：应用 / 删除所选档案 -->
    <div class="profile-actions">
      <Button
        size="small"
        variant="primary"
        :disabled="!hasSelection"
        @click="handleApply"
      >
        <!-- 按钮文案："应用所选档案"（整组回填并立即生效） -->
        {{ i18n.profileApply }}
      </Button>
      <Button
        size="small"
        variant="ghost"
        :disabled="!hasSelection"
        @click="handleDelete"
      >
        <!-- 按钮文案："删除所选档案" -->
        {{ i18n.profileDelete }}
      </Button>
    </div>

    <!-- 保存行：档案名称输入 + 保存按钮（同名覆盖） -->
    <div class="profile-save-row">
      <TextInput
        v-model="nameInput"
        class="profile-name-input"
        :placeholder="i18n.profileNamePlaceholder"
      />
      <Button
        size="small"
        variant="success"
        :disabled="!canSave"
        @click="handleSave"
      >
        <!-- 按钮文案："保存当前配置为档案" -->
        {{ i18n.profileSave }}
      </Button>
    </div>

    <div class="setting-desc">
      <!-- 说明文案：档案保存整套 AI 配置，同名覆盖；应用整组回填并立即生效 -->
      {{ i18n.profileManagerDesc }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiProfileConfig } from "@/types/ai"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import TextInput from "./TextInput.vue"

interface Props {
  profiles: AiProfileConfig[]
  i18n: Record<string, any>
}

interface Emits {
  (e: "save", name: string): void
  (e: "apply", name: string): void
  (e: "delete", name: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 下拉当前选中的档案名 */
const selectedName = ref("")
/** 保存档案使用的名称输入（选中档案时同步填充，便于同名覆盖保存） */
const nameInput = ref("")

const hasSelection = computed(() =>
  selectedName.value !== "" && props.profiles.some((p) => p.name === selectedName.value),
)

const canSave = computed(() => nameInput.value.trim() !== "")

const handleSelect = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  selectedName.value = value
  // 选择已有档案时同步名称，点击保存即覆盖该档案
  nameInput.value = value
}

const handleApply = () => {
  if (hasSelection.value) {
    emit("apply", selectedName.value)
  }
}

const handleDelete = () => {
  if (hasSelection.value) {
    emit("delete", selectedName.value)
  }
}

const handleSave = () => {
  const name = nameInput.value.trim()
  if (!name) {
    return
  }
  emit("save", name)
  // 保存成功后将该档案置为选中态，方便继续编辑/覆盖
  selectedName.value = name
}

// 档案被删除或外部重置后，清理失效的选中态
watch(
  () => props.profiles,
  (profiles) => {
    if (selectedName.value && !profiles.some((p) => p.name === selectedName.value)) {
      selectedName.value = ""
    }
  },
)
</script>

<style lang="scss" scoped>
@use "../styles/AiProfileManager.scss";
</style>
