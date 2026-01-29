<template>
  <div v-if="showModal" class="skills-modal-overlay" @click="closeModal">
    <div class="skills-modal" @click.stop>
      <div class="skills-modal-header">
        <div class="header-title">
         <IconWrapper name="starCircle" :size="24" class="header-icon" />
          <h2>{{ i18n?.skillsTitle || '技能库' }}</h2>
        </div>
        <div class="header-actions">
          <Button variant="ghost" size="small" icon="listBulleted" @click="openCategoryManage">
            {{ i18n?.manageCategories || '管理分类' }}
          </Button>
          <Button variant="ghost" icon="close" size="small" @click="closeModal" />
        </div>
      </div>

      <div class="skills-modal-body">
        <!-- 分类筛选器 -->
        <div class="category-filter">
          <button
            v-for="cat in allCategories"
            :key="cat.id"
            class="category-chip"
            :class="{ active: selectedCategory === cat.id }"
            @click="selectCategory(cat.id)"
            :aria-pressed="selectedCategory === cat.id"
          >
            <span class="chip-dot" :style="{ backgroundColor: cat.color }"></span>
            {{ cat.name }}
          </button>
        </div>

        <div class="skills-controls">
          <div class="search-wrapper">
            <IconWrapper name="search" :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="i18n?.search || '搜索技能...'"
              class="search-input"
              aria-label="搜索技能"
            />
          </div>

          <Button variant="primary" size="small" @click="openAddModal">
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
                <IconWrapper name="star" :size="18" class="skill-icon" />
                <h3>{{ skill.title }}</h3>
                <span class="skill-category-tag" :style="{ backgroundColor: getCategoryById(skill.category)?.color + '20', color: getCategoryById(skill.category)?.color }">
                  {{ getCategoryById(skill.category)?.name || '未分类' }}
                </span>
              </div>
              <div class="skill-actions">
                <Button variant="ghost" icon="edit" size="small" @click="editSkill(skill)" />
                <Button variant="danger" icon="delete" size="small" @click="deleteSkill(skill.id)" />
              </div>
            </div>
            <div class="skill-description">
              {{ skill.description }}
            </div>
            <div class="skill-content">
              <div class="content-label">
                <IconWrapper name="textBox" :size="16" />
                {{ i18n?.content || '内容' }}
              </div>
              <div class="content-value" @click="copyContent(skill.content)" role="button" tabindex="0" :aria-label="`点击复制内容: ${skill.title}`">
                <pre>{{ skill.content }}</pre>
                <div class="copy-hint">
                  <IconWrapper name="contentCopy" :size="14" />
                  {{ i18n?.clickToCopy || '点击复制' }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="filteredSkills.length === 0" class="no-skills" role="status">
            {{ searchQuery ? i18n?.noSkillsFound || '未找到匹配的技能' : i18n?.noSkills || '暂无技能，点击添加' }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add/Edit Skill Modal -->
  <div v-if="showAddModal" class="skills-modal-overlay" @click="closeAddModal">
    <div class="skills-modal small" @click.stop>
      <div class="skills-modal-header">
        <h2>{{ editingSkill ? i18n?.editSkill || '编辑技能' : i18n?.addSkill || '添加技能' }}</h2>
        <Button variant="ghost" icon="close" size="small" @click="closeAddModal" />
      </div>

      <div class="skills-modal-body">
        <form @submit.prevent="saveSkill" class="skill-form" @keydown.enter.prevent>
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
            <select v-model="skillForm.category" class="category-select" required id="skill-category" aria-required="true">
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
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

          <div class="form-actions">
            <Button type="button" variant="secondary" @click="closeAddModal">
              {{ i18n?.cancel || '取消' }}
            </Button>
            <Button type="submit" variant="primary">
              {{ i18n?.save || '保存' }}
            </Button>
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
        <Button variant="secondary" icon="close" icon-position="right" @click="closeCategoryManage">
          {{ i18n?.close || '关闭' }}
        </Button>

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
              aria-label="分类名称"
            />
            <input
              v-model="categoryForm.color"
              type="color"
              class="input-color"
              aria-label="分类颜色"
            />
            <Button variant="success" icon="add" @click="addCategory">
              {{ i18n?.add || '添加' }}
            </Button>
          </div>
        </div>

        <!-- 分类列表 -->
        <div class="category-list" role="list">
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="category-item"
            role="listitem"
          >
            <span class="category-dot" :style="{ backgroundColor: cat.color }"></span>
            <span class="category-name">{{ cat.name }}</span>
            <Button variant="danger" icon="delete" size="small" @click="deleteCategory(cat.id)">
              {{ i18n?.delete || '删除' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeMount, onUnmounted } from 'vue'
import type { Skill, SkillCategory } from './types'
import Button from '@/components/Button.vue'
import IconWrapper from '@/components/IconWrapper.vue'

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Set brand color to b3-theme-primary before component mounts
onBeforeMount(() => {
  // Apply brand orange to theme primary for both light and dark mode
  document.documentElement.style.setProperty('--b3-theme-primary', '#d97757')
  document.documentElement.style.setProperty('--b3-theme-primary-rgb', '217, 119, 87')
})

// Clean up brand color when component unmounts
onUnmounted(() => {
  document.documentElement.style.removeProperty('--b3-theme-primary')
  document.documentElement.style.removeProperty('--b3-theme-primary-rgb')
})

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
  color: '#d97757' // Default to brand orange
})

const skills = ref<Skill[]>([])
const categories = ref<SkillCategory[]>([
  { id: 'default', name: '默认', color: '#d97757' } // Brand orange
])

// Computed property for all categories including "全部"
const allCategories = computed(() => {
  return [
    { id: 'all', name: '全部', color: '#d97757' }, // Brand orange
    ...categories.value
  ]
})

// Load skills from Siyuan API
onMounted(async () => {
  await loadSkills()
  await loadCategories()

  // Set default category if none is set
  if (categories.value.length > 0 && !skillForm.value.category) {
    skillForm.value.category = categories.value[0].id
  }
})

// Watch for changes in categories to update form defaults
watch(categories, (newCategories) => {
  if (newCategories.length > 0 && !skillForm.value.category) {
    skillForm.value.category = newCategories[0].id
  }
})

const filteredSkills = computed(() => {
  let result = [...skills.value]

  // 按分类筛选
  if (selectedCategory.value !== 'all') {
    result = result.filter(skill => skill.category === selectedCategory.value)
  }

  // 按搜索词筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase().trim()
    if (query) {
      result = result.filter(skill =>
        skill.title.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.content.toLowerCase().includes(query)
      )
    }
  }

  return result
})

// 获取分类对象
const getCategoryById = (id: string): SkillCategory => {
  return categories.value.find(c => c.id === id) || categories.value[0]
}

// Category selection handler
const selectCategory = (categoryId: string) => {
  selectedCategory.value = categoryId
}

async function loadSkills() {
  if (!props.plugin) return
  try {
    const stored = await props.plugin.loadData('siyuan-skills')
    if (stored && Array.isArray(stored)) {
      skills.value = stored as Skill[]
    } else {
      skills.value = []
    }
  } catch (error) {
    console.error('Failed to load skills:', error)
    skills.value = []
  }
}

async function loadCategories() {
  if (!props.plugin) return
  try {
    const stored = await props.plugin.loadData('siyuan-categories')
    if (stored && Array.isArray(stored)) {
      categories.value = stored as SkillCategory[]
      // Ensure all categories have a color
      categories.value = categories.value.map(cat => ({
        ...cat,
        color: cat.color || '#d97757' // Brand orange as default
      }))
    } else {
      categories.value = [{ id: 'default', name: '默认', color: '#d97757' }]
    }
  } catch (error) {
    console.error('Failed to load categories:', error)
    categories.value = [{ id: 'default', name: '默认', color: '#d97757' }]
  }
}

async function saveCategories() {
  if (!props.plugin) return
  try {
    await props.plugin.saveData('siyuan-categories', categories.value)
  } catch (error) {
    console.error('Failed to save categories:', error)
    throw error
  }
}

async function saveSkills() {
  if (!props.plugin) return
  try {
    await props.plugin.saveData('siyuan-skills', skills.value)
  } catch (error) {
    console.error('Failed to save skills:', error)
    throw error
  }
}

function openAddModal() {
  editingSkill.value = null
  skillForm.value = {
    title: '',
    description: '',
    content: '',
    category: categories.value[0]?.id || 'default'
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

async function saveSkill() {
  try {
    // Validate required fields
    if (!skillForm.value.title.trim() || !skillForm.value.content.trim()) {
      alert('标题和内容是必填项')
      return
    }

    if (editingSkill.value) {
      // Update existing skill
      const index = skills.value.findIndex(s => s.id === editingSkill.value!.id)
      if (index !== -1) {
        skills.value[index] = {
          ...editingSkill.value,
          title: skillForm.value.title.trim(),
          description: skillForm.value.description.trim(),
          content: skillForm.value.content.trim(),
          category: skillForm.value.category
        }
      }
    } else {
      // Add new skill
      const newSkill: Skill = {
        id: Date.now().toString(),
        title: skillForm.value.title.trim(),
        description: skillForm.value.description.trim(),
        content: skillForm.value.content.trim(),
        category: skillForm.value.category
      }
      skills.value.push(newSkill)
    }

    await saveSkills()
    closeAddModal()
  } catch (error) {
    console.error('Failed to save skill:', error)
    alert('保存失败，请重试')
  }
}

// 分类管理相关函数
function openCategoryManage() {
  categoryForm.value = {
    name: '',
    color: '#d97757' // Brand orange
  }
  showCategoryManage.value = true
}

function closeCategoryManage() {
  showCategoryManage.value = false
}

async function addCategory() {
  if (!categoryForm.value.name.trim()) {
    alert('分类名称不能为空')
    return
  }

  const newCategory: SkillCategory = {
    id: Date.now().toString(),
    name: categoryForm.value.name.trim(),
    color: categoryForm.value.color
  }

  categories.value.push(newCategory)
  await saveCategories()

  categoryForm.value = {
    name: '',
    color: '#d97757'
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

async function copyContent(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    // Could add a toast notification here in the future
  } catch (err) {
    console.error('Failed to copy content:', err)
    alert('复制失败，请手动复制')
  }
}

function closeModal() {
  showModal.value = false
  emit('close')
}
</script>
<style lang="scss" scoped>
@use './Skills.scss';
</style>
