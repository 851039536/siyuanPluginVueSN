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
            @click="openCategoryManage"
          >
            {{ i18n?.manageCategories || '管理分类' }}
          </Button>
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
                    @click="deletePrompt(prompt.id)"
                  />
                </div>
              </div>
              <div class="vp-card-desc">
                {{ prompt.description }}
              </div>

              <div
                v-for="slot in prompt.contents"
                :key="slot.key"
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

  <div
    v-if="showAddModal"
    class="vp-overlay"
    @click="closeAddModal"
    @keydown.escape="closeAddModal"
  >
    <div
      class="vp-modal vp-modal--small"
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

          <div class="vp-form-group">
            <label for="prompt-content">{{ i18n?.content || '内容' }}</label>
            <textarea
              id="prompt-content"
              v-model="promptForm.content"
              class="vp-textarea"
              :placeholder="i18n?.contentPlaceholder || '请输入提示词内容'"
              rows="6"
              required
              aria-required="true"
            />
          </div>

          <div class="vp-form-group">
            <label for="prompt-content2">{{ i18n?.content2 || '内容2' }}</label>
            <textarea
              id="prompt-content2"
              v-model="promptForm.content2"
              class="vp-textarea"
              :placeholder="i18n?.content2Placeholder || '请输入提示词内容2'"
              rows="6"
            />
          </div>

          <div class="vp-form-group">
            <label for="prompt-content3">{{ i18n?.content3 || '内容3' }}</label>
            <textarea
              id="prompt-content3"
              v-model="promptForm.content3"
              class="vp-textarea"
              :placeholder="i18n?.content3Placeholder || '请输入提示词内容3'"
              rows="6"
            />
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
          variant="secondary"
          icon="close"
          icon-position="right"
          @click="closeCategoryManage"
        >
          {{ i18n?.close || '关闭' }}
        </Button>
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
import {
  computed,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { FloatingBoxStorage } from "../types/storage"

interface ContentSlot {
  key: string
  label: string
  text: string
}

interface PromptDisplay extends Prompt {
  catName: string
  catColor: string
  catBgColor: string
  contents: ContentSlot[]
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

const storage = ref<FloatingBoxStorage | null>(null)

const promptForm = ref({
  title: "",
  description: "",
  content: "",
  content2: "",
  content3: "",
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
        || prompt.content?.toLowerCase().includes(query)
        || (prompt.content2 || "")?.toLowerCase().includes(query)
        || (prompt.content3 || "")?.toLowerCase().includes(query),
    )
  }

  return result.map((prompt) => {
    const cat = getCategoryById(prompt.category)
    const contents: ContentSlot[] = []
    if (prompt.content) {
      contents.push({ key: "content", label: props.i18n?.content || "内容", text: prompt.content })
    }
    if (prompt.content2) {
      contents.push({ key: "content2", label: props.i18n?.content2 || "内容2", text: prompt.content2 })
    }
    if (prompt.content3) {
      contents.push({ key: "content3", label: props.i18n?.content3 || "内容3", text: prompt.content3 })
    }

    return {
      ...prompt,
      catName: cat.name,
      catColor: cat.color,
      catBgColor: `${cat.color}20`,
      contents,
    }
  })
})

const selectCategory = (categoryId: string) => {
  selectedCategory.value = categoryId
}

async function loadPrompts() {
  if (!storage.value) return
  const loaded = await storage.value.prompts.loadOrDefault()
  prompts.value = Array.isArray(loaded) ? loaded : []
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

function openAddModal() {
  editingPrompt.value = null
  promptForm.value = {
    title: "",
    description: "",
    content: "",
    content2: "",
    content3: "",
    category: categories.value[0]?.id || "default",
  }
  showAddModal.value = true
}

function editPrompt(prompt: Prompt) {
  editingPrompt.value = prompt
  promptForm.value = {
    title: prompt.title,
    description: prompt.description,
    content: prompt.content,
    content2: prompt.content2 || "",
    content3: prompt.content3 || "",
    category: prompt.category,
  }
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
  editingPrompt.value = null
}

async function savePrompt() {
  try {
    if (!promptForm.value.title.trim() || !promptForm.value.content.trim()) {
      showMessage("标题和内容是必填项", 2000, "error")
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
          content: promptForm.value.content.trim(),
          content2: promptForm.value.content2.trim(),
          content3: promptForm.value.content3.trim(),
          category: promptForm.value.category,
        }
      }
    } else {
      const newPrompt: Prompt = {
        id: Date.now().toString(),
        title: promptForm.value.title.trim(),
        description: promptForm.value.description.trim(),
        content: promptForm.value.content.trim(),
        content2: promptForm.value.content2.trim(),
        content3: promptForm.value.content3.trim(),
        category: promptForm.value.category,
      }
      prompts.value.push(newPrompt)
    }

    await savePrompts()
    closeAddModal()
  } catch (error) {
    console.error("Failed to save prompt:", error)
    showMessage("保存失败，请重试", 2000, "error")
  }
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

async function deletePrompt(id: string) {
  prompts.value = prompts.value.filter((p) => p.id !== id)
  await savePrompts()
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
@use '../styles/index.scss';
</style>
