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
        <button class="close-btn" @click="closeModal" :title="i18n?.close || '关闭'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="skills-modal-body">
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Skill } from './types'

defineProps<{
  i18n?: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
}>()

const showModal = ref(true)
const showAddModal = ref(false)
const editingSkill = ref<Skill | null>(null)
const searchQuery = ref('')

const skillForm = ref({
  title: '',
  description: '',
  content: ''
})

const skills = ref<Skill[]>([])

// Load skills from Siyuan API
onMounted(async () => {
  await loadSkills()
})

const filteredSkills = computed(() => {
  if (!searchQuery.value) {
    return skills.value
  }
  const query = searchQuery.value.toLowerCase()
  return skills.value.filter(skill =>
    skill.title.toLowerCase().includes(query) ||
    skill.description.toLowerCase().includes(query) ||
    skill.content.toLowerCase().includes(query)
  )
})

async function loadSkills() {
  try {
    const stored = localStorage.getItem('siyuan-skills')
    if (stored) {
      skills.value = JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load skills:', error)
  }
}

async function saveSkills() {
  try {
    localStorage.setItem('siyuan-skills', JSON.stringify(skills.value))
  } catch (error) {
    console.error('Failed to save skills:', error)
  }
}

function openAddModal() {
  editingSkill.value = null
  skillForm.value = {
    title: '',
    description: '',
    content: ''
  }
  showAddModal.value = true
}

function editSkill(skill: Skill) {
  editingSkill.value = skill
  skillForm.value = {
    title: skill.title,
    description: skill.description,
    content: skill.content
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
          content: skillForm.value.content
        }
      }
    } else {
      // Add new skill
      const newSkill: Skill = {
        id: Date.now().toString(),
        title: skillForm.value.title,
        description: skillForm.value.description,
        content: skillForm.value.content
      }
      skills.value.push(newSkill)
    }

    await saveSkills()
    closeAddModal()
  } catch (error) {
    console.error('Failed to save skill:', error)
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
