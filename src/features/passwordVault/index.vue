<!-- 密码箱主弹窗 — 登录/主列表容器 + 编排各子弹窗（表单/类别/改密/导出） -->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="password-vault-overlay"
        @click.self="closeDialog"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="password-vault-dialog"
            :class="{ 'is-login': !isLoggedIn }"
          >
            <!-- 登录界面 -->
            <PasswordVaultLogin
              v-if="!isLoggedIn"
              :is-first-time="isFirstTime"
              :password-hint="passwordHint"
              :login-error="loginError"
              @login="handleLogin"
              @close="closeDialog"
              @forgot-password="showForgotPasswordOptions"
            />

            <!-- 主界面 -->
            <div
              v-else
              class="main-container"
            >
              <div class="dialog-header">
                <div class="header-title">
                  <IconWrapper
                    name="settings"
                    :size="22"
                  />
                  <h2>密码箱</h2>
                  <span class="entry-count">{{ filteredEntries.length }}/{{ entries.length }}条</span>
                </div>
                <div class="header-actions">
                  <Button
                    class="close-btn"
                    icon="close"
                    variant="ghost"
                    size="xsmall"
                    @click="closeDialog"
                  />
                </div>
              </div>

              <div class="dialog-body">
                <!-- 分类筛选器 -->
                <div class="category-filter">
                  <div class="category-chips">
                    <button
                      v-for="cat in [{
                        id: 'all',
                        name: '全部',
                        color: '#b0aea5',
                      }, ...categories]"
                      :key="cat.id"
                      class="category-chip"
                      :class="{ active: selectedCategory === cat.id }"
                      :style="{ '--cat-color': cat.color }"
                      @click="selectedCategory = cat.id"
                    >
                      <span
                        class="chip-dot"
                        :style="{ backgroundColor: cat.color }"
                      ></span>
                      {{ cat.name }}
                    </button>
                  </div>
                  <Button
                    class="manage-categories-btn"
                    icon="settings"
                    variant="ghost"
                    size="xsmall"
                    title="管理类别"
                    @click="showCategoryManager = true"
                  />
                </div>

                <div class="entries-controls">
                  <IconWrapper
                    name="search"
                    :size="16"
                    class="search-icon"
                  />
                  <Input
                    v-model="searchQuery"
                    type="text"
                    placeholder="搜索名称、账号或描述..."
                    size="xsmall"
                  />
                  <Button
                    icon="download"
                    variant="ghost"
                    size="xsmall"
                    title="导出所有数据"
                    @click="openExportConfirm"
                  />
                  <Button
                    icon="add"
                    variant="primary"
                    size="xsmall"
                    title="添加密码"
                    @click="openAddModal"
                  />
                </div>

                <div class="entries-grid">
                  <EntryCard
                    v-for="entry in filteredEntries"
                    :key="entry.id"
                    :entry="entry"
                    @edit="editEntry"
                    @delete="deleteEntry"
                  />

                  <div
                    v-if="filteredEntries.length === 0"
                    class="no-entries"
                  >
                    {{ searchQuery ? '未找到匹配的条目' : '暂无密码条目，点击添加' }}
                  </div>
                </div>
              </div>

              <div class="dialog-footer">
                <Button
                  variant="ghost"
                  size="xsmall"
                  @click="showChangePasswordModal = true"
                >
                  <IconWrapper
                    name="pageLock"
                    :size="14"
                  />
                  修改密码
                </Button>
              </div>
            </div>

            <!-- 存储路径（底部栏） -->
            <div
              v-if="storagePath"
              class="storage-footer"
              title="点击复制存储路径"
              @click="copyStoragePath"
            >
              <span class="storage-footer-label">数据文件:</span>
              <span class="storage-footer-path">{{ storagePath }}</span>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- 添加/编辑条目弹窗 -->
  <EntryFormModal
    v-if="showAddModal"
    :visible="showAddModal"
    :editing-entry="editingEntry"
    :prefill="prefillData"
    @saved="closeAddModal"
    @close="closeAddModal"
  />

  <!-- 类别管理弹窗 -->
  <CategoryManagerModal
    v-if="showCategoryManager"
    :visible="showCategoryManager"
    @deleted="onCategoryDeleted"
    @close="showCategoryManager = false"
  />

  <!-- 修改主密码弹窗 -->
  <ChangePasswordModal
    v-if="showChangePasswordModal"
    :visible="showChangePasswordModal"
    @close="showChangePasswordModal = false"
  />

  <!-- 导出确认弹窗 -->
  <ExportModal
    v-if="showExportConfirm"
    :visible="showExportConfirm"
    @close="showExportConfirm = false"
  />
</template>

<script setup lang="ts">
import type { PasswordEntry } from "./types"
import type { PendingEntryData } from "./utils/parser"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { usePlugin } from "@/main"
import { copyToClipboard as copyToClipboardUtil } from "@/utils/domUtils"
import CategoryManagerModal from "./components/CategoryManagerModal.vue"
import ChangePasswordModal from "./components/ChangePasswordModal.vue"
import EntryCard from "./components/EntryCard.vue"
import EntryFormModal from "./components/EntryFormModal.vue"
import ExportModal from "./components/ExportModal.vue"
import PasswordVaultLogin from "./components/PasswordVaultLogin.vue"
import { usePasswordVaultAuth } from "./composables/usePasswordVaultAuth"
import { usePasswordVaultData } from "./composables/usePasswordVaultData"
import { pendingEntryData } from "./index"

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
  (e: "close"): void
}>()

const plugin = usePlugin()

// 共享状态与逻辑（数据层首次调用初始化 Storage，认证层复用同一状态）
const {
  isLoggedIn,
  entries,
  categories,
  storagePath,
  isEntryDuplicate,
  removeEntry,
} = usePasswordVaultData(plugin)
const {
  isFirstTime,
  passwordHint,
  loadMasterPasswordHash,
  login,
} = usePasswordVaultAuth()

// 视图状态
const loginError = ref("")
const searchQuery = ref("")
const selectedCategory = ref<string>("all")

// 弹窗开关
const showAddModal = ref(false)
const showCategoryManager = ref(false)
const showChangePasswordModal = ref(false)
const showExportConfirm = ref(false)

// 添加/编辑弹窗上下文
const editingEntry = ref<PasswordEntry | null>(null)
const prefillData = ref<PendingEntryData | null>(null)

// 过滤条目
const filteredEntries = computed(() => {
  const allEntries = entries.value
  const category = selectedCategory.value
  const query = searchQuery.value

  if (category === "all" && !query) {
    return allEntries
  }

  let result = allEntries
  if (category !== "all") {
    result = result.filter((entry) => entry.category === category)
  }
  if (query) {
    const lowerQuery = query.toLowerCase()
    result = result.filter(
      (entry) =>
        entry.name.toLowerCase().includes(lowerQuery)
        || entry.account.toLowerCase().includes(lowerQuery)
        || entry.description.toLowerCase().includes(lowerQuery),
    )
  }
  return result
})

// 登录
async function handleLogin(inputPassword: string, hint?: string) {
  loginError.value = await login(inputPassword, hint)
}

// 忘记密码 → 显示提示
function showForgotPasswordOptions() {
  if (passwordHint.value) {
    showMessage(`密码提示：${passwordHint.value}`, 5000, "info")
  } else {
    showMessage(
      "未设置密码提示。如需重置，请联系开发者或查看插件数据目录手动删除数据",
      5000,
      "info",
    )
  }
}

// 添加/编辑
const openAddModal = () => {
  editingEntry.value = null
  prefillData.value = null
  showAddModal.value = true
}

const editEntry = (entry: PasswordEntry) => {
  editingEntry.value = entry
  prefillData.value = null
  showAddModal.value = true
}

const closeAddModal = () => {
  showAddModal.value = false
  editingEntry.value = null
  prefillData.value = null
}

// 删除条目
async function deleteEntry(id: string) {
  const entry = entries.value.find((e) => e.id === id)
  if (!entry) return

  const confirmed = window.confirm(
    `确定要删除密码条目「${entry.name}」吗？此操作不可恢复。`,
  )
  if (!confirmed) return

  await removeEntry(id)
  showMessage("密码条目已删除", 2000, "info")
}

// 导出
function openExportConfirm() {
  if (!entries.value.length) {
    showMessage("没有数据可导出", 2000, "info")
    return
  }
  showExportConfirm.value = true
}

// 类别删除后：若当前筛选被删除则回退到全部
function onCategoryDeleted(categoryId: string) {
  if (selectedCategory.value === categoryId) {
    selectedCategory.value = "all"
  }
}

// 复制存储路径
const copyStoragePath = async () => {
  if (!storagePath.value) return
  const ok = await copyToClipboardUtil(storagePath.value)
  showMessage(ok ? "路径已复制" : "复制失败", 2000, ok ? "info" : "error")
}

// 关闭主弹窗（保持登录状态）
const closeDialog = () => {
  loginError.value = ""
  emit("update:visible", false)
  emit("close")
}

// 键盘事件：Esc 关闭最上层弹窗
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.visible) return
  if (event.key !== "Escape") return

  if (showCategoryManager.value) {
    showCategoryManager.value = false
  } else if (showChangePasswordModal.value) {
    showChangePasswordModal.value = false
  } else if (showExportConfirm.value) {
    showExportConfirm.value = false
  } else if (showAddModal.value) {
    closeAddModal()
  } else {
    closeDialog()
  }
}

// 打开弹窗时加载验证信息
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) await loadMasterPasswordHash()
  },
)

// 预填：去重命中则搜索定位，否则打开添加表单
function prefillFromPending(data: PendingEntryData) {
  if (isEntryDuplicate(data)) {
    searchQuery.value = ""
    selectedCategory.value = "all"
    setTimeout(() => {
      searchQuery.value = data.name
    }, 50)
    showMessage(`「${data.name}」已存在，已定位到该条目`, 2000, "info")
    pendingEntryData.value = null
    return
  }
  editingEntry.value = null
  prefillData.value = data
  showAddModal.value = true
  pendingEntryData.value = null
}

// 监听外部预填数据（登录后才处理）
watch(pendingEntryData, (data) => {
  if (data && isLoggedIn.value) prefillFromPending(data)
}, { immediate: true })

// 登录完成后检测待处理的预填数据
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn && pendingEntryData.value) prefillFromPending(pendingEntryData.value)
}, { immediate: true })

onMounted(() => {
  document.addEventListener("keydown", handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown)
})
</script>

<style lang="scss" scoped>
@use './styles/index.scss';
</style>
