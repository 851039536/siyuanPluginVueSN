<!--
  极简浏览器 — 设置弹窗：配置主页网址（自包含：onMounted 加载、保存直接写存储层）
-->
<template>
  <div
    class="mb-settings-mask"
    @click.self="emit('close')"
  >
    <div class="mb-settings-panel">
      <div class="mb-settings-header">
        <!-- 弹窗标题："设置" -->
        <span class="mb-settings-title">{{ i18n.settingsTitle }}</span>
        <Button
          icon="close"
          variant="ghost"
          size="xsmall"
          @click="emit('close')"
        />
      </div>

      <div class="mb-settings-body">
        <div class="mb-settings-field">
          <label class="mb-settings-label">
            <!-- 字段名："主页网址" -->
            {{ i18n.homeUrl }}
          </label>
          <input
            v-model="homeUrl"
            class="mb-settings-input"
            type="text"
            spellcheck="false"
            :placeholder="i18n.homeUrlPlaceholder"
          >
          <span class="mb-settings-desc">
            <!-- 说明："留空时以收藏列表作为主页" -->
            {{ i18n.homeUrlDesc }}
          </span>
        </div>
      </div>

      <div class="mb-settings-footer">
        <Button
          variant="ghost"
          size="small"
          @click="emit('close')"
        >
          <!-- 按钮："取消" -->
          {{ i18n.cancel }}
        </Button>
        <Button
          variant="primary"
          size="small"
          :loading="saving"
          @click="handleSave"
        >
          <!-- 按钮："保存" -->
          {{ i18n.save }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import type { I18n } from "../types"
import {
  browserSettings,
  saveBrowserSettings,
} from "../composables/useBrowserState"

const props = defineProps<{
  i18n: I18n
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "saved"): void
}>()

const homeUrl = ref("")
const saving = ref(false)

onMounted(() => {
  homeUrl.value = browserSettings.value.homeUrl
})

const handleSave = async () => {
  saving.value = true
  try {
    // 合并保存：只改 homeUrl，保留 sidebarWidth 等其他字段
    const ok = await saveBrowserSettings({
      ...browserSettings.value,
      homeUrl: homeUrl.value.trim(),
    })
    emit(ok ? "saved" : "saveFailed")
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss">
@use '../styles/SettingsDialog.scss';
</style>
