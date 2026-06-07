<template>
  <div
    v-if="showModal"
    class="skills-modal-overlay"
    @click="closeModal"
  >
    <div
      class="skills-modal"
      @click.stop
    >
      <div class="skills-modal-header">
        <div class="header-title">
          <IconWrapper
            name="starCircle"
            :size="24"
            class="header-icon"
          />
          <h2>{{ i18n?.skillsTitle || '技能库' }}</h2>
        </div>
        <div class="header-actions">
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

      <div class="skills-modal-body">
        <div class="category-filter">
          <button
            v-for="cat in allCategories"
            :key="cat.id"
            class="category-chip"
            :class="{ active: selectedCategory === cat.id }"
            :aria-pressed="selectedCategory === cat.id"
            @click="selectCategory(cat.id)"
          >
            <span
              class="chip-dot"
              :style="{ backgroundColor: cat.color }"
            ></span>
            {{ cat.name }}
          </button>
        </div>

        <div class="skills-controls">
          <div class="search-wrapper">
            <IconWrapper
              name="search"
              :size="18"
              class="search-icon"
            />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="i18n?.search || '搜索技能...'"
              class="search-input"
              aria-label="搜索技能"
            />
          </div>

          <Button
            variant="primary"
            size="small"
            @click="openAddModal"
          >
            {{ i18n?.addSkill || '添加技能' }}
          </Button>
        </div>

        <div class="skills-grid">
          <div
            v-for="skill in filteredSkills"
            :key="skill.id"
            class="skill-card"
            role="article"
            :aria-label="`技能: ${skill.title}`"
          >
            <div class="skill-header">
              <div class="skill-title-wrapper">
                <IconWrapper
                  name="star"
                  :size="18"
                  class="skill-icon"
                />
                <h3>{{ skill.title }}</h3>
                <span
                  class="skill-category-tag"
                  :style="{
                    backgroundColor: `${getCategoryById(skill.category)?.color}20`,
                    color: getCategoryById(skill.category)?.color,
                  }"
                >
                  {{ getCategoryById(skill.category)?.name || '未分类' }}
                </span>
              </div>
              <div class="skill-actions">
                <Button
                  variant="ghost"
                  icon="edit"
                  size="small"
                  @click="editSkill(skill)"
                />
                <Button
                  variant="danger"
                  icon="delete"
                  size="small"
                  @click="deleteSkill(skill.id)"
                />
              </div>
            </div>
            <div class="skill-description">
              {{ skill.description }}
            </div>
            <div class="skill-content">
              <div class="content-label">
                <IconWrapper
                  name="textBox"
                  :size="16"
                />
                {{ i18n?.content || '内容' }}
              </div>
              <div
                class="content-value"
                role="button"
                tabindex="0"
                :aria-label="`点击复制内容: ${skill.title}`"
                @click="copyContent(skill.content)"
              >
                <pre>{{ skill.content }}</pre>
                <div class="copy-hint">
                  <IconWrapper
                    name="contentCopy"
                    :size="14"
                  />
                  {{ i18n?.clickToCopy || '复制' }}
                </div>
              </div>
            </div>

            <div
              v-if="skill.content2"
              class="skill-content"
            >
              <div class="content-label">
                <IconWrapper
                  name="textBox"
                  :size="16"
                />
                {{ i18n?.content2 || '内容2' }}
              </div>
              <div
                class="content-value"
                role="button"
                tabindex="0"
                :aria-label="`点击复制内容2: ${skill.title}`"
                @click="copyContent(skill.content2)"
              >
                <pre>{{ skill.content2 }}</pre>
                <div class="copy-hint">
                  <IconWrapper
                    name="contentCopy"
                    :size="14"
                  />
                  {{ i18n?.clickToCopy || '复制' }}
                </div>
              </div>
            </div>

            <div
              v-if="skill.content3"
              class="skill-content"
            >
              <div class="content-label">
                <IconWrapper
                  name="textBox"
                  :size="16"
                />
                {{ i18n?.content3 || '内容3' }}
              </div>
              <div
                class="content-value"
                role="button"
                tabindex="0"
                :aria-label="`点击复制内容3: ${skill.title}`"
                @click="copyContent(skill.content3)"
              >
                <pre>{{ skill.content3 }}</pre>
                <div class="copy-hint">
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
            v-if="filteredSkills.length === 0"
            class="no-skills"
            role="status"
          >
            {{ searchQuery ? i18n?.noSkillsFound || '未找到匹配的技能' : i18n?.noSkills || '暂无技能，点击添加' }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="showAddModal"
    class="skills-modal-overlay"
    @click="closeAddModal"
  >
    <div
      class="skills-modal small"
      @click.stop
    >
      <div class="skills-modal-header">
        <h2>{{ editingSkill ? i18n?.editSkill || '编辑技能' : i18n?.addSkill || '添加技能' }}</h2>
        <Button
          variant="ghost"
          icon="close"
          size="small"
          @click="closeAddModal"
        />
      </div>

      <div class="skills-modal-body">
        <form
          class="skill-form"
          @submit.prevent="saveSkill"
          @keydown.enter.prevent
        >
          <div class="form-group">
            <label for="skill-title">{{ i18n?.title || '标题' }}</label>
            <input
              id="skill-title"
              v-model="skillForm.title"
              type="text"
              :placeholder="i18n?.titlePlaceholder || '请输入技能标题'"
              required
              aria-required="true"
            />
          </div>

          <div class="form-group">
            <label for="skill-description">{{ i18n?.description || '描述' }}</label>
            <textarea
              id="skill-description"
              v-model="skillForm.description"
              :placeholder="i18n?.descriptionPlaceholder || '请输入技能描述'"
              rows="3"
              class="description-textarea"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="skill-category">{{ i18n?.category || '分类' }}</label>
            <select
              id="skill-category"
              v-model="skillForm.category"
              class="category-select"
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

          <div class="form-group">
            <label for="skill-content">{{ i18n?.content || '内容' }}</label>
            <textarea
              id="skill-content"
              v-model="skillForm.content"
              :placeholder="i18n?.contentPlaceholder || '请输入要复制的内容'"
              rows="6"
              required
              aria-required="true"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="skill-content2">{{ i18n?.content2 || '内容2' }}</label>
            <textarea
              id="skill-content2"
              v-model="skillForm.content2"
              :placeholder="i18n?.content2Placeholder || '请输入要复制的内容2'"
              rows="6"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="skill-content3">{{ i18n?.content3 || '内容3' }}</label>
            <textarea
              id="skill-content3"
              v-model="skillForm.content3"
              :placeholder="i18n?.content3Placeholder || '请输入要复制的内容3'"
              rows="6"
            ></textarea>
          </div>

          <div class="form-actions">
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
    class="skills-modal-overlay"
    @click="closeCategoryManage"
  >
    <div
      class="skills-modal small"
      @click.stop
    >
      <div class="skills-modal-header">
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

      <div class="skills-modal-body">
        <div class="add-category-form">
          <div class="form-row">
            <input
              v-model="categoryForm.name"
              type="text"
              :placeholder="i18n?.categoryName || '分类名称'"
              class="input-name"
              aria-label="分类名称"
              @keyup.enter="addCategory"
            />
            <input
              v-model="categoryForm.color"
              type="color"
              class="input-color"
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
          class="category-list"
          role="list"
        >
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="category-item"
            role="listitem"
          >
            <span
              class="category-dot"
              :style="{ backgroundColor: cat.color }"
            ></span>
            <span class="category-name">{{ cat.name }}</span>
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
import type {
  Skill,
  SkillCategory,
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

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
  onClose?: () => void
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const showModal = ref(true)
const showAddModal = ref(false)
const showCategoryManage = ref(false)
const editingSkill = ref<Skill | null>(null)
const searchQuery = ref("")
const selectedCategory = ref<string>("all")

const storage = computed(() => {
  if (!props.plugin) return null
  return new FloatingBoxStorage(props.plugin)
})

const skillForm = ref({
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

const skills = ref<Skill[]>([])
const categories = ref<SkillCategory[]>([
  {
    id: "default",
    name: "默认",
    color: "#d97757",
  },
])

const allCategories = computed(() => {
  return [{
    id: "all",
    name: "全部",
    color: "#d97757",
  }, ...categories.value]
})

onMounted(async () => {
  await Promise.all([loadSkills(), loadCategories()])

  if (categories.value.length > 0 && !skillForm.value.category) {
    skillForm.value.category = categories.value[0].id
  }
})

const filteredSkills = computed(() => {
  let result = skills.value

  if (selectedCategory.value !== "all") {
    result = result.filter(
      (skill) => skill.category === selectedCategory.value,
    )
  }

  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    result = result.filter(
      (skill) =>
        skill.title?.toLowerCase().includes(query)
        || skill.description?.toLowerCase().includes(query)
        || skill.content?.toLowerCase().includes(query),
    )
  }

  return result
})

const getCategoryById = (id: string): SkillCategory => {
  return categories.value.find((c) => c.id === id) || categories.value[0]
}

const selectCategory = (categoryId: string) => {
  selectedCategory.value = categoryId
}

async function loadSkills() {
  if (!storage.value) return
  const loaded = await storage.value.skills.loadOrDefault()
  skills.value = Array.isArray(loaded) ? loaded : []
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
    categories.value = [{
      id: "default",
      name: "默认",
      color: "#d97757",
    }]
  }
}

async function saveCategories() {
  if (!storage.value) return
  await storage.value.categories.save(categories.value)
}

async function saveSkills() {
  if (!storage.value) return
  await storage.value.skills.save(skills.value)
}

function openAddModal() {
  editingSkill.value = null
  skillForm.value = {
    title: "",
    description: "",
    content: "",
    content2: "",
    content3: "",
    category: categories.value[0]?.id || "default",
  }
  showAddModal.value = true
}

function editSkill(skill: Skill) {
  editingSkill.value = skill
  skillForm.value = {
    title: skill.title,
    description: skill.description,
    content: skill.content,
    content2: skill.content2 || "",
    content3: skill.content3 || "",
    category: skill.category,
  }
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
  editingSkill.value = null
}

async function saveSkill() {
  try {
    if (!skillForm.value.title.trim() || !skillForm.value.content.trim()) {
      alert("标题和内容是必填项")
      return
    }

    if (editingSkill.value) {
      const index = skills.value.findIndex(
        (s) => s.id === editingSkill.value!.id,
      )
      if (index !== -1) {
        skills.value[index] = {
          ...editingSkill.value,
          title: skillForm.value.title.trim(),
          description: skillForm.value.description.trim(),
          content: skillForm.value.content.trim(),
          content2: skillForm.value.content2.trim(),
          content3: skillForm.value.content3.trim(),
          category: skillForm.value.category,
        }
      }
    } else {
      const newSkill: Skill = {
        id: Date.now().toString(),
        title: skillForm.value.title.trim(),
        description: skillForm.value.description.trim(),
        content: skillForm.value.content.trim(),
        content2: skillForm.value.content2.trim(),
        content3: skillForm.value.content3.trim(),
        category: skillForm.value.category,
      }
      skills.value.push(newSkill)
    }

    await saveSkills()
    closeAddModal()
  } catch (error) {
    console.error("Failed to save skill:", error)
    alert("保存失败，请重试")
  }
}

function openCategoryManage() {
  categoryForm.value = {
    name: "",
    color: "#d97757",
  }
  showCategoryManage.value = true
}

function closeCategoryManage() {
  showCategoryManage.value = false
}

async function addCategory() {
  if (!categoryForm.value.name.trim()) {
    alert("分类名称不能为空")
    return
  }

  const newCategory: SkillCategory = {
    id: Date.now().toString(),
    name: categoryForm.value.name.trim(),
    color: categoryForm.value.color,
  }

  categories.value.push(newCategory)
  await saveCategories()

  categoryForm.value = {
    name: "",
    color: "#d97757",
  }
}

async function deleteCategory(id: string) {
  const hasSkillsInCategory = skills.value.some((s) => s.category === id)
  if (hasSkillsInCategory) {
    alert("无法删除：该分类下还有技能")
    return
  }

  if (confirm("确定要删除这个分类吗？")) {
    categories.value = categories.value.filter((c) => c.id !== id)
    if (selectedCategory.value === id) {
      selectedCategory.value = "all"
    }
    await saveCategories()
  }
}

async function deleteSkill(id: string) {
  if (confirm("确定要删除这个技能吗？")) {
    skills.value = skills.value.filter((s) => s.id !== id)
    await saveSkills()
  }
}

async function copyContent(content: string) {
  const ok = await copyToClipboard(content)
  if (!ok) alert("复制失败，请手动复制")
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
