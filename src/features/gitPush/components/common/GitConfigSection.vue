<!-- gitPush Git 配置管理面板：查看/编辑/新增/删除 + 复制/打开配置文件（全局或项目级作用域） -->
<template>
  <div
    class="gp-cfg"
    @keydown.enter.stop
    @keydown.escape.stop
  >
    <!-- 顶部行：配置项计数 + 新增按钮 -->
    <div class="gp-cfg-header">
      <!-- 配置项计数："N 项配置" -->
      <span
        v-if="entries.length > 0"
        class="gp-cfg-count"
      >{{ i18n.gitConfigCount.replace("{0}", String(entries.length)) }}</span>
      <div class="gp-grow" />
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        @click="toggleAdd"
      >
        <Icon
          :icon="showAdd ? 'mdi:close' : 'mdi:plus'"
          height="12"
        />
        <!-- 按钮文案："新增配置项"，展开态变为"取消" -->
        <span>{{ showAdd ? i18n.cancel : i18n.gitConfigAddEntry }}</span>
      </button>
    </div>

    <!-- 加载态 -->
    <div
      v-if="loading"
      class="gp-cfg-state"
    >
      <Icon
        icon="mdi:loading"
        height="14"
        class="gp-spin"
      />
      <!-- 加载提示文案："查询中..." -->
      <span>{{ i18n.gitConfigLoading }}</span>
    </div>

    <!-- 错误态 -->
    <div
      v-else-if="error"
      class="gp-cfg-state gp-cfg-state--error"
    >
      <Icon
        icon="mdi:alert-outline"
        height="14"
      />
      <span>{{ error }}</span>
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        @click="load"
      >
        <Icon
          icon="mdi:refresh"
          height="12"
        />
        <!-- 按钮文案："重试" -->
        <span>{{ i18n.gitConfigRetry }}</span>
      </button>
    </div>

    <!-- 空态 -->
    <div
      v-else-if="entries.length === 0"
      class="gp-cfg-state"
    >
      <!-- 空状态文案："暂未配置全局 Git 信息" -->
      <span>{{ i18n.gitConfigEmpty }}</span>
    </div>

    <!-- 配置列表 -->
    <div
      v-else
      class="gp-cfg-list"
    >
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="gp-cfg-item"
      >
        <!-- 展示态：key + 说明 + value + 操作按钮 -->
        <template v-if="editingKey !== entry.key">
          <span class="gp-cfg-key">{{ entry.key }}</span>
          <span
            v-if="entry.desc"
            class="gp-cfg-desc"
          >{{ entry.desc }}</span>
          <span class="gp-cfg-value">{{ entry.value }}</span>
          <div class="gp-grow" />
          <!-- 编辑按钮（tooltip："编辑"） -->
          <button
            class="gp-cfg-act"
            :title="i18n.edit"
            @click="startEdit(entry)"
          >
            <Icon
              icon="mdi:pencil-outline"
              height="12"
            />
          </button>
          <!-- 删除按钮（tooltip 随两态确认变化："删除" / "确认删除？"） -->
          <button
            class="gp-cfg-act"
            :class="{ 'gp-cfg-act--danger': deleteConfirmKey === entry.key }"
            :title="deleteConfirmKey === entry.key ? i18n.gitConfigDeleteConfirm : i18n.gitConfigDelete"
            @click="requestDelete(entry.key)"
          >
            <Icon
              :icon="deleteConfirmKey === entry.key ? 'mdi:check' : 'mdi:trash-can-outline'"
              height="12"
            />
          </button>
        </template>
        <!-- 编辑态：key 只读 + value 输入 + 保存/取消 -->
        <template v-else>
          <span class="gp-cfg-key gp-cfg-key--edit">{{ entry.key }}</span>
          <input
            v-model="editValue"
            class="gp-cfg-input"
            :placeholder="i18n.gitConfigValuePlaceholder"
          />
          <!-- 保存按钮（tooltip："保存"） -->
          <button
            class="gp-cfg-act gp-cfg-act--save"
            :disabled="busy"
            :title="i18n.save"
            @click="saveEdit"
          >
            <Icon
              icon="mdi:check"
              height="12"
            />
          </button>
          <!-- 取消按钮（tooltip："取消"） -->
          <button
            class="gp-cfg-act"
            :disabled="busy"
            :title="i18n.cancel"
            @click="cancelEdit"
          >
            <Icon
              icon="mdi:close"
              height="12"
            />
          </button>
        </template>
      </div>
    </div>

    <!-- 新增表单：预设下拉 + key 输入 + value 输入 + 添加按钮 -->
    <div
      v-if="showAdd"
      class="gp-cfg-add"
    >
      <select
        class="gp-cfg-select"
        :value="presetSelect"
        @change="onPresetChange"
      >
        <!-- 选项文案："选择常用键..." -->
        <option value="">{{ i18n.gitConfigPresetPlaceholder }}</option>
        <option
          v-for="preset in GIT_PRESET_KEYS"
          :key="preset.key"
          :value="preset.key"
        >{{ preset.label }} ({{ preset.key }})</option>
      </select>
      <input
        v-model="newKey"
        class="gp-cfg-input gp-cfg-input--key"
        :placeholder="i18n.gitConfigKeyPlaceholder"
      />
      <input
        v-model="newValue"
        class="gp-cfg-input"
        :placeholder="i18n.gitConfigValuePlaceholder"
      />
      <!-- 添加按钮文案："添加" -->
      <button
        class="vp-btn vp-btn--primary vp-btn--sm"
        :disabled="busy"
        @click="addEntry"
      >
        <Icon
          icon="mdi:plus"
          height="12"
        />
        <span>{{ i18n.gitConfigAdd }}</span>
      </button>
    </div>

    <!-- 底部操作栏：复制全部 + 打开配置文件 -->
    <div
      v-if="entries.length > 0"
      class="gp-cfg-footer"
    >
      <div class="gp-grow" />
      <!-- 复制全部按钮，点击后短暂变为"已复制" -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        @click="handleCopy"
      >
        <Icon
          :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
          height="12"
        />
        <span>{{ copied ? i18n.copied : i18n.gitConfigCopyAll }}</span>
      </button>
      <!-- 打开配置文件按钮（用系统编辑器打开 .gitconfig） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        @click="handleOpenFile"
      >
        <Icon
          icon="mdi:file-document-edit-outline"
          height="12"
        />
        <span>{{ i18n.gitConfigOpenFile }}</span>
      </button>
    </div>

    <!-- 操作反馈消息 -->
    <div
      v-if="msg"
      class="gp-cfg-msg"
    >{{ msg }}</div>

    <!-- 面板说明 -->
    <div class="gp-cfg-hint">
      <!-- 提示文案："修改会立即写入 Git 配置文件" -->
      {{ i18n.gitConfigManageHint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { onMounted, ref } from "vue"
import type { GitPushManager } from "../../types"
import type { GitConfigEntry } from "../../types/gitConfigDesc"
import { GIT_PRESET_KEYS, parseGitConfigText } from "../../types/gitConfigDesc"
import { copyToClipboard } from "@/utils/domUtils"
import { getErrorMessage } from "@/utils/stringUtils"
import { openLocalPath } from "../../utils"

/** Git 配置作用域：全局（~/.gitconfig）或项目级（<project>/.git/config） */
type GitConfigScope = "global" | "local"

const props = defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
  scope: GitConfigScope
  projectPath?: string
}>()

const entries = ref<GitConfigEntry[]>([])
const rawText = ref("")
const filePath = ref("")
const loading = ref(true)
const error = ref("")
const editingKey = ref("")
const editValue = ref("")
const deleteConfirmKey = ref("")
const showAdd = ref(false)
const presetSelect = ref("")
const newKey = ref("")
const newValue = ref("")
const busy = ref(false)
const msg = ref("")
const copied = ref(false)

/** 按作用域写入配置项 */
async function setConfig(key: string, value: string) {
  if (props.scope === "global") {
    await props.manager.setGitGlobalConfig(key, value)
  } else {
    await props.manager.setProjectGitConfig(props.projectPath || "", key, value)
  }
}

/** 按作用域删除配置项 */
async function unsetConfig(key: string) {
  if (props.scope === "global") {
    await props.manager.unsetGitGlobalConfig(key)
  } else {
    await props.manager.unsetProjectGitConfig(props.projectPath || "", key)
  }
}

/** 加载对应作用域的 Git 配置并解析为条目列表 */
async function load() {
  loading.value = true
  error.value = ""
  try {
    if (props.scope === "global") {
      rawText.value = await props.manager.getGitGlobalConfig()
      filePath.value = props.manager.getGitConfigFilePath()
    } else {
      rawText.value = await props.manager.getProjectGitConfig(props.projectPath || "")
      filePath.value = props.manager.getProjectGitConfigFilePath(props.projectPath || "")
    }
    entries.value = parseGitConfigText(rawText.value)
  } catch (e: unknown) {
    error.value = getErrorMessage(e) || props.i18n.gitConfigLoadFailed
  } finally {
    loading.value = false
  }
}

/** 显示操作反馈并 2 秒后清除 */
function flashMsg(text: string) {
  msg.value = text
  setTimeout(() => { msg.value = "" }, 2000)
}

/** 进入编辑态（仅允许修改 value，key 保持只读） */
function startEdit(entry: GitConfigEntry) {
  editingKey.value = entry.key
  editValue.value = entry.value
}

/** 取消编辑 */
function cancelEdit() {
  editingKey.value = ""
  editValue.value = ""
}

/** 保存编辑后的配置值 */
async function saveEdit() {
  if (busy.value) return
  busy.value = true
  try {
    await setConfig(editingKey.value, editValue.value)
    editingKey.value = ""
    editValue.value = ""
    flashMsg(props.i18n.gitConfigUpdated)
    await load()
  } catch (e: unknown) {
    flashMsg(`${props.i18n.gitConfigOpFailed}: ${getErrorMessage(e)}`)
  } finally {
    busy.value = false
  }
}

/** 删除两态确认：首次点击进入确认态，再次点击执行删除 */
function requestDelete(key: string) {
  if (deleteConfirmKey.value !== key) {
    deleteConfirmKey.value = key
    return
  }
  void doDelete(key)
}

/** 执行删除配置项 */
async function doDelete(key: string) {
  if (busy.value) return
  busy.value = true
  try {
    await unsetConfig(key)
    deleteConfirmKey.value = ""
    flashMsg(props.i18n.gitConfigDeleted)
    await load()
  } catch (e: unknown) {
    flashMsg(`${props.i18n.gitConfigOpFailed}: ${getErrorMessage(e)}`)
  } finally {
    busy.value = false
  }
}

/** 展开/收起新增表单 */
function toggleAdd() {
  showAdd.value = !showAdd.value
  if (!showAdd.value) {
    presetSelect.value = ""
    newKey.value = ""
    newValue.value = ""
  }
}

/** 预设下拉选择后填充 key 输入框 */
function onPresetChange(e: Event) {
  const key = (e.target as HTMLSelectElement).value
  presetSelect.value = key
  newKey.value = key
}

/** 新增配置项（校验 key/value 非空后写入） */
async function addEntry() {
  const key = newKey.value.trim()
  const value = newValue.value.trim()
  if (!key) {
    flashMsg(props.i18n.gitConfigKeyRequired)
    return
  }
  if (!value) {
    flashMsg(props.i18n.gitConfigValueRequired)
    return
  }
  if (busy.value) return
  busy.value = true
  try {
    await setConfig(key, value)
    newKey.value = ""
    newValue.value = ""
    presetSelect.value = ""
    showAdd.value = false
    flashMsg(props.i18n.gitConfigAdded)
    await load()
  } catch (e: unknown) {
    flashMsg(`${props.i18n.gitConfigOpFailed}: ${getErrorMessage(e)}`)
  } finally {
    busy.value = false
  }
}

/** 复制全部配置文本到剪贴板（2 秒反馈"已复制"） */
async function handleCopy() {
  if (!rawText.value) return
  const ok = await copyToClipboard(rawText.value)
  if (ok) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

/** 打开系统默认编辑器编辑 Git 配置文件（复用 utils 的 openLocalPath 统一入口） */
async function handleOpenFile() {
  if (!filePath.value) return
  await openLocalPath(filePath.value)
}

onMounted(load)
</script>

<style lang="scss" scoped>
@use "../../styles/GitConfigSection";
</style>
