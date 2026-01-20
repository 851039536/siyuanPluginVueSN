<template>
  <div v-if="showModal" class="skills-modal-overlay" @click="handleOverlayClick">
    <div class="skills-modal" @click.stop>
      <div class="skills-modal-header">
        <div class="header-title">
          <svg class="header-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 14l2 2 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2>{{ i18n?.skillsTitle || '技能库' }}</h2>
        </div>
        <div class="header-actions">
          <button class="icon-btn" @click="openCategoryManage" :title="i18n?.manageCategories || '管理分类'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="close-btn" @click="closeModal" :title="i18n?.close || '关闭'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="skills-modal-body">
        <!-- 分类筛选器 -->
        <div class="category-filter">
          <button
            v-for="cat in [{ id: 'all', name: '全部', color: '#6b7280' }, ...categories]"
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

        <div class="skills-controls">
          <div class="search-wrapper">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/>
              <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="i18n?.search || '搜索技能...'"
              class="search-input"
            />
          </div>
          <button class="add-btn" @click="openAddModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ i18n?.addSkill || '添加技能' }}
          </button>
        </div>

        <div class="skills-grid">
          <div
            v-for="skill in filteredSkills"
            :key="skill.id"
            class="skill-card"
          >
            <div class="skill-header">
              <div class="skill-title-wrapper">
                <svg class="skill-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3>{{ skill.title }}</h3>
                <span class="skill-category-tag" :style="{ backgroundColor: getCategoryById(skill.category)?.color + '20', color: getCategoryById(skill.category)?.color }">
                  {{ getCategoryById(skill.category)?.name || '未分类' }}
                </span>
              </div>
              <div class="skill-actions">
                <button @click="editSkill(skill)" :title="i18n?.edit || '编辑'">
                  {{ i18n?.edit || '编辑' }}
                </button>
                <button @click="deleteSkill(skill.id)" :title="i18n?.delete || '删除'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="skill-description">
              {{ skill.description }}
            </div>
            <div class="skill-content">
              <div class="content-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16v16H4V4z" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                {{ i18n?.content || '内容' }}
              </div>
              <div class="content-value" @click="copyContent(skill.content)">
                <pre>{{ skill.content }}</pre>
                <div class="copy-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  {{ i18n?.clickToCopy || '点击复制' }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="filteredSkills.length === 0" class="no-skills">
            {{ searchQuery ? i18n?.noSkillsFound || '未找到匹配的技能' : i18n?.noSkills || '暂无技能，点击添加' }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add/Edit Skill Modal -->
  <div v-if="showAddModal" class="skills-modal-overlay" @click="handleAddOverlayClick">
    <div class="skills-modal small" @click.stop>
      <div class="skills-modal-header">
        <h2>{{ editingSkill ? i18n?.editSkill || '编辑技能' : i18n?.addSkill || '添加技能' }}</h2>
        <button class="close-btn" @click="closeAddModal" :title="i18n?.close || '关闭'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="skills-modal-body">
        <form @submit.prevent="saveSkill" class="skill-form">
          <div class="form-group">
            <label>{{ i18n?.title || '标题' }}</label>
            <input
              v-model="skillForm.title"
              type="text"
              :placeholder="i18n?.titlePlaceholder || '请输入技能标题'"
              required
            />
          </div>

          <div class="form-group">
            <label>{{ i18n?.description || '描述' }}</label>
            <input
              v-model="skillForm.description"
              type="text"
              :placeholder="i18n?.descriptionPlaceholder || '请输入技能描述'"
            />
          </div>

          <div class="form-group">
            <label>{{ i18n?.category || '分类' }}</label>
            <select v-model="skillForm.category" class="category-select" required>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ i18n?.content || '内容' }}</label>
            <textarea
              v-model="skillForm.content"
              :placeholder="i18n?.contentPlaceholder || '请输入要复制的内容'"
              rows="6"
              required
            ></textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="cancel-btn" @click="closeAddModal">
              {{ i18n?.cancel || '取消' }}
            </button>
            <button type="submit" class="save-btn">
              {{ i18n?.save || '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Category Manage Modal -->
  <div v-if="showCategoryManage" class="skills-modal-overlay" @click="closeCategoryManage">
    <div class="skills-modal small" @click.stop>
      <div class="skills-modal-header">
        <h2>{{ i18n?.manageCategories || '管理分类' }}</h2>
        <button class="close-btn" @click="closeCategoryManage" :title="i18n?.close || '关闭'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="skills-modal-body">
        <!-- 添加分类表单 -->
        <div class="add-category-form">
          <div class="form-row">
            <input
              v-model="categoryForm.name"
              type="text"
              :placeholder="i18n?.categoryName || '分类名称'"
              class="input-name"
              @keyup.enter="addCategory"
            />
            <input
              v-model="categoryForm.color"
              type="color"
              class="input-color"
            />
            <button class="add-category-btn" @click="addCategory">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 分类列表 -->
        <div class="category-list">
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="category-item"
          >
            <span class="category-dot" :style="{ backgroundColor: cat.color }"></span>
            <span class="category-name">{{ cat.name }}</span>
            <button class="delete-category-btn" @click="deleteCategory(cat.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Skill, SkillCategory } from './types'

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
}>()

const emit = defineEmits<{
  close: []
}>()

const showModal = ref(true)
const showAddModal = ref(false)
const showCategoryManage = ref(false)
const editingSkill = ref<Skill | null>(null)
const searchQuery = ref('')
const selectedCategory = ref<string>('all')

const skillForm = ref({
  title: '',
  description: '',
  content: '',
  category: ''
})

const categoryForm = ref({
  name: '',
  color: '#3b82f6'
})

const skills = ref<Skill[]>([])
const categories = ref<SkillCategory[]>([
  { id: 'default', name: '默认', color: '#6b7280' }
])

// Load skills from Siyuan API
onMounted(async () => {
  await loadSkills()
  await loadCategories()
})

const filteredSkills = computed(() => {
  let result = skills.value

  // 按分类筛选
  if (selectedCategory.value !== 'all') {
    result = result.filter(skill => skill.category === selectedCategory.value)
  }

  // 按搜索词筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(skill =>
      skill.title.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query) ||
      skill.content.toLowerCase().includes(query)
    )
  }

  return result
})

// 获取分类对象
const getCategoryById = (id: string) => {
  return categories.value.find(c => c.id === id) || categories.value[0]
}

async function loadSkills() {
  if (!props.plugin) return
  try {
    const stored = await props.plugin.loadData('siyuan-skills')
    if (stored) {
      skills.value = stored as Skill[]
    }
  } catch (error) {
    console.error('Failed to load skills:', error)
  }
}

async function loadCategories() {
  if (!props.plugin) return
  try {
    const stored = await props.plugin.loadData('siyuan-categories')
    if (stored) {
      categories.value = stored as SkillCategory[]
    }
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
}

async function saveCategories() {
  if (!props.plugin) return
  try {
    await props.plugin.saveData('siyuan-categories', categories.value)
  } catch (error) {
    console.error('Failed to save categories:', error)
  }
}

async function saveSkills() {
  if (!props.plugin) return
  try {
    await props.plugin.saveData('siyuan-skills', skills.value)
  } catch (error) {
    console.error('Failed to save skills:', error)
  }
}

function openAddModal() {
  editingSkill.value = null
  skillForm.value = {
    title: '',
    description: '',
    content: '',
    category: categories.value[0]?.id || ''
  }
  showAddModal.value = true
}

function editSkill(skill: Skill) {
  editingSkill.value = skill
  skillForm.value = {
    title: skill.title,
    description: skill.description,
    content: skill.content,
    category: skill.category
  }
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
  editingSkill.value = null
}

function handleAddOverlayClick() {
  closeAddModal()
}

async function saveSkill() {
  try {
    if (editingSkill.value) {
      // Update existing skill
      const index = skills.value.findIndex(s => s.id === editingSkill.value!.id)
      if (index !== -1) {
        skills.value[index] = {
          ...editingSkill.value,
          title: skillForm.value.title,
          description: skillForm.value.description,
          content: skillForm.value.content,
          category: skillForm.value.category
        }
      }
    } else {
      // Add new skill
      const newSkill: Skill = {
        id: Date.now().toString(),
        title: skillForm.value.title,
        description: skillForm.value.description,
        content: skillForm.value.content,
        category: skillForm.value.category
      }
      skills.value.push(newSkill)
    }

    await saveSkills()
    closeAddModal()
  } catch (error) {
    console.error('Failed to save skill:', error)
  }
}

// 分类管理相关函数
function openCategoryManage() {
  categoryForm.value = {
    name: '',
    color: '#3b82f6'
  }
  showCategoryManage.value = true
}

function closeCategoryManage() {
  showCategoryManage.value = false
}

async function addCategory() {
  if (!categoryForm.value.name.trim()) return

  const newCategory: SkillCategory = {
    id: Date.now().toString(),
    name: categoryForm.value.name,
    color: categoryForm.value.color
  }

  categories.value.push(newCategory)
  await saveCategories()

  categoryForm.value = {
    name: '',
    color: '#3b82f6'
  }
}

async function deleteCategory(id: string) {
  // 检查是否有技能使用该分类
  const hasSkillsInCategory = skills.value.some(s => s.category === id)
  if (hasSkillsInCategory) {
    alert('无法删除：该分类下还有技能')
    return
  }

  if (confirm('确定要删除这个分类吗？')) {
    categories.value = categories.value.filter(c => c.id !== id)
    // 如果当前选中了被删除的分类，切换到全部
    if (selectedCategory.value === id) {
      selectedCategory.value = 'all'
    }
    await saveCategories()
  }
}

async function deleteSkill(id: string) {
  if (confirm('确定要删除这个技能吗？')) {
    skills.value = skills.value.filter(s => s.id !== id)
    await saveSkills()
  }
}

function copyContent(content: string) {
  navigator.clipboard.writeText(content).then(() => {
    // Could add a toast notification here
    console.log('Content copied to clipboard')
  }).catch(err => {
    console.error('Failed to copy content:', err)
  })
}

function closeModal() {
  showModal.value = false
  emit('close')
}

function handleOverlayClick() {
  closeModal()
}
</script>
<style lang="scss" scoped>
@use './Skills.scss';
</style>
