<template>
  <div v-if="showModal" class="skills-modal-overlay" @click="handleOverlayClick">
    <div class="skills-modal" @click.stop>
      <div class="skills-modal-header">
        <h2>{{ i18n?.skillsTitle || '技能库' }}</h2>
        <button class="close-btn" @click="closeModal" :title="i18n?.close || '关闭'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="skills-modal-body">
        <div class="skills-controls">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="i18n?.search || '搜索技能...'"
            class="search-input"
          />
          <button class="add-btn" @click="openAddModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
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
              <h3>{{ skill.title }}</h3>
              <div class="skill-actions">
                <button @click="editSkill(skill)" :title="i18n?.edit || '编辑'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1zM18.5 8.5l1.5 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
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
              <div class="content-label">{{ i18n?.content || '内容' }}:</div>
              <div class="content-value" @click="copyContent(skill.content)">
                <pre>{{ skill.content }}</pre>
                <div class="copy-hint">{{ i18n?.clickToCopy || '点击复制' }}</div>
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

<style scoped lang="scss">
.skills-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.skills-modal {
  background: var(--b3-theme-background);
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--b3-border-color);

  &.small {
    max-width: 500px;
  }
}

.skills-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--b3-border-color);

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--b3-theme-on-background);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-list-hover);
    }
  }
}

.skills-modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.skills-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;

  .search-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-background);
    font-size: 14px;

    &:focus {
      outline: none;
      border-color: var(--b3-theme-primary);
    }
  }

  .add-btn {
    padding: 8px 16px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-primary-light);
    }

    svg {
      flex-shrink: 0;
    }
  }
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.skill-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--b3-theme-primary);
  }
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 8px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    flex: 1;
  }

  .skill-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;

    button {
      background: none;
      border: none;
      color: var(--b3-theme-on-surface);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: var(--b3-list-hover);
        color: var(--b3-theme-primary);
      }
    }
  }
}

.skill-description {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
  line-height: 1.5;
}

.skill-content {
  .content-label {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    margin-bottom: 6px;
    font-weight: 500;
  }

  .content-value {
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-surface-light);
    }

    pre {
      margin: 0;
      font-size: 12px;
      color: var(--b3-theme-on-background);
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      line-height: 1.5;
    }

    .copy-hint {
      font-size: 11px;
      color: var(--b3-theme-on-surface-light);
      margin-top: 6px;
      text-align: right;
    }
  }
}

.no-skills {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 20px;
  color: var(--b3-theme-on-surface-light);
  font-size: 14px;
}

.skill-form {
  .form-group {
    margin-bottom: 20px;

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: var(--b3-theme-on-background);
      margin-bottom: 8px;
    }

    input,
    textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--b3-border-color);
      border-radius: 6px;
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-background);
      font-size: 14px;
      font-family: inherit;

      &:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
      }
    }

    textarea {
      resize: vertical;
      min-height: 100px;
    }
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;

    button {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &.cancel-btn {
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);

        &:hover {
          background: var(--b3-list-hover);
        }
      }

      &.save-btn {
        background: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary);

        &:hover {
          background: var(--b3-theme-primary-light);
        }
      }
    }
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .skills-modal {
    width: 95%;
    max-height: 95vh;
  }

  .skills-modal-header {
    padding: 16px 20px;

    h2 {
      font-size: 16px;
    }
  }

  .skills-modal-body {
    padding: 16px 20px;
  }

  .skills-grid {
    grid-template-columns: 1fr;
  }

  .skills-controls {
    flex-direction: column;

    .add-btn {
      width: 100%;
      justify-content: center;
    }
  }
}
</style>
