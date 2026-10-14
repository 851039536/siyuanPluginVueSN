<!-- 扫描导入 Git 项目弹窗（自行调用目录选择器） -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-dialog--scan">
      <!-- 弹窗头部 -->
      <div class="gp-dialog-header">
        <!-- 弹窗标题："导入" -->
        <span class="gp-dialog-title">{{ i18n.importProject }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <!-- 扫描目录输入行 -->
        <div class="gp-form-group">
          <!-- 标签："扫描目录" -->
          <label class="gp-label">{{ i18n.scanDir }}</label>
          <div class="gp-path-row">
            <!-- 占位符："选择要递归扫描的目录..."；内容由父级 v-model 提供（上次扫描目录持久化预填） -->
            <Input
              v-model="scanDir"
              size="xsmall"
              :placeholder="i18n.scanDirPlaceholder"
              @keydown="$event.key === 'Enter' && $emit('startScan', scanDir)"
            />
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              @click="pickScanDir"
            >
              <Icon icon="mdi:folder-open" height="12" />
            </button>
          </div>
        </div>
        <div class="gp-scan-action-row">
          <!-- 按钮："扫描中..." / "开始扫描" -->
          <button
            class="vp-btn vp-btn--primary"
            :disabled="scanning || !scanDir.trim()"
            @click="$emit('startScan', scanDir)"
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
            <span>{{ scanning ? i18n.scanning : i18n.startScan }}</span>
          </button>
        </div>
        <!-- 扫描结果列表 -->
        <div
          v-if="results.length > 0"
          class="gp-scan-results"
        >
          <div class="gp-scan-results-header">
            <!-- 标题："扫描结果 (N)" -->
            <span class="gp-scan-count">{{ i18n.scanResults }} ({{ results.length }})</span>
            <!-- 按钮："全选" -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm gp-scan-select-all"
              @click="$emit('toggleSelectAll')"
            >
              {{ i18n.selectAll }}
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
                @change="$emit('toggleItem', repo.path)"
              />
              <div class="gp-scan-item-info">
                <span class="gp-scan-item-name">{{ repo.name }}</span>
                <span class="gp-scan-item-path">{{ repo.path }}</span>
              </div>
              <!-- 徽章："已导入" -->
              <span
                v-if="repo.alreadyImported"
                class="gp-scan-badge"
              >{{ i18n.imported }}</span>
            </label>
          </div>
        </div>
        <!-- 空结果提示："未找到 Git 仓库" -->
        <EmptyState
          v-else-if="!scanning && scanDir.trim() && results.length === 0"
          icon="mdi:folder-search-outline"
          :text="i18n.noScanResults"
          icon-size="36"
        />
        <!-- 错误信息 -->
        <div
          v-if="error"
          class="gp-error"
        >
          {{ error }}
        </div>
      </div>
      <!-- 底部操作栏 -->
      <div class="gp-dialog-footer">
        <!-- 按钮："取消" -->
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          {{ i18n.cancel }}
        </button>
        <!-- 按钮："导入选中 (N)" -->
        <button
          class="vp-btn vp-btn--primary"
          :disabled="selectedCount === 0"
          @click="$emit('importSelected')"
        >
          {{ `${i18n.importSelected} (${selectedCount})` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import EmptyState from "./EmptyState.vue"
import Input from "@/components/Input.vue"
import { pickDirectory } from "@/utils/electronDialog"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"

const props = defineProps<{
  i18n: Record<string, any>
  scanning: boolean
  error: string
  results: { path: string, name: string, alreadyImported?: boolean }[]
  selection: Record<string, boolean>
}>()

const emit = defineEmits<{
  "close": []
  "startScan": [dir: string]
  "toggleSelectAll": []
  "toggleItem": [path: string]
  "importSelected": []
}>()

/** 扫描目录：父级持有（持久化预填 + 扫描成功回写），本组件仅双向绑定 */
const scanDir = defineModel<string>("scanDir", { required: true })

// 弹窗打开时自动聚焦遮罩，使 Esc 关闭生效
// ⚠️ `rootRef` 必须保留为本地绑定：模板 `ref="rootRef"` 依赖它把根节点交给 composable 聚焦。
// TS 看不到「模板里的使用」，故以 void 显式消费，避免 noUnusedLocals 误判（下同各弹窗）。
const { rootRef } = useDialogKeyboard()
void rootRef

// 目录选择器直接写入扫描目录（经 v-model 回传父级，下次扫描成功后一并持久化）
async function pickScanDir() {
  const dir = await pickDirectory(props.i18n.selectScanDirTitle)
  if (dir) { scanDir.value = dir }
}

const selectedCount = computed(() =>
  Object.values(props.selection).filter(Boolean).length,
)
</script>
