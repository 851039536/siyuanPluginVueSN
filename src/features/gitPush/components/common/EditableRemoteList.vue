<!-- 通用可编辑远程列表（仓库链接 / Git 远程共用：行内编辑 + 添加 + 删除 + 错误提示） -->
<template>
  <div
    v-if="rows.length"
    class="gp-remote-list"
  >
    <div
      v-for="row in rows"
      :key="row.key"
      class="gp-remote-row"
    >
      <Icon
        v-if="row.icon"
        :icon="row.icon"
        height="12"
      />
      <span class="gp-remote-name">{{ row.name }}</span>
      <template v-if="editKey === row.key">
        <Input
          v-model="editUrl"
          size="xsmall"
          class="gp-grow"
          @keydown.enter="submitEdit(row.key)"
          @keydown.escape="editKey = ''"
        />
        <!-- 按钮："保存" -->
        <button
          class="vp-btn vp-btn--primary vp-btn--xs"
          @click="submitEdit(row.key)"
        >
          {{ i18n.save }}
        </button>
        <!-- 按钮："取消" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--xs"
          @click="editKey = ''"
        >
          {{ i18n.cancel }}
        </button>
      </template>
      <template v-else>
        <span
          class="gp-remote-url"
          :title="row.url"
        >{{ row.url }}</span>
        <!-- 按钮：复制链接地址（仅传入 onCopy 回调时显示） -->
        <button
          v-if="onCopy"
          class="vp-btn vp-btn--ghost vp-btn--xs"
          :title="i18n.copyRepoLink"
          @click="onCopy(row.key)"
        >
          <Icon
            icon="mdi:content-copy"
            height="10"
          />
        </button>
        <!-- 按钮：下载到本地（仅传入 onDownload 回调时显示，克隆进行中转圈） -->
        <button
          v-if="onDownload"
          class="vp-btn vp-btn--ghost vp-btn--xs"
          :title="i18n.downloadRepo"
          :disabled="downloadingKey === row.key"
          @click="submitDownload(row.key)"
        >
          <Icon
            :icon="downloadingKey === row.key ? 'mdi:loading' : 'mdi:download-outline'"
            :class="{ 'gp-spin': downloadingKey === row.key }"
            height="10"
          />
        </button>
        <!-- 按钮：编辑（图标按钮，tooltip："编辑"） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--xs"
          :title="i18n.edit"
          @click="editKey = row.key; editUrl = row.url"
        >
          <Icon
            icon="mdi:pencil-outline"
            height="10"
          />
        </button>
        <!-- 按钮：删除（图标按钮，tooltip："删除"） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--xs gp-btn-danger"
          :title="i18n.delete"
          @click="onRemove(row.key)"
        >
          <Icon
            icon="mdi:delete-outline"
            height="10"
          />
        </button>
      </template>
    </div>
  </div>
  <!-- 空态提示（文案由父组件传入，如"暂无仓库链接"/"暂无远程仓库"） -->
  <div
    v-else
    class="gp-remote-empty"
  >
    {{ emptyText }}
  </div>
  <!-- 添加行：可选平台配齐后隐藏 -->
  <div
    v-if="addOptions.length > 0"
    class="gp-remote-add"
  >
    <Select
      v-model="newKey"
      size="xsmall"
      class="gp-remote-platform"
      :options="addOptions"
      :placeholder="i18n.selectPlatform"
    />
    <Input
      v-model="newUrl"
      size="xsmall"
      class="gp-grow"
      :placeholder="urlPlaceholder"
      @keydown.enter="submitAdd()"
    />
    <!-- 按钮："添加" -->
    <button
      class="vp-btn vp-btn--primary vp-btn--xs"
      :disabled="!newKey || !newUrl.trim()"
      @click="submitAdd"
    >
      {{ i18n.add }}
    </button>
  </div>
  <!-- 操作错误提示 -->
  <div
    v-if="error"
    class="gp-error gp-remote-error"
  >
    {{ error }}
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import { Icon } from "@iconify/vue"
import {
  onUnmounted,
  ref,
  watch,
} from "vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

/** 列表行：key 为唯一标识（平台 key / remote 名），name 为显示名，icon 可选 */
export interface RemoteRowItem {
  key: string
  name: string
  url: string
  icon?: string
}

const props = defineProps<{
  rows: RemoteRowItem[]
  addOptions: SelectOption[]
  emptyText: string
  urlPlaceholder: string
  error: string
  i18n: Record<string, any>
  /** 异步操作回调（camelCase 事件绑定，返回是否成功，成功后组件自行收敛输入态） */
  onAdd: (key: string, url: string) => Promise<boolean>
  onSaveEdit: (key: string, url: string) => Promise<boolean>
  onRemove: (key: string) => Promise<boolean>
  /** 可选：复制链接回调，仅传入时行内显示复制按钮 */
  onCopy?: (key: string) => void
  /** 可选：下载（克隆）回调，仅传入时行内显示下载按钮 */
  onDownload?: (key: string) => Promise<boolean>
}>()

// ── 行内编辑 / 添加行状态（自包含，父组件不感知） ──
const editKey = ref("")
const editUrl = ref("")
const newKey = ref("")
const newUrl = ref("")
// 正在下载（克隆）的行 key（驱动转圈图标与禁用态）
const downloadingKey = ref("")
// 组件卸载后跳过异步回调状态写入，避免克隆/保存等操作在弹窗关闭后污染已卸载实例
let disposed = false
onUnmounted(() => {
  disposed = true
})

// 当前选中项被占用/移除后自动切换到第一个可用选项（含首次初始化）
watch(() => props.addOptions, (opts) => {
  if (!opts.some((o) => o.value === newKey.value)) {
    newKey.value = String(opts[0]?.value ?? "")
  }
}, { immediate: true })

async function submitAdd(): Promise<void> {
  if (!newKey.value || !newUrl.value.trim()) {
    return
  }
  // 成功才清空 URL 输入，失败保留以便修正后重试
  if (await props.onAdd(newKey.value, newUrl.value.trim()) && !disposed) {
    newUrl.value = ""
  }
}

async function submitEdit(key: string): Promise<void> {
  // 成功才退出编辑态，失败保留输入并展示错误
  if (await props.onSaveEdit(key, editUrl.value) && !disposed) {
    editKey.value = ""
  }
}

async function submitDownload(key: string): Promise<void> {
  if (!props.onDownload || downloadingKey.value) {
    return
  }
  downloadingKey.value = key
  try {
    await props.onDownload(key)
  } finally {
    if (!disposed) {
      downloadingKey.value = ""
    }
  }
}
</script>
