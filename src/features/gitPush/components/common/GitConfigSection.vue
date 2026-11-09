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
      <!-- 按钮文案："新增配置项"，展开态变为"取消" -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        :icon="showAdd ? 'close' : 'plus'"
        @click="toggleAdd"
      >
        {{ showAdd ? i18n.cancel : i18n.gitConfigAddEntry }}
      </Button>
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
      <!-- 按钮文案："重试" -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="refresh"
        @click="load"
      >
        {{ i18n.gitConfigRetry }}
      </Button>
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
          <!-- 编辑值输入（共享 Input，失焦后由保存按钮写入） -->
          <Input
            v-model="editValue"
            size="xsmall"
            class="gp-cfg-input-field"
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
      <!-- 预设键下拉：共享 Select（纯受控 ⇒ handler 内回写并填充 key 输入框） -->
      <Select
        class="gp-cfg-select-field"
        :model-value="presetSelect"
        :options="presetOptions"
        size="xsmall"
        :aria-label="i18n.gitConfigPresetPlaceholder"
        @update:model-value="onPresetChange"
      />
      <Input
        v-model="newKey"
        size="xsmall"
        class="gp-cfg-input-field gp-cfg-input-field--key"
        :placeholder="i18n.gitConfigKeyPlaceholder"
      />
      <Input
        v-model="newValue"
        size="xsmall"
        class="gp-cfg-input-field"
        :placeholder="i18n.gitConfigValuePlaceholder"
      />
      <!-- 添加按钮文案："添加" -->
      <Button
        variant="primary"
        size="xsmall"
        dense
        icon="plus"
        :disabled="busy"
        @click="addEntry"
      >
        {{ i18n.gitConfigAdd }}
      </Button>
    </div>

    <!-- 底部操作栏：复制全部 + 打开配置文件 -->
    <div
      v-if="entries.length > 0"
      class="gp-cfg-footer"
    >
      <div class="gp-grow" />
      <!-- 复制全部按钮，点击后短暂变为"已复制" -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        :icon="copied ? 'check' : 'contentCopy'"
        @click="handleCopy"
      >
        {{ copied ? i18n.copied : i18n.gitConfigCopyAll }}
      </Button>
      <!-- 打开配置文件按钮（用系统编辑器打开 .gitconfig） -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="pencilOutline"
        @click="handleOpenFile"
      >
        {{ i18n.gitConfigOpenFile }}
      </Button>
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
import type { GitPushManager } from "../../types"
import type {
  GitConfigEntry,
  GitConfigScope,
} from "../../types/gitConfigDesc"
import { Icon } from "@iconify/vue"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { getErrorMessage } from "@/utils/stringUtils"
import {
  GIT_PRESET_KEYS,
  parseGitConfigText,
} from "../../types/gitConfigDesc"
import { openLocalPath } from "../../utils"

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
function onPresetChange(value: string | number | boolean | null) {
  const key = value === null ? "" : String(value)
  presetSelect.value = key
  newKey.value = key
}

/** 预设键选项：空串占位 + 常用键列表（label 含键名提示，与原 option 文案一致） */
const presetOptions = computed(() => [
  {
    value: "",
    label: props.i18n.gitConfigPresetPlaceholder,
  },
  ...GIT_PRESET_KEYS.map((preset) => ({
    value: preset.key,
    label: `${preset.label} (${preset.key})`,
  })),
])

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
