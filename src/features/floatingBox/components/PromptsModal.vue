<template>
  <div
    v-if="showModal"
    class="vp-overlay"
    @click="closeModal"
    @keydown.escape="closeModal"
  >
    <div
      class="vp-modal"
      @click.stop
    >
      <div class="vp-modal-header">
        <div class="vp-modal-title">
          <IconWrapper
            name="starCircle"
            :size="24"
            class="vp-modal-icon"
          />
          <h2>{{ i18n?.promptsTitle || '提示词库' }}</h2>
        </div>
        <div class="vp-modal-actions">
          <Button
            variant="ghost"
            size="small"
            icon="listBulleted"
            :title="i18n?.manageCategories || '管理分类'"
            @click="openCategoryManage"
          />
          <Button
            variant="ghost"
            icon="close"
            size="small"
            @click="closeModal"
          />
        </div>
      </div>

      <div class="vp-modal-body">
        <div
          v-if="loading"
          class="vp-loading"
          role="status"
        >
          {{ i18n?.loading || '加载中...' }}
        </div>

        <template v-else>
          <div class="vp-category-filter">
            <button
              v-for="cat in allCategories"
              :key="cat.id"
              class="vp-chip"
              :class="{ active: selectedCategory === cat.id }"
              :aria-pressed="selectedCategory === cat.id"
              @click="selectCategory(cat.id)"
            >
              <span
                class="vp-chip-dot"
                :style="{ backgroundColor: cat.color }"
              />
              {{ cat.name }}
            </button>
          </div>

          <div class="vp-controls">
            <div class="vp-search">
              <IconWrapper
                name="search"
                :size="18"
                class="vp-search-icon"
              />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="i18n?.search || '搜索提示词...'"
                class="vp-input vp-input--search"
                aria-label="搜索提示词"
              />
            </div>

            <Button
              variant="primary"
              size="small"
              @click="openAddModal"
            >
              {{ i18n?.addPrompt || '添加提示词' }}
            </Button>
          </div>

          <div class="vp-grid">
            <div
              v-for="prompt in filteredPrompts"
              :key="prompt.id"
              class="vp-card"
              role="article"
              :aria-label="`提示词: ${prompt.title}`"
            >
              <div class="vp-card-header">
                <div class="vp-card-title">
                  <IconWrapper
                    name="star"
                    :size="18"
                    class="vp-card-icon"
                  />
                  <h3>{{ prompt.title }}</h3>
                  <span
                    class="vp-tag"
                    :style="{
                      backgroundColor: prompt.catBgColor,
                      color: prompt.catColor,
                    }"
                  >
                    {{ prompt.catName }}
                  </span>
                </div>
                <div class="vp-card-actions">
                  <Button
                    variant="ghost"
                    icon="edit"
                    size="small"
                    @click="editPrompt(prompt)"
                  />
                  <Button
                    variant="danger"
                    icon="delete"
                    size="small"
                    @click="requestDelete(prompt.id)"
                  />
                </div>
              </div>
              <div class="vp-card-body">
                <div class="vp-card-desc">
                  {{ prompt.description }}
                </div>

                <div
                  v-for="slot in prompt.contents"
                  :key="slot.id"
                  class="vp-content-block"
                >
                  <div class="vp-content-label">
                    <IconWrapper
                      name="textBox"
                      :size="16"
                    />
                    {{ slot.label }}
                  </div>
                  <div
                    class="vp-content-value"
                    role="button"
                    tabindex="0"
                    :aria-label="`点击复制${slot.label}: ${prompt.title}`"
                    @click="copyContent(slot.text)"
                    @keydown.enter="copyContent(slot.text)"
                    @keydown.space.prevent="copyContent(slot.text)"
                  >
                    <pre>{{ slot.text }}</pre>
                    <div class="vp-copy-hint">
                      <IconWrapper
                        name="contentCopy"
                        :size="14"
                      />
                      {{ i18n?.clickToCopy || '复制' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="filteredPrompts.length === 0"
              class="vp-empty"
              role="status"
            >
              {{ searchQuery ? i18n?.noPromptsFound || '未找到匹配的提示词' : i18n?.noPrompts || '暂无提示词，点击添加' }}
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- 删除确认弹窗 -->
  <div
    v-if="deleteConfirmTarget"
    class="vp-overlay"
    @click="cancelDelete"
    @keydown.escape="cancelDelete"
  >
    <div
      class="vp-modal vp-modal--small"
      @click.stop
    >
      <div class="vp-modal-header">
        <div class="vp-modal-title">
          <IconWrapper
            name="delete"
            :size="20"
            class="vp-modal-icon vp-modal-icon--danger"
          />
          <h2>{{ i18n?.deleteConfirmTitle || '确认删除' }}</h2>
        </div>
        <Button
          variant="ghost"
          icon="close"
          size="small"
          @click="cancelDelete"
        />
      </div>
      <div class="vp-modal-body">
        <p class="vp-delete-msg">{{ i18n?.deleteConfirmMsg || '确定要删除此提示词吗？此操作不可撤销。' }}</p>
        <div class="vp-form-actions">
          <Button
            variant="secondary"
            size="small"
            @click="cancelDelete"
          >
            {{ i18n?.cancel || '取消' }}
          </Button>
          <Button
            variant="danger"
            size="small"
            @click="confirmDelete"
          >
            {{ i18n?.deleteConfirmOK || '确认删除' }}
          </Button>
        </div>
      </div>
    </div>
  </div>

  <!-- 添加/编辑弹窗 -->
  <div
    v-if="showAddModal"
    class="vp-overlay"
    @click="closeAddModal"
    @keydown.escape="closeAddModal"
  >
    <div
      class="vp-modal vp-modal--form"
      @click.stop
    >
      <div class="vp-modal-header">
        <h2>{{ editingPrompt ? i18n?.editPrompt || '编辑提示词' : i18n?.addPrompt || '添加提示词' }}</h2>
        <Button
          variant="ghost"
          icon="close"
          size="small"
          @click="closeAddModal"
        />
      </div>

      <div class="vp-modal-body">
        <form
          class="vp-form"
          @submit.prevent="savePrompt"
        >
          <div class="vp-form-group">
            <label for="prompt-title">{{ i18n?.title || '标题' }}</label>
            <input
              id="prompt-title"
              v-model="promptForm.title"
              type="text"
              class="vp-input"
              :placeholder="i18n?.titlePlaceholder || '请输入提示词标题'"
              required
              aria-required="true"
            />
          </div>

          <div class="vp-form-group">
            <label for="prompt-description">{{ i18n?.description || '描述' }}</label>
            <textarea
              id="prompt-description"
              v-model="promptForm.description"
              class="vp-textarea"
              :placeholder="i18n?.descriptionPlaceholder || '请输入提示词描述'"
              rows="3"
            />
          </div>

          <div class="vp-form-group">
            <label for="prompt-category">{{ i18n?.category || '分类' }}</label>
            <select
              id="prompt-category"
              v-model="promptForm.category"
              class="vp-select"
              required
              aria-required="true"
            >
              <option
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>

          <!-- 动态内容块编辑区 -->
          <div class="vp-content-editor">
            <label class="vp-form-label">{{ i18n?.contents || '内容块' }}</label>
            <div
              v-for="(block, index) in promptForm.contents"
              :key="block.id"
              class="vp-content-editor-item"
            >
              <div class="vp-content-editor-inputs">
                <input
                  v-model="block.label"
                  type="text"
                  class="vp-input vp-input--label"
                  :placeholder="i18n?.contentLabelPlaceholder || '内容标签'"
                  :aria-label="`${i18n?.contentLabel || '内容标签'} ${index + 1}`"
                />
                <textarea
                  v-model="block.text"
                  class="vp-textarea"
                  :placeholder="i18n?.contentPlaceholder || '请输入提示词内容'"
                  rows="5"
                  required
                  :aria-label="`${i18n?.content || '内容'} ${index + 1}`"
                />
              </div>
              <div class="vp-content-editor-actions">
                <Button
                  variant="ghost"
                  icon="up"
                  size="small"
                  :title="i18n?.moveUp || '上移'"
                  :disabled="index === 0"
                  @click="moveContentBlock(index, -1)"
                />
                <Button
                  variant="ghost"
                  icon="down"
                  size="small"
                  :title="i18n?.moveDown || '下移'"
                  :disabled="index === promptForm.contents.length - 1"
                  @click="moveContentBlock(index, 1)"
                />
                <Button
                  variant="danger"
                  icon="delete"
                  size="small"
                  :title="i18n?.removeContent || '删除内容块'"
                  :disabled="promptForm.contents.length <= 1"
                  @click="removeContentBlock(index)"
                />
              </div>
            </div>
            <Button
              variant="secondary"
              icon="add"
              class="vp-content-editor-add"
              @click="addContentBlock"
            >
              {{ i18n?.addContentBlock || '添加内容块' }}
            </Button>
          </div>

          <div class="vp-form-actions">
            <Button
              type="button"
              variant="secondary"
              @click="closeAddModal"
            >
              {{ i18n?.cancel || '取消' }}
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              {{ i18n?.save || '保存' }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 分类管理弹窗 -->
  <div
    v-if="showCategoryManage"
    class="vp-overlay"
    @click="closeCategoryManage"
    @keydown.escape="closeCategoryManage"
  >
    <div
      class="vp-modal vp-modal--small"
      @click.stop
    >
      <div class="vp-modal-header">
        <h2>{{ i18n?.manageCategories || '管理分类' }}</h2>
        <Button
          variant="ghost"
          icon="close"
          size="small"
          :title="i18n?.close || '关闭'"
          @click="closeCategoryManage"
        />
      </div>

      <div class="vp-modal-body">
        <div class="vp-category-form">
          <div class="vp-form-row">
            <input
              v-model="categoryForm.name"
              type="text"
              class="vp-input"
              :placeholder="i18n?.categoryName || '分类名称'"
              aria-label="分类名称"
              @keyup.enter="addCategory"
            />
            <input
              v-model="categoryForm.color"
              type="color"
              class="vp-color-input"
              aria-label="分类颜色"
            />
            <Button
              variant="success"
              icon="add"
              @click="addCategory"
            >
              {{ i18n?.add || '添加' }}
            </Button>
          </div>
        </div>

        <div
          class="vp-category-list"
          role="list"
        >
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="vp-category-item"
            role="listitem"
          >
            <span
              class="vp-category-dot"
              :style="{ backgroundColor: cat.color }"
            />
            <span class="vp-category-name">{{ cat.name }}</span>
            <Button
              variant="danger"
              icon="delete"
              size="small"
              @click="deleteCategory(cat.id)"
            >
              {{ i18n?.delete || '删除' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import type {
  Prompt,
  PromptCategory,
} from "../types"
import type { PromptContent } from "../types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { FloatingBoxStorage } from "../types/storage"

interface PromptDisplay extends Prompt {
  catName: string
  catColor: string
  catBgColor: string
}

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: Plugin
  onClose?: () => void
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const showModal = ref(true)
const showAddModal = ref(false)
const showCategoryManage = ref(false)
const editingPrompt = ref<Prompt | null>(null)
const searchQuery = ref("")
const selectedCategory = ref<string>("all")
const loading = ref(true)
const deleteConfirmTarget = ref<string | null>(null)

const storage = ref<FloatingBoxStorage | null>(null)

const promptForm = ref<{
  title: string
  description: string
  contents: PromptContent[]
  category: string
}>({
  title: "",
  description: "",
  contents: [],
  category: "",
})

const categoryForm = ref({
  name: "",
  color: "#d97757",
})

const prompts = ref<Prompt[]>([])
const categories = ref<PromptCategory[]>([
  { id: "default", name: "默认", color: "#d97757" },
])

const allCategories = computed(() => {
  return [{
    id: "all",
    name: "全部",
    color: "#d97757",
  }, ...categories.value]
})

const categoryMap = computed(() => {
  const map = new Map<string, PromptCategory>()
  for (const cat of categories.value) {
    map.set(cat.id, cat)
  }
  return map
})

const getCategoryById = (id: string): PromptCategory => {
  return categoryMap.value.get(id) || categories.value[0]
}

onMounted(async () => {
  if (props.plugin) {
    storage.value = new FloatingBoxStorage(props.plugin)
  }
  await Promise.all([loadPrompts(), loadCategories()])
  loading.value = false

  if (categories.value.length > 0 && !promptForm.value.category) {
    promptForm.value.category = categories.value[0].id
  }
})

const filteredPrompts = computed<PromptDisplay[]>(() => {
  let result = prompts.value

  if (selectedCategory.value !== "all") {
    result = result.filter(
      (prompt) => prompt.category === selectedCategory.value,
    )
  }

  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    result = result.filter(
      (prompt) =>
        prompt.title?.toLowerCase().includes(query)
        || prompt.description?.toLowerCase().includes(query)
        || (!prompt.contents ? false : prompt.contents.some(
          (c) => c.text?.toLowerCase().includes(query) || c.label?.toLowerCase().includes(query),
        )),
    )
  }

  return result.map((prompt) => {
    const cat = getCategoryById(prompt.category)
    return {
      ...prompt,
      catName: cat.name,
      catColor: cat.color,
      catBgColor: `${cat.color}20`,
    }
  })
})

const selectCategory = (categoryId: string) => {
  selectedCategory.value = categoryId
}

async function loadPrompts() {
  if (!storage.value) return
  const loaded = await storage.value.prompts.loadOrDefault()
  if (Array.isArray(loaded)) {
    const needMigration = loaded.some(
      (p) => !p.contents || !Array.isArray(p.contents) || (p.content && (!p.contents || p.contents.length === 0)),
    )
    if (needMigration && storage.value) {
      const migrated = storage.value.migratePrompts(loaded)
      if (migrated) {
        await storage.value.prompts.save(loaded)
      }
    }
    prompts.value = loaded
  } else {
    prompts.value = []
  }
}

async function loadCategories() {
  if (!storage.value) return
  const loaded = await storage.value.categories.loadOrDefault()
  if (Array.isArray(loaded) && loaded.length > 0) {
    categories.value = loaded.map((cat) => ({
      ...cat,
      color: cat.color || "#d97757",
    }))
  } else {
    categories.value = [{ id: "default", name: "默认", color: "#d97757" }]
  }
}

async function saveCategories() {
  if (!storage.value) return
  await storage.value.categories.save(categories.value)
}

async function savePrompts() {
  if (!storage.value) return
  await storage.value.prompts.save(prompts.value)
}

/** 生成唯一内容块 ID */
function generateContentId(): string {
  return `c${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 创建空白内容块 */
function createEmptyContentBlock(label?: string): PromptContent {
  return {
    id: generateContentId(),
    label: label || "",
    text: "",
  }
}

/** 添加内容块 */
function addContentBlock() {
  promptForm.value.contents.push(createEmptyContentBlock())
}

/** 删除内容块 */
function removeContentBlock(index: number) {
  if (promptForm.value.contents.length <= 1) return
  promptForm.value.contents.splice(index, 1)
}

/** 移动内容块（上移/下移） */
function moveContentBlock(index: number, direction: -1 | 1) {
  const contents = promptForm.value.contents
  const target = index + direction
  if (target < 0 || target >= contents.length) return
  const tmp = contents[index]
  contents[index] = contents[target]
  contents[target] = tmp
  // 触发响应式
  promptForm.value.contents = [...contents]
}

function openAddModal() {
  editingPrompt.value = null
  promptForm.value = {
    title: "",
    description: "",
    contents: [createEmptyContentBlock()],
    category: categories.value[0]?.id || "default",
  }
  showAddModal.value = true
}

function editPrompt(prompt: Prompt) {
  editingPrompt.value = prompt
  promptForm.value = {
    title: prompt.title,
    description: prompt.description,
    contents: prompt.contents && prompt.contents.length > 0
      ? prompt.contents.map((c) => ({ ...c }))
      : [createEmptyContentBlock()],
    category: prompt.category,
  }
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
  editingPrompt.value = null
}

async function savePrompt() {
  // 验证标题
  if (!promptForm.value.title.trim()) {
    showMessage("标题是必填项", 2000, "error")
    return
  }
  // 验证至少一个非空内容块
  const validContents = promptForm.value.contents.filter((c) => c.text.trim())
  if (validContents.length === 0) {
    showMessage("至少需要一个非空内容块", 2000, "error")
    return
  }

  if (editingPrompt.value) {
    const index = prompts.value.findIndex(
      (p) => p.id === editingPrompt.value!.id,
    )
    if (index !== -1) {
      prompts.value[index] = {
        ...editingPrompt.value,
        title: promptForm.value.title.trim(),
        description: promptForm.value.description.trim(),
        contents: promptForm.value.contents
          .filter((c) => c.text.trim())
          .map((c) => ({
            id: c.id,
            label: c.label.trim() || `内容`,
            text: c.text.trim(),
          })),
        category: promptForm.value.category,
      }
    }
  } else {
    const newPrompt: Prompt = {
      id: Date.now().toString(),
      title: promptForm.value.title.trim(),
      description: promptForm.value.description.trim(),
      contents: promptForm.value.contents
        .filter((c) => c.text.trim())
        .map((c) => ({
          id: c.id,
          label: c.label.trim() || `内容`,
          text: c.text.trim(),
        })),
      category: promptForm.value.category,
    }
    prompts.value.push(newPrompt)
  }

  await savePrompts()
  closeAddModal()
}

function openCategoryManage() {
  categoryForm.value = { name: "", color: "#d97757" }
  showCategoryManage.value = true
}

function closeCategoryManage() {
  showCategoryManage.value = false
}

async function addCategory() {
  if (!categoryForm.value.name.trim()) {
    showMessage("分类名称不能为空", 2000, "error")
    return
  }

  const newCategory: PromptCategory = {
    id: Date.now().toString(),
    name: categoryForm.value.name.trim(),
    color: categoryForm.value.color,
  }

  categories.value.push(newCategory)
  await saveCategories()

  categoryForm.value = { name: "", color: "#d97757" }
}

async function deleteCategory(id: string) {
  const hasPromptsInCategory = prompts.value.some((p) => p.category === id)
  if (hasPromptsInCategory) {
    showMessage("无法删除：该分类下还有提示词", 3000, "error")
    return
  }

  categories.value = categories.value.filter((c) => c.id !== id)
  if (selectedCategory.value === id) {
    selectedCategory.value = "all"
  }
  await saveCategories()
  showMessage("分类已删除", 2000, "info")
}

function requestDelete(id: string) {
  deleteConfirmTarget.value = id
}

function cancelDelete() {
  deleteConfirmTarget.value = null
}

async function confirmDelete() {
  const id = deleteConfirmTarget.value
  if (!id) return
  prompts.value = prompts.value.filter((p) => p.id !== id)
  await savePrompts()
  deleteConfirmTarget.value = null
  showMessage("提示词已删除", 2000, "info")
}

async function copyContent(content: string) {
  const ok = await copyToClipboard(content)
  if (!ok) showMessage("复制失败，请手动复制", 2000, "error")
}

function closeModal() {
  showModal.value = false
  emit("close")
  props.onClose?.()
}
</script>

<style lang="scss" scoped>
@use '../styles/PromptsModal.scss';
</style>
