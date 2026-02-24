<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="password-vault-overlay" @click.self="closeDialog">
        <Transition name="scale">
          <div v-if="visible" class="password-vault-dialog">
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
            <div v-else class="main-container">
              <div class="dialog-header">
                <div class="header-title">
                  <IconWrapper name="settings" :size="22" />
                  <h2>密码箱</h2>
                </div>
                <div class="header-actions">
                  <Button class="help-btn" icon="help" variant="ghost" size="small" @click="showHelpDialog = true" title="使用说明" />
                  <Button class="close-btn" icon="close" variant="ghost" size="small" @click="closeDialog" />
                </div>
              </div>

              <div class="dialog-body">
                <!-- 分类筛选器 -->
                <div class="category-filter">
                  <div class="category-chips">
                    <button
                      v-for="cat in [{ id: 'all', name: '全部', color: '#b0aea5' }, ...categories]"
                      :key="cat.id"
                      class="category-chip"
                      :class="{ active: selectedCategory === cat.id }"
                      :style="{ '--cat-color': cat.color }"
                      @click="selectedCategory = cat.id"
                    >
                      <span class="chip-dot" :style="{ backgroundColor: cat.color }"></span>
                      {{ cat.name }}
                    </button>
                  </div>
                  <Button class="manage-categories-btn" icon="settings" variant="ghost" size="small" @click="openCategoryManager" title="管理类别" />
                </div>

                <div class="entries-controls">
                    <IconWrapper name="search" :size="16" class="search-icon" />
                    <Input
                      v-model="searchQuery"
                      type="text"
                      placeholder="搜索名称、账号或描述..."
                      size="small"
                    />
                    <Button  icon="download" variant="ghost" size="small" @click="exportAllData" title="导出所有数据">
                      导出
                    </Button>
                    <Button  icon="add" variant="primary" size="small" @click="openAddModal">
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
                        <IconWrapper name="file" :size="18" class="entry-icon" />
                        <h3>{{ entry.name }}</h3>
                        <span class="entry-category-tag" :style="{ backgroundColor: getCategoryById(entry.category)?.color + '20', color: getCategoryById(entry.category)?.color }">
                          {{ getCategoryById(entry.category)?.name || '未分类' }}
                        </span>
                      </div>
                      <div class="entry-actions">
                        <Button @click="editEntry(entry)" variant="ghost" size="small" :title="'编辑'">
                          编辑
                        </Button>
                        <Button @click="deleteEntry(entry.id)" icon="delete" variant="ghost" size="small" :title="'删除'" />
                      </div>
                    </div>
                    <div class="entry-account" @click="copyAccount(entry.account)">
                      <IconWrapper name="file" :size="14" />
                      <span class="account-text">{{ entry.account }}</span>
                      <div class="action-hint">
                        <IconWrapper name="contentCopy" :size="12" />
                        点击复制
                      </div>
                    </div>
                    <div class="entry-description">
                      {{ entry.description }}
                    </div>
                    <div class="entry-field">
                      <div class="field-label">
                        <IconWrapper name="pageLock" :size="14" />
                        密码
                      </div>
                      <div class="field-value" @click="copyPassword(entry.password)">
                        <span class="password-mask">{{ showPasswords[entry.id] ? entry.password : '••••••••' }}</span>
                        <div class="action-hint">
                          <IconWrapper name="contentCopy" :size="12" />
                         点击复制
                        </div>
                      </div>
                      <Button  :icon="showPasswords[entry.id] ? 'eye' : 'eyeOff'" variant="ghost" size="small" @click.stop="togglePasswordVisibility(entry.id)" />
                    </div>
                  </div>

                  <div v-if="filteredEntries.length === 0" class="no-entries">
                    {{ searchQuery ? '未找到匹配的条目' : '暂无密码条目，点击添加' }}
                  </div>
                </div>
              </div>

              <div class="dialog-footer">
                <Button  variant="ghost" size="small" @click="openChangePasswordModal">
                  <IconWrapper name="pageLock" :size="14" />
                  修改密码
                </Button>
              </div>
            </div>

            <!-- 使用说明对话框 -->
            <HelpDialog :visible="showHelpDialog" @close="showHelpDialog = false" />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Add/Edit Entry Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showAddModal" class="password-vault-overlay modal-overlay" @click="closeAddModal">
        <Transition name="scale">
          <div v-if="showAddModal" class="password-vault-dialog small" @click.stop>
            <div class="dialog-header">
              <h2>{{ editingEntry ? '编辑密码' : '添加密码' }}</h2>
              <Button  icon="close" variant="ghost" size="small" @click="closeAddModal" />
            </div>

            <div class="dialog-body">
              <form @submit.prevent="saveEntry" class="entry-form">
                <div class="form-group">
                  <Select
                    v-model="entryForm.category"
                    label="类别"
                    :options="categories.map(cat => ({ value: cat.id, label: cat.name }))"
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
                  <Textarea
                    v-model="entryForm.description"
                    label="描述"
                    placeholder="请输入描述信息"
                    :rows="3"
                  />
                </div>

                <div class="form-actions">
                  <Button type="button" variant="ghost" @click="closeAddModal">
                    取消
                  </Button>
                  <Button type="submit" variant="primary">
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
      <div v-if="showCategoryManager" class="password-vault-overlay modal-overlay" @click="closeCategoryManager">
        <Transition name="scale">
          <div v-if="showCategoryManager" class="password-vault-dialog category-manager" @click.stop>
            <div class="dialog-header">
              <h2>管理类别</h2>
              <Button  icon="close" variant="ghost" size="small" @click="closeCategoryManager" />
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
                  <Button  icon="add" variant="primary" size="small" @click="addCategory" :disabled="!newCategory.name.trim()">
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
                    <span class="category-dot" :style="{ backgroundColor: cat.color }"></span>
                    <span class="category-name">{{ cat.name }}</span>
                    <Button
                      v-if="cat.id !== 'default'"
                      icon="close"
                      variant="ghost"
                      size="small"
                      @click="deleteCategory(cat.id)"
                      title="删除类别"
                    />
                    <span v-else class="default-badge">默认</span>
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
      <div v-if="showChangePasswordModal" class="password-vault-overlay modal-overlay" @click="closeChangePasswordModal">
        <Transition name="scale">
          <div v-if="showChangePasswordModal" class="password-vault-dialog small" @click.stop>
            <div class="dialog-header">
              <h2>修改主密码</h2>
              <Button  icon="close" variant="ghost" size="small" @click="closeChangePasswordModal" />
            </div>

            <div class="dialog-body">
              <form @submit.prevent="handleChangePassword" class="change-password-form">
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

                <div v-if="changePasswordError" class="error-message">
                  <IconWrapper name="error" :size="16" />
                  {{ changePasswordError }}
                </div>

                <div class="form-actions">
                  <Button type="button" variant="ghost" @click="closeChangePasswordModal">
                    取消
                  </Button>
                  <Button type="submit" variant="primary" :disabled="!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()">
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
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { showMessage } from 'siyuan'
import IconWrapper from '@/components/IconWrapper.vue'
import Button from '@/components/Button.vue'
import Input from '@/components/Input.vue'
import Textarea from '@/components/Textarea.vue'
import Select from '@/components/Select.vue'
import PasswordVaultLogin from './PasswordVaultLogin.vue'
import HelpDialog from './HelpDialog.vue'
import type { PasswordEntry, PasswordCategory, StoredPasswordEntry } from './types'
import { usePlugin } from '@/main'
import {
  deriveKey,
  encryptPassword,
  decryptPassword,
  hashMasterPassword,
  generateVerifySalt
} from './crypto'

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

// 获取插件实例
const plugin = usePlugin()

// 存储键
const MASTER_PASSWORD_KEY = 'password-vault-master-password'
const VERIFY_SALT_KEY = 'password-vault-verify-salt'
const ENCRYPTION_SALT_KEY = 'password-vault-encryption-salt'
const ENTRIES_KEY = 'password-vault-entries'
const CATEGORIES_KEY = 'password-vault-categories'
const PASSWORD_HINT_KEY = 'password-vault-hint'

// 状态
const isLoggedIn = ref(false)
const loginError = ref('')
const isFirstTime = ref(false)
const savedHash = ref('')
const encryptionKey = ref<CryptoKey | null>(null)  // 当前会话的加密密钥
const encryptionSalt = ref<string>('')              // 加密盐值
const passwordHint = ref<string>('')                // 密码提示

const searchQuery = ref('')
const selectedCategory = ref<string>('all')
const showAddModal = ref(false)
const editingEntry = ref<PasswordEntry | null>(null)
const showFormPassword = ref(false)
const showPasswords = ref<Record<string, boolean>>({})

// 修改密码状态
const showChangePasswordModal = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const changePasswordError = ref('')
const showHelpDialog = ref(false)

const entries = ref<PasswordEntry[]>([])
const categories = ref<PasswordCategory[]>([
  { id: 'default', name: '默认', color: '#b0aea5' } // 使用品牌中灰色
])

const entryForm = reactive({
  category: '',
  name: '',
  account: '',
  password: '',
  description: ''
})

// 类别管理
const showCategoryManager = ref(false)
const newCategory = reactive({
  name: '',
  color: '#d97757' // 使用品牌橙色作为默认
})

// 预设颜色 (Anthropic 品牌色)
const presetColors = [
  '#d97757', // 橙色 - Primary accent
  '#6a9bcc', // 蓝色 - Secondary accent
  '#788c5d', // 绿色 - Tertiary accent
  '#b0aea5', // 中灰 - Secondary
  '#141413', // 深色 - Primary text
  '#e8e6dc', // 浅灰 - Subtle backgrounds
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
    const [storedHash, storedVerifySalt, storedEncryptSalt, storedHint] = await Promise.all([
      plugin.loadData(MASTER_PASSWORD_KEY),
      plugin.loadData(VERIFY_SALT_KEY),
      plugin.loadData(ENCRYPTION_SALT_KEY),
      plugin.loadData(PASSWORD_HINT_KEY)
    ])

    if (storedHash && storedVerifySalt && storedEncryptSalt) {
      savedHash.value = storedHash as string
      passwordHint.value = (storedHint as string) || ''
      isFirstTime.value = false
    } else {
      isFirstTime.value = true
    }
  } catch (error) {
    console.error('Failed to load master password:', error)
    isFirstTime.value = true
  }
}

// 处理登录
async function handleLogin(inputPassword: string, hint?: string) {
  if (!inputPassword.trim()) return

  if (isFirstTime.value) {
    // 首次创建密码 - 生成盐值并保存
    const verifySalt = generateVerifySalt()
    const encryptSalt = generateVerifySalt()
    const hash = await hashMasterPassword(inputPassword, verifySalt)

    // 更新密码提示
    if (hint) {
      passwordHint.value = hint
    }

    // 保存验证信息和加密盐值
    await Promise.all([
      plugin.saveData(MASTER_PASSWORD_KEY, hash),
      plugin.saveData(VERIFY_SALT_KEY, verifySalt),
      plugin.saveData(ENCRYPTION_SALT_KEY, encryptSalt),
      passwordHint.value ? plugin.saveData(PASSWORD_HINT_KEY, passwordHint.value) : Promise.resolve()
    ])

    savedHash.value = hash
    encryptionSalt.value = encryptSalt
    isFirstTime.value = false
    isLoggedIn.value = true

    // 派生加密密钥
    encryptionKey.value = await deriveKey(inputPassword, encryptSalt)

    await loadEntries()
    await loadCategories()
  } else {
    // 验证密码 - 获取保存的盐值
    const [verifySalt, encryptSalt] = await Promise.all([
      plugin.loadData(VERIFY_SALT_KEY),
      plugin.loadData(ENCRYPTION_SALT_KEY)
    ]) as [string, string]

    const hash = await hashMasterPassword(inputPassword, verifySalt)

    if (hash === savedHash.value) {
      isLoggedIn.value = true
      loginError.value = ''
      encryptionSalt.value = encryptSalt

      // 派生加密密钥
      encryptionKey.value = await deriveKey(inputPassword, encryptSalt)

      await loadEntries()
      await loadCategories()
    } else {
      loginError.value = '密码错误，请重试'
    }
  }
}

// 显示忘记密码选项
async function showForgotPasswordOptions() {
  // 直接显示密码提示
  if (passwordHint.value) {
    showMessage(`密码提示：${passwordHint.value}`, 5000, 'info')
  } else {
    showMessage('未设置密码提示。如需重置，请联系开发者或查看插件数据目录手动删除数据', 5000, 'info')
  }
}

// 导出所有数据（JSON格式，明文）
async function exportAllData() {
  if (!entries.value.length) {
    showMessage('没有数据可导出', 2000, 'info')
    return
  }

  try {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      entries: entries.value,
      categories: categories.value
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `password-vault-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showMessage('数据已导出，请妥善保管', 3000, 'info')
  } catch (error) {
    console.error('Export failed:', error)
    showMessage('导出失败', 2000, 'error')
  }
}

// 打开修改密码弹窗
function openChangePasswordModal() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showOldPassword.value = false
  showNewPassword.value = false
  showConfirmPassword.value = false
  changePasswordError.value = ''
  showChangePasswordModal.value = true
}

// 关闭修改密码弹窗
function closeChangePasswordModal() {
  showChangePasswordModal.value = false
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  changePasswordError.value = ''
}

// 处理修改密码
async function handleChangePassword() {
  changePasswordError.value = ''

  // 验证输入
  if (!oldPassword.value.trim() || !newPassword.value.trim() || !confirmPassword.value.trim()) {
    changePasswordError.value = '请填写所有字段'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    changePasswordError.value = '两次输入的新密码不一致'
    return
  }

  if (newPassword.value.length < 6) {
    changePasswordError.value = '新密码至少需要6个字符'
    return
  }

  if (oldPassword.value === newPassword.value) {
    changePasswordError.value = '新密码不能与当前密码相同'
    return
  }

  try {
    // 获取当前验证盐值
    const verifySalt = await plugin.loadData(VERIFY_SALT_KEY) as string
    const oldHash = await hashMasterPassword(oldPassword.value, verifySalt)

    // 验证旧密码
    if (oldHash !== savedHash.value) {
      changePasswordError.value = '当前密码错误'
      return
    }

    // 生成新的盐值和哈希
    const newVerifySalt = generateVerifySalt()
    const newEncryptSalt = generateVerifySalt()
    const newHash = await hashMasterPassword(newPassword.value, newVerifySalt)

    // 使用新密码派生新密钥
    const newKey = await deriveKey(newPassword.value, newEncryptSalt)

    // 使用新密钥重新加密所有条目
    const reEncryptedEntries: StoredPasswordEntry[] = await Promise.all(
      entries.value.map(async (entry) => {
        const { encryptedData, iv } = await encryptPassword(entry.password, newKey)
        return {
          id: entry.id,
          category: entry.category,
          name: entry.name,
          account: entry.account,
          encryptedPassword: encryptedData,
          iv: iv,
          description: entry.description,
          createdAt: entry.createdAt,
          updatedAt: Date.now()
        }
      })
    )

    // 保存所有新数据
    await Promise.all([
      plugin.saveData(MASTER_PASSWORD_KEY, newHash),
      plugin.saveData(VERIFY_SALT_KEY, newVerifySalt),
      plugin.saveData(ENCRYPTION_SALT_KEY, newEncryptSalt),
      plugin.saveData(ENTRIES_KEY, reEncryptedEntries)
    ])

    // 更新状态
    savedHash.value = newHash
    encryptionSalt.value = newEncryptSalt
    encryptionKey.value = newKey

    showMessage('密码修改成功，请记住新密码', 3000, 'info')
    closeChangePasswordModal()
  } catch (error) {
    console.error('Change password failed:', error)
    changePasswordError.value = '密码修改失败，请重试'
  }
}

// 加载条目（解密密码）
async function loadEntries() {
  try {
    const stored = await plugin.loadData(ENTRIES_KEY)
    if (stored && encryptionKey.value) {
      const storedEntries = stored as StoredPasswordEntry[]
      // 解密所有条目的密码
      entries.value = await Promise.all(
        storedEntries.map(async (entry) => ({
          ...entry,
          password: await decryptPassword(entry.encryptedPassword, entry.iv, encryptionKey.value!)
        }))
      )
    } else {
      entries.value = []
    }
  } catch (error) {
    console.error('Failed to load entries:', error)
    entries.value = []
  }
}

// 加载分类
async function loadCategories() {
  try {
    const stored = await plugin.loadData(CATEGORIES_KEY)
    if (stored) {
      categories.value = stored as PasswordCategory[]
    }
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
}

// 保存条目（加密密码）
async function saveEntries() {
  if (!encryptionKey.value) {
    console.error('No encryption key available')
    return
  }
  try {
    // 加密所有条目的密码后存储
    const storedEntries: StoredPasswordEntry[] = await Promise.all(
      entries.value.map(async (entry) => {
        const { encryptedData, iv } = await encryptPassword(entry.password, encryptionKey.value!)
        return {
          id: entry.id,
          category: entry.category,
          name: entry.name,
          account: entry.account,
          encryptedPassword: encryptedData,
          iv: iv,
          description: entry.description,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        }
      })
    )
    await plugin.saveData(ENTRIES_KEY, storedEntries)
  } catch (error) {
    console.error('Failed to save entries:', error)
  }
}

// 保存分类
async function saveCategories() {
  try {
    await plugin.saveData(CATEGORIES_KEY, categories.value)
  } catch (error) {
    console.error('Failed to save categories:', error)
  }
}

// 过滤条目 - 使用缓存策略优化性能
const filteredEntries = computed(() => {
  const allEntries = entries.value
  const category = selectedCategory.value
  const query = searchQuery.value

  // 无过滤条件时直接返回原数组，避免创建新数组
  if (category === 'all' && !query) {
    return allEntries
  }

  let result = allEntries

  // 先按分类过滤
  if (category !== 'all') {
    result = result.filter(entry => entry.category === category)
  }

  // 再按搜索词过滤
  if (query) {
    const lowerQuery = query.toLowerCase()
    result = result.filter(entry =>
      entry.name.toLowerCase().includes(lowerQuery) ||
      entry.account.toLowerCase().includes(lowerQuery) ||
      entry.description.toLowerCase().includes(lowerQuery)
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
  entryForm.category = categories.value[0]?.id || ''
  entryForm.name = ''
  entryForm.account = ''
  entryForm.password = ''
  entryForm.description = ''
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
  newCategory.name = ''
  newCategory.color = '#3b82f6'
}

const addCategory = async () => {
  if (!newCategory.name.trim()) return

  // 检查是否已存在同名类别
  if (categories.value.some(c => c.name === newCategory.name.trim())) {
    showMessage('类别已存在', 2000, 'error')
    return
  }

  const category: PasswordCategory = {
    id: Date.now().toString(),
    name: newCategory.name.trim(),
    color: newCategory.color
  }

  categories.value.push(category)
  await saveCategories()

  // 重置表单
  newCategory.name = ''
  newCategory.color = presetColors[0]

  showMessage('类别已添加', 2000, 'info')
}

const deleteCategory = async (categoryId: string) => {
  if (categoryId === 'default') {
    showMessage('默认类别不能删除', 2000, 'error')
    return
  }

  // 检查是否有条目使用该类别
  const hasEntries = entries.value.some(e => e.category === categoryId)
  if (hasEntries) {
    showMessage('该类别下有密码条目，无法删除', 2000, 'error')
    return
  }

  categories.value = categories.value.filter(c => c.id !== categoryId)
  await saveCategories()

  // 如果当前选中的是被删除的类别，重置为全部
  if (selectedCategory.value === categoryId) {
    selectedCategory.value = 'all'
  }

  showMessage('类别已删除', 2000, 'info')
}

// 保存条目
async function saveEntry() {
  try {
    if (editingEntry.value) {
      // 更新
      const index = entries.value.findIndex(e => e.id === editingEntry.value!.id)
      if (index !== -1) {
        entries.value[index] = {
          ...entries.value[index],
          category: entryForm.category,
          name: entryForm.name,
          account: entryForm.account,
          password: entryForm.password,
          description: entryForm.description,
          updatedAt: Date.now()
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
        updatedAt: Date.now()
      }
      entries.value.push(newEntry)
    }

    await saveEntries()
    closeAddModal()
  } catch (error) {
    console.error('Failed to save entry:', error)
  }
}

// 删除条目
async function deleteEntry(id: string) {
  const entry = entries.value.find(e => e.id === id)
  if (!entry) return

  const confirmed = window.confirm(`确定要删除密码条目「${entry.name}」吗？此操作不可恢复。`)
  if (!confirmed) return

  entries.value = entries.value.filter(e => e.id !== id)
  // 清理密码可见性状态，避免内存泄漏
  if (id in showPasswords.value) {
    delete showPasswords.value[id]
  }
  await saveEntries()
  showMessage('密码条目已删除', 2000, 'info')
}

// 切换密码可见性
const togglePasswordVisibility = (id: string) => {
  showPasswords.value[id] = !showPasswords.value[id]
}

// 复制账号
const copyAccount = async (account: string) => {
  try {
    await navigator.clipboard.writeText(account)
    showMessage('账号已复制', 2000, 'info')
  } catch (error) {
    showMessage('复制失败', 2000, 'error')
  }
}

// 复制密码
const copyPassword = async (password: string) => {
  try {
    await navigator.clipboard.writeText(password)
    showMessage('密码已复制', 2000, 'info')
  } catch (error) {
    showMessage('复制失败', 2000, 'error')
  }
}

// 关闭弹窗
const closeDialog = () => {
  isLoggedIn.value = false
  loginError.value = ''
  // 清除加密密钥和解密后的数据（安全措施）
  encryptionKey.value = null
  encryptionSalt.value = ''
  entries.value = []
  // 清理密码可见性状态，防止内存泄漏
  Object.keys(showPasswords.value).forEach(key => {
    delete showPasswords.value[key]
  })
  emit('update:visible', false)
  emit('close')
}

// 键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.visible) return

  if (event.key === 'Escape') {
    if (showCategoryManager.value) {
      closeCategoryManager()
    } else if (showAddModal.value) {
      closeAddModal()
    } else {
      closeDialog()
    }
  }

  // Ctrl+K 搜索
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    if (isLoggedIn.value) {
      // 聚焦搜索框
    }
  }
}

// 监听 visible 变化
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await loadMasterPasswordHash()
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style lang="scss" scoped>
@use './PasswordVaultDialog.scss';
</style>
