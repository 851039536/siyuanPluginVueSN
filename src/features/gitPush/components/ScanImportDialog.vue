<!-- 扫描导入 Git 项目弹窗 -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div
      class="gp-dialog"
      style="width: 520px;"
    >
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">{{ i18n.importProject || '导入' }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <div class="gp-form-group">
          <label class="gp-label">{{ i18n.scanDir || '扫描目录' }}</label>
          <div class="gp-path-row">
            <Input
              v-model="localScanDir"
              size="xsmall"
              :placeholder="i18n.scanDirPlaceholder || '选择要递归扫描的目录...'"
              @keydown="$event.key === 'Enter' && $emit('start-scan', localScanDir)"
            />
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              @click="$emit('pick-scan-dir')"
            >
              <Icon icon="mdi:folder-open" height="12" />
            </button>
          </div>
        </div>
        <div style="display: flex; justify-content: center; margin-top: 4px;">
          <button
            class="vp-btn vp-btn--primary"
            :disabled="scanning || !localScanDir.trim()"
            @click="$emit('start-scan', localScanDir)"
          >
            <Icon
              v-if="scanning"
              icon="mdi:loading"
              class="gp-spin"
              height="12"
            />
            <Icon
              v-else
              icon="mdi:magnify"
              height="12"
            />
            <span>{{ scanning ? (i18n.scanning || '扫描中...') : (i18n.startScan || '开始扫描') }}</span>
          </button>
        </div>
        <div
          v-if="results.length > 0"
          class="gp-scan-results"
        >
          <div class="gp-scan-results-header">
            <span class="gp-scan-count">{{ i18n.scanResults || '扫描结果' }} ({{ results.length }})</span>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              style="font-size:10px;"
              @click="$emit('toggle-select-all')"
            >
              {{ i18n.selectAll || '全选' }}
            </button>
          </div>
          <div
            v-for="repo in results"
            :key="repo.path"
            class="gp-scan-item"
          >
            <label
              class="gp-scan-item-row"
              :class="{ 'gp-scan-imported': repo.alreadyImported }"
            >
              <input
                type="checkbox"
                :checked="selection[repo.path] || false"
                :disabled="repo.alreadyImported"
                @change="$emit('toggle-item', repo.path)"
              />
              <div class="gp-scan-item-info">
                <span class="gp-scan-item-name">{{ repo.name }}</span>
                <span class="gp-scan-item-path">{{ repo.path }}</span>
              </div>
              <span
                v-if="repo.alreadyImported"
                class="gp-scan-badge"
              >{{ i18n.imported || '已导入' }}</span>
            </label>
          </div>
        </div>
        <div
          v-else-if="!scanning && localScanDir.trim() && results.length === 0"
          class="gp-empty"
          style="padding:20px 0;"
        >
          <Icon
            icon="mdi:folder-search-outline"
            width="36"
            height="36"
          />
          <div class="gp-empty-text">
            {{ i18n.noScanResults || '未找到 Git 仓库' }}
          </div>
        </div>
        <div
          v-if="error"
          class="gp-error"
        >
          {{ error }}
        </div>
      </div>
      <div class="gp-dialog-footer">
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          {{ i18n.cancel || '取消' }}
        </button>
        <button
          class="vp-btn vp-btn--primary"
          :disabled="selectedCount === 0"
          @click="$emit('import-selected')"
        >
          {{ `${i18n.importSelected || '导入选中'} (${selectedCount})` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
  watch,
} from "vue"
import Input from "@/components/Input.vue"
import { useDialogKeyboard } from "../composables/useDialogKeyboard"

const props = defineProps<{
  i18n: Record<string, any>
  scanning: boolean
  error: string
  results: { path: string, name: string, alreadyImported?: boolean }[]
  selection: Record<string, boolean>
  scanDir: string
}>()

const emit = defineEmits<{
  "close": []
  "pick-scan-dir": []
  "start-scan": [dir: string]
  "toggle-select-all": []
  "toggle-item": [path: string]
  "import-selected": []
}>()

const localScanDir = ref(props.scanDir)

const { rootRef } = useDialogKeyboard()

// 目录选择器回填路径
watch(() => props.scanDir, (v) => {
  localScanDir.value = v
})

const selectedCount = computed(() =>
  Object.values(props.selection).filter(Boolean).length,
)
</script>
