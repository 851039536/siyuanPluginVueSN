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
                    class="help-btn"
                    icon="help"
                    variant="ghost"
                    size="small"
                    title="使用说明"
                    @click="showHelpDialog = true"
                  />
                  <Button
                    class="close-btn"
                    icon="close"
                    variant="ghost"
                    size="small"
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
                    size="small"
                    title="管理类别"
                    @click="openCategoryManager"
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
                    size="small"
                  />
                  <Button
                    icon="download"
                    variant="ghost"
                    size="small"
                    title="导出所有数据"
                    @click="exportAllData"
                  >
                    导出
                  </Button>
                  <Button
                    icon="add"
                    variant="primary"
                    size="small"
                    @click="openAddModal"
                  >
                    添加密码
                  </Button>
                </div>

                <div class="entries-grid">
                  <div
                    v-for="entry in filteredEntries"
                    :key="entry.id"
                    class="entry-card"
                  >
                    <div class="entry-header">
                      <div class="entry-title-wrapper">
                        <IconWrapper
                          name="file"
                          :size="18"
                          class="entry-icon"
                        />
                        <h3>{{ entry.name }}</h3>
                        <span
                          class="entry-category-tag"
                          :style="{
                            backgroundColor: `${getCategoryById(entry.category)?.color}20`,
                            color: getCategoryById(entry.category)?.color,
                          }"
                        >
                          {{ getCategoryById(entry.category)?.name || '未分类' }}
                        </span>
                      </div>
                      <div class="entry-actions">
                        <Button
                          variant="ghost"
                          size="small"
                          title="编辑"
                          @click="editEntry(entry)"
                        >
                          编辑
                        </Button>
                        <Button
                          icon="delete"
                          variant="ghost"
                          size="small"
                          title="删除"
                          @click="deleteEntry(entry.id)"
                        />
                      </div>
                    </div>
                    <div
                      class="entry-account"
                      @click="copyAccount(entry.account)"
                    >
                      <IconWrapper
                        name="file"
                        :size="14"
                      />
                      <span class="account-text">{{ entry.account }}</span>
                      <div class="action-hint">
                        <IconWrapper
                          name="contentCopy"
                          :size="12"
                        />
                        点击复制
                      </div>
                    </div>
                    <div class="entry-description">
                      {{ entry.description }}
                    </div>
                    <div class="entry-field">
                      <div class="field-label">
                        <IconWrapper
                          name="pageLock"
                          :size="14"
                        />
                        密码
                      </div>
                      <div
                        class="field-value"
                        @click="copyPassword(entry.password)"
                      >
                        <span class="password-mask">{{ showPasswords[entry.id] ? entry.password : '••••••••' }}</span>
                        <div class="action-hint">
                          <IconWrapper
                            name="contentCopy"
                            :size="12"
                          />
                          点击复制
                        </div>
                      </div>
                      <Button
                        :icon="showPasswords[entry.id] ? 'eye' : 'eyeOff'"
                        variant="ghost"
                        size="small"
                        @click.stop="togglePasswordVisibility(entry.id)"
                      />
                    </div>
                  </div>

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
                  size="small"
                  @click="openChangePasswordModal"
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

            <!-- 使用说明对话框 -->
            <HelpDialog
              :visible="showHelpDialog"
              :storage-path="storagePath"
              @close="showHelpDialog = false"
            />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Add/Edit Entry Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showAddModal"
        class="password-vault-overlay modal-overlay"
        @click="closeAddModal"
      >
        <Transition name="scale">
          <div
            v-if="showAddModal"
            class="password-vault-dialog small"
            @click.stop
          >
            <div class="dialog-header">
              <h2>{{ editingEntry ? '编辑密码' : '添加密码' }}</h2>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="closeAddModal"
              />
            </div>

            <div class="dialog-body">
              <form
                class="entry-form"
                @submit.prevent="saveEntry"
              >
                <div class="form-group">
                  <Select
                    v-model="entryForm.category"
                    label="类别"
                    :options="categories.map(cat => ({
                      value: cat.id,
                      label: cat.name,
                    }))"
                    required
                  />
                </div>

                <div class="form-group">
                  <Input
                    v-model="entryForm.name"
                    label="名称"
                    type="text"
                    placeholder="请输入名称（如：Google、GitHub等）"
                    required
                  />
                </div>

                <div class="form-group">
                  <Input
                    v-model="entryForm.account"
                    label="账号"
                    type="text"
                    placeholder="请输入账号"
                    required
                  />
                </div>

                <div class="form-group">
                  <Input
                    v-model="entryForm.password"
                    label="密码"
                    :type="showFormPassword ? 'text' : 'password'"
                    placeholder="请输入密码"
                    :show-password="true"
                    required
                  />
                </div>

                <div class="form-group">
                  <Input
                    v-model="entryForm.description"
                    type="textarea"
                    label="描述"
                    placeholder="请输入描述信息"
                    :rows="3"
                  />
                </div>

                <div class="form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    @click="closeAddModal"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                  >
                    保存
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Category Manager Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showCategoryManager"
        class="password-vault-overlay modal-overlay"
        @click="closeCategoryManager"
      >
        <Transition name="scale">
          <div
            v-if="showCategoryManager"
            class="password-vault-dialog category-manager"
            @click.stop
          >
            <div class="dialog-header">
              <h2>管理类别</h2>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="closeCategoryManager"
              />
            </div>

            <div class="dialog-body">
              <!-- 添加新类别 -->
              <div class="add-category-section">
                <h3>添加新类别</h3>
                <div class="add-category-form">
                  <Input
                    v-model="newCategory.name"
                    type="text"
                    placeholder="类别名称"
                    :maxlength="10"
                  />
                  <div class="color-picker-wrapper">
                    <button
                      v-for="color in presetColors"
                      :key="color"
                      class="color-option"
                      :class="{ selected: newCategory.color === color }"
                      :style="{ backgroundColor: color }"
                      @click="newCategory.color = color"
                    ></button>
                  </div>
                  <Button
                    icon="add"
                    variant="primary"
                    size="small"
                    :disabled="!newCategory.name.trim()"
                    @click="addCategory"
                  >
                    添加
                  </Button>
                </div>
              </div>

              <!-- 类别列表 -->
              <div class="category-list-section">
                <h3>现有类别</h3>
                <div class="category-list">
                  <div
                    v-for="cat in categories"
                    :key="cat.id"
                    class="category-item"
                  >
                    <span
                      class="category-dot"
                      :style="{ backgroundColor: cat.color }"
                    ></span>
                    <span class="category-name">{{ cat.name }}</span>
                    <Button
                      v-if="cat.id !== 'default'"
                      icon="close"
                      variant="ghost"
                      size="small"
                      title="删除类别"
                      @click="deleteCategory(cat.id)"
                    />
                    <span
                      v-else
                      class="default-badge"
                    >默认</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Change Password Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showChangePasswordModal"
        class="password-vault-overlay modal-overlay"
        @click="closeChangePasswordModal"
      >
        <Transition name="scale">
          <div
            v-if="showChangePasswordModal"
            class="password-vault-dialog small"
            @click.stop
          >
            <div class="dialog-header">
              <h2>修改主密码</h2>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="closeChangePasswordModal"
              />
            </div>

            <div class="dialog-body">
              <form
                class="change-password-form"
                @submit.prevent="handleChangePassword"
              >
                <Input
                  v-model="oldPassword"
                  label="当前密码"
                  :type="showOldPassword ? 'text' : 'password'"
                  placeholder="请输入当前密码"
                  :show-password="true"
                  required
                />

                <Input
                  v-model="newPassword"
                  label="新密码"
                  :type="showNewPassword ? 'text' : 'password'"
                  placeholder="请输入新密码"
                  :show-password="true"
                  :minlength="6"
                  required
                />

                <Input
                  v-model="confirmPassword"
                  label="确认新密码"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  placeholder="请再次输入新密码"
                  :show-password="true"
                  :minlength="6"
                  required
                />

                <div
                  v-if="changePasswordError"
                  class="error-message"
                >
                  <IconWrapper
                    name="error"
                    :size="16"
                  />
                  {{ changePasswordError }}
                </div>

                <div class="form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    @click="closeChangePasswordModal"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    :disabled="!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()"
                  >
                    确认修改
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  LegacyStoredPasswordEntry,
  PasswordCategory,
  PasswordEntry,
  StoredPasswordEntry,
} from "./types"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue"
import { pendingEntryData } from "./index"
import { copyToClipboard as copyToClipboardUtil, triggerBlobDownload } from "@/utils/domUtils"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { usePlugin } from "@/main"
import HelpDialog from "./components/HelpDialog.vue"
import PasswordVaultLogin from "./components/PasswordVaultLogin.vue"
import {
  PasswordVaultStorage,
  DATA_VERSION,
} from "./types/storage"
import {
  decryptEntryPayload,
  decryptPassword,
  deriveKey,
  encryptEntryPayload,
  generateSalt,
  hashMasterPassword,
} from "./utils/crypto"

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
  (e: "close"): void
}>()

// 获取插件实例
const plugin = usePlugin()

// 存储管理器
const storage = new PasswordVaultStorage(plugin)

// 状态
const isLoggedIn = ref(false)
const loginError = ref("")
const isFirstTime = ref(false)
const savedHash = ref("")
const encryptionKey = ref<CryptoKey | null>(null) // 当前会话的加密密钥
const passwordHint = ref<string>("") // 密码提示

const searchQuery = ref("")
const selectedCategory = ref<string>("all")
const showAddModal = ref(false)
const editingEntry = ref<PasswordEntry | null>(null)
const showFormPassword = ref(false)
const showPasswords = ref<Record<string, boolean>>({})

// 修改密码状态
const showChangePasswordModal = ref(false)
const oldPassword = ref("")
const newPassword = ref("")
const confirmPassword = ref("")
const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const changePasswordError = ref("")
const showHelpDialog = ref(false)

// 数据存储路径（展示给用户）
const storagePath = computed(() => {
  const dataDir = (plugin as any).dataDir || ""
  const name = plugin.name || ""
  return dataDir && name
    ? `${dataDir}/storage/petal/${name}/password-vault-entries.json`
    : `data/storage/petal/{plugin}/password-vault-entries.json`
})

const copyStoragePath = async () => {
  if (!storagePath.value) return
  const ok = await copyToClipboardUtil(storagePath.value)
  showMessage(ok ? "路径已复制" : "复制失败", 2000, ok ? "info" : "error")
}

const entries = ref<PasswordEntry[]>([])
const categories = ref<PasswordCategory[]>([
  {
    id: "default",
    name: "默认",
    color: "#b0aea5",
  }, // 使用品牌中灰色
])

const entryForm = reactive({
  category: "",
  name: "",
  account: "",
  password: "",
  description: "",
})

// 类别管理
const showCategoryManager = ref(false)
const newCategory = reactive({
  name: "",
  color: "#d97757", // 使用品牌橙色作为默认
})

// 预设颜色 (Anthropic 品牌色)
const presetColors = [
  "#d97757", // 橙色 - Primary accent
  "#6a9bcc", // 蓝色 - Secondary accent
  "#788c5d", // 绿色 - Tertiary accent
  "#b0aea5", // 中灰 - Secondary
  "#141413", // 深色 - Primary text
  "#e8e6dc", // 浅灰 - Subtle backgrounds
]

// 使用 Map 缓存类别查找，优化性能 (O(n) -> O(1))
const categoriesMap = computed(() => {
  const map = new Map<string, PasswordCategory>()
  for (const cat of categories.value) {
    map.set(cat.id, cat)
  }
  return map
})

// 加载保存的密码验证信息
async function loadMasterPasswordHash() {
  try {
    const {
      hash,
      verifySalt,
      encryptionSalt: encSalt,
      hint,
    } = await storage.loadVerificationData()

    if (hash && verifySalt && encSalt) {
      savedHash.value = hash
      passwordHint.value = hint || ""
      isFirstTime.value = false
    } else {
      isFirstTime.value = true
    }
  } catch (error) {
    console.error("Failed to load master password:", error)
    isFirstTime.value = true
  }
}

// 处理登录
async function handleLogin(inputPassword: string, hint?: string) {
  if (!inputPassword.trim()) return

  if (isFirstTime.value) {
    // 首次创建密码 - 生成盐值并保存
    const verifySalt = generateSalt()
    const encryptSalt = generateSalt()
    const hash = await hashMasterPassword(inputPassword, verifySalt)

    // 更新密码提示
    if (hint) {
      passwordHint.value = hint
    }

    // 保存验证信息和加密盐值
    await storage.saveInitData({
      hash,
      verifySalt,
      encryptionSalt: encryptSalt,
      hint: passwordHint.value,
    })

    savedHash.value = hash
    isFirstTime.value = false
    isLoggedIn.value = true

    // 派生加密密钥
    encryptionKey.value = await deriveKey(inputPassword, encryptSalt)

    await Promise.all([loadEntries(), loadCategories()])
  } else {
    // 验证密码 - 获取保存的盐值
    const verifySalt = await storage.verifySalt.load()
    const encryptSalt = await storage.encryptionSalt.load()

    if (!verifySalt || !encryptSalt) {
      loginError.value = "数据损坏，请联系开发者"
      return
    }

    const hash = await hashMasterPassword(inputPassword, verifySalt)

    if (hash === savedHash.value) {
      isLoggedIn.value = true
      loginError.value = ""

      // 派生加密密钥
      encryptionKey.value = await deriveKey(inputPassword, encryptSalt)

      await Promise.all([loadEntries(), loadCategories()])
    } else {
      loginError.value = "密码错误，请重试"
    }
  }
}

// 显示忘记密码选项
async function showForgotPasswordOptions() {
  // 直接显示密码提示
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

// 导出所有数据（JSON格式，明文）
async function exportAllData() {
  if (!entries.value.length) {
    showMessage("没有数据可导出", 2000, "info")
    return
  }

  try {
    const exportData = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      entries: entries.value,
      categories: categories.value,
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    triggerBlobDownload(blob, `password-vault-backup-${new Date().toISOString().split("T")[0]}.json`)

    showMessage("数据已导出，请妥善保管", 3000, "info")
  } catch (error) {
    console.error("Export failed:", error)
    showMessage("导出失败", 2000, "error")
  }
}

// 打开修改密码弹窗
function openChangePasswordModal() {
  oldPassword.value = ""
  newPassword.value = ""
  confirmPassword.value = ""
  showOldPassword.value = false
  showNewPassword.value = false
  showConfirmPassword.value = false
  changePasswordError.value = ""
  showChangePasswordModal.value = true
}

// 关闭修改密码弹窗
function closeChangePasswordModal() {
  showChangePasswordModal.value = false
  oldPassword.value = ""
  newPassword.value = ""
  confirmPassword.value = ""
  changePasswordError.value = ""
}

// 处理修改密码
async function handleChangePassword() {
  changePasswordError.value = ""

  // 验证输入
  if (
    !oldPassword.value.trim()
    || !newPassword.value.trim()
    || !confirmPassword.value.trim()
  ) {
    changePasswordError.value = "请填写所有字段"
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    changePasswordError.value = "两次输入的新密码不一致"
    return
  }

  if (newPassword.value.length < 6) {
    changePasswordError.value = "新密码至少需要6个字符"
    return
  }

  if (oldPassword.value === newPassword.value) {
    changePasswordError.value = "新密码不能与当前密码相同"
    return
  }

  try {
    // 获取当前验证盐值
    const verifySalt = await storage.verifySalt.load()
    if (!verifySalt) {
      changePasswordError.value = "数据损坏"
      return
    }

    const oldHash = await hashMasterPassword(oldPassword.value, verifySalt)

    // 验证旧密码
    if (oldHash !== savedHash.value) {
      changePasswordError.value = "当前密码错误"
      return
    }

    // 生成新的盐值和哈希
    const newVerifySalt = generateSalt()
    const newEncryptSalt = generateSalt()
    const newHash = await hashMasterPassword(newPassword.value, newVerifySalt)

    // 使用新密码派生新密钥
    const newKey = await deriveKey(newPassword.value, newEncryptSalt)

    // 使用新密钥重新加密所有条目
    const reEncryptedEntries: StoredPasswordEntry[] = await Promise.all(
      entries.value.map(async (entry) => {
        const { encryptedPayload, iv } = await encryptEntryPayload(
          {
            name: entry.name,
            account: entry.account,
            password: entry.password,
            description: entry.description,
          },
          newKey,
        )
        return {
          id: entry.id,
          category: entry.category,
          encryptedPayload,
          iv,
          createdAt: entry.createdAt,
          updatedAt: Date.now(),
          version: DATA_VERSION,
        }
      }),
    )

    // 保存所有新数据
    await Promise.all([
      storage.masterPassword.save(newHash),
      storage.verifySalt.save(newVerifySalt),
      storage.encryptionSalt.save(newEncryptSalt),
      storage.entries.save(reEncryptedEntries),
    ])

    // 更新状态
    savedHash.value = newHash
    encryptionKey.value = newKey

    showMessage("密码修改成功，请记住新密码", 3000, "info")
    closeChangePasswordModal()
  } catch (error) {
    console.error("Change password failed:", error)
    changePasswordError.value = "密码修改失败，请重试"
  }
}

// 加载条目（解密所有敏感字段，自动迁移旧格式）
async function loadEntries() {
  if (!encryptionKey.value) return

  try {
    const stored = await storage.entries.load()
    if (!stored || stored.length === 0) {
      entries.value = []
      return
    }

    let needsMigration = false
    const decrypted: PasswordEntry[] = await Promise.all(
      stored.map(async (entry: StoredPasswordEntry | LegacyStoredPasswordEntry) => {
        // 检测旧格式（v1：有 encryptedPassword 字段，仅 password 加密）
        if ("encryptedPassword" in entry && entry.encryptedPassword) {
          needsMigration = true
          const legacy = entry as LegacyStoredPasswordEntry
          const password = await decryptPassword(
            legacy.encryptedPassword,
            legacy.iv,
            encryptionKey.value!,
          )
          return {
            id: legacy.id,
            category: legacy.category,
            name: legacy.name,
            account: legacy.account,
            password,
            description: legacy.description ?? "",
            createdAt: legacy.createdAt,
            updatedAt: legacy.updatedAt,
          }
        }

        // 新格式（v2）：所有敏感字段整体加密
        const v2 = entry as StoredPasswordEntry
        const payload = await decryptEntryPayload(
          v2.encryptedPayload,
          v2.iv,
          encryptionKey.value!,
        )
        return {
          id: v2.id,
          category: v2.category,
          name: payload.name,
          account: payload.account,
          password: payload.password,
          description: payload.description,
          createdAt: v2.createdAt,
          updatedAt: v2.updatedAt,
        }
      }),
    )

    entries.value = decrypted

    // 有旧数据时静默迁移回写新格式
    if (needsMigration) {
      await saveEntries()
      console.info("[PasswordVault] 旧格式数据已自动迁移至 v2 加密格式")
    }
  } catch (error) {
    console.error("Failed to load entries:", error)
    entries.value = []
  }
}

// 加载分类
async function loadCategories() {
  try {
    const stored = await storage.categories.load()
    if (stored) {
      categories.value = stored
    }
  } catch (error) {
    console.error("Failed to load categories:", error)
  }
}

// 保存条目（加密所有敏感字段）
async function saveEntries() {
  if (!encryptionKey.value) {
    console.error("No encryption key available")
    return
  }
  try {
    const storedEntries: StoredPasswordEntry[] = await Promise.all(
      entries.value.map(async (entry) => {
        const { encryptedPayload, iv } = await encryptEntryPayload(
          {
            name: entry.name,
            account: entry.account,
            password: entry.password,
            description: entry.description,
          },
          encryptionKey.value!,
        )
        return {
          id: entry.id,
          category: entry.category,
          encryptedPayload,
          iv,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          version: DATA_VERSION,
        }
      }),
    )
    await storage.entries.save(storedEntries)
  } catch (error) {
    console.error("Failed to save entries:", error)
  }
}

// 保存分类
async function saveCategories() {
  try {
    await storage.categories.save(categories.value)
  } catch (error) {
    console.error("Failed to save categories:", error)
  }
}

// 过滤条目 - 使用缓存策略优化性能
const filteredEntries = computed(() => {
  const allEntries = entries.value
  const category = selectedCategory.value
  const query = searchQuery.value

  // 无过滤条件时直接返回原数组，避免创建新数组
  if (category === "all" && !query) {
    return allEntries
  }

  let result = allEntries

  // 先按分类过滤
  if (category !== "all") {
    result = result.filter((entry) => entry.category === category)
  }

  // 再按搜索词过滤
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

// 获取分类对象 - 使用 Map 缓存实现 O(1) 查找
const getCategoryById = (id: string): PasswordCategory | undefined => {
  return categoriesMap.value.get(id)
}

// 打开添加弹窗
const openAddModal = () => {
  editingEntry.value = null
  entryForm.category = categories.value[0]?.id || ""
  entryForm.name = ""
  entryForm.account = ""
  entryForm.password = ""
  entryForm.description = ""
  showFormPassword.value = false
  showAddModal.value = true
}

// 编辑条目
const editEntry = (entry: PasswordEntry) => {
  editingEntry.value = entry
  entryForm.category = entry.category
  entryForm.name = entry.name
  entryForm.account = entry.account
  entryForm.password = entry.password
  entryForm.description = entry.description
  showFormPassword.value = false
  showAddModal.value = true
}

// 关闭添加弹窗
const closeAddModal = () => {
  showAddModal.value = false
  editingEntry.value = null
}

// 类别管理方法
const openCategoryManager = () => {
  showCategoryManager.value = true
}

const closeCategoryManager = () => {
  showCategoryManager.value = false
  newCategory.name = ""
  newCategory.color = "#3b82f6"
}

const addCategory = async () => {
  if (!newCategory.name.trim()) return

  // 检查是否已存在同名类别
  if (categories.value.some((c) => c.name === newCategory.name.trim())) {
    showMessage("类别已存在", 2000, "error")
    return
  }

  const category: PasswordCategory = {
    id: Date.now().toString(),
    name: newCategory.name.trim(),
    color: newCategory.color,
  }

  categories.value.push(category)
  await saveCategories()

  // 重置表单
  newCategory.name = ""
  newCategory.color = presetColors[0]

  showMessage("类别已添加", 2000, "info")
}

const deleteCategory = async (categoryId: string) => {
  if (categoryId === "default") {
    showMessage("默认类别不能删除", 2000, "error")
    return
  }

  // 检查是否有条目使用该类别
  const hasEntries = entries.value.some((e) => e.category === categoryId)
  if (hasEntries) {
    showMessage("该类别下有密码条目，无法删除", 2000, "error")
    return
  }

  categories.value = categories.value.filter((c) => c.id !== categoryId)
  await saveCategories()

  // 如果当前选中的是被删除的类别，重置为全部
  if (selectedCategory.value === categoryId) {
    selectedCategory.value = "all"
  }

  showMessage("类别已删除", 2000, "info")
}

// 保存条目
async function saveEntry() {
  try {
    if (editingEntry.value) {
      // 更新
      const index = entries.value.findIndex(
        (e) => e.id === editingEntry.value!.id,
      )
      if (index !== -1) {
        entries.value[index] = {
          ...entries.value[index],
          category: entryForm.category,
          name: entryForm.name,
          account: entryForm.account,
          password: entryForm.password,
          description: entryForm.description,
          updatedAt: Date.now(),
        }
      }
    } else {
      // 新增
      const newEntry: PasswordEntry = {
        id: Date.now().toString(),
        category: entryForm.category,
        name: entryForm.name,
        account: entryForm.account,
        password: entryForm.password,
        description: entryForm.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      entries.value.push(newEntry)
    }

    await saveEntries()
    closeAddModal()
  } catch (error) {
    console.error("Failed to save entry:", error)
  }
}

// 删除条目
async function deleteEntry(id: string) {
  const entry = entries.value.find((e) => e.id === id)
  if (!entry) return

  const confirmed = window.confirm(
    `确定要删除密码条目「${entry.name}」吗？此操作不可恢复。`,
  )
  if (!confirmed) return

  entries.value = entries.value.filter((e) => e.id !== id)
  // 清理密码可见性状态，避免内存泄漏
  if (id in showPasswords.value) {
    delete showPasswords.value[id]
  }
  await saveEntries()
  showMessage("密码条目已删除", 2000, "info")
}

// 切换密码可见性
const togglePasswordVisibility = (id: string) => {
  showPasswords.value[id] = !showPasswords.value[id]
}

// 通用复制函数 — 统一使用 domUtils.copyToClipboard
const copyAndNotify = async (text: string, label: string) => {
  const ok = await copyToClipboardUtil(text)
  showMessage(ok ? `${label}已复制` : "复制失败", 2000, ok ? "info" : "error")
}

// 复制账号
const copyAccount = (account: string) => copyAndNotify(account, "账号")

// 复制密码
const copyPassword = (password: string) => copyAndNotify(password, "密码")

// 关闭弹窗
const closeDialog = () => {
  isLoggedIn.value = false
  loginError.value = ""
  // 清除加密密钥和解密后的数据（安全措施）
  encryptionKey.value = null
  entries.value = []
  // 清理密码可见性状态，防止内存泄漏
  Object.keys(showPasswords.value).forEach((key) => {
    delete showPasswords.value[key]
  })
  emit("update:visible", false)
  emit("close")
}

// 键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.visible) return

  if (event.key === "Escape") {
    if (showCategoryManager.value) {
      closeCategoryManager()
    } else if (showAddModal.value) {
      closeAddModal()
    } else {
      closeDialog()
    }
  }

  // Ctrl+K 搜索
  if ((event.ctrlKey || event.metaKey) && event.key === "k") {
    event.preventDefault()
    if (isLoggedIn.value) {
      // 聚焦搜索框
    }
  }
}

// 监听 visible 变化
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await loadMasterPasswordHash()
    }
  },
)

// 检查条目是否已存在（名称 + 账号 均一致）
function isEntryDuplicate(data: { name: string, account: string }): boolean {
  if (!data.account) return false // 无账号字段无法判断重复
  return entries.value.some(
    (e) => e.name === data.name && e.account === data.account,
  )
}

// 监听外部预填数据（来自浮动工具栏"存密码"等外部调用）
watch(pendingEntryData, (data) => {
  if (data && isLoggedIn.value) {
    // 去重检查：名称+账号已存在则不重复添加
    if (isEntryDuplicate(data)) {
      showMessage(`「${data.name}」已存在，无需重复添加`, 3000, "info")
      pendingEntryData.value = null
      return
    }
    // 打开添加表单并预填所有字段
    editingEntry.value = null
    entryForm.category = categories.value[0]?.id || ""
    entryForm.name = data.name
    entryForm.account = data.account
    entryForm.password = data.password
    entryForm.description = data.description
    showFormPassword.value = false
    showAddModal.value = true
    // 清空 pending 状态，避免重复触发
    pendingEntryData.value = null
  }
}, { immediate: true })

// 登录完成后检测是否有待处理的预填数据
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn && pendingEntryData.value) {
    const data = pendingEntryData.value
    // 去重检查：名称+账号已存在则不重复添加
    if (isEntryDuplicate(data)) {
      showMessage(`「${data.name}」已存在，无需重复添加`, 3000, "info")
      pendingEntryData.value = null
      return
    }
    editingEntry.value = null
    entryForm.category = categories.value[0]?.id || ""
    entryForm.name = data.name
    entryForm.account = data.account
    entryForm.password = data.password
    entryForm.description = data.description
    showFormPassword.value = false
    showAddModal.value = true
    pendingEntryData.value = null
  }
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
