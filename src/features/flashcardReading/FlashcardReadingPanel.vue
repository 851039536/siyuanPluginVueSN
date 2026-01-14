<template>
  <div class="flashcard-reading-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <IconWrapper name="flashcardReading" :size="20" />
        <span>{{ i18n.title || '单词阅读' }}</span>
      </h3>
      <div class="header-actions">
        <button class="action-btn" @click="showCreateDialog = true" :title="i18n.addCard || '添加卡片'">
          <IconWrapper name="add" :size="16" />
        </button>
        <button class="action-btn" @click="loadCards" :title="i18n.refresh || '刷新'">
          <IconWrapper name="refresh" :size="16" />
        </button>
      </div>
    </div>

    <!-- 类别筛选 -->
    <div class="category-filter">
      <label>{{ i18n.category || '类别' }}:</label>
      <select v-model="selectedCategory" @change="handleCategoryChange">
        <option value="all">{{ i18n.allCategories || '全部' }}</option>
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
    </div>

    <!-- 卡片容器 -->
    <div class="card-container" v-if="cards.length > 0">
      <!-- 列表模式 -->
      <div class="card-list" v-if="viewMode === 'list'">
        <div
          v-for="card in paginatedCards"
          :key="card.id"
          class="card-item"
        >
          <div class="card-header">
            <div class="card-title">{{ card.title }}</div>
            <div class="card-actions">
              <button class="icon-btn" @click="editCard(card)" :title="i18n.editCard || '编辑'">
                <IconWrapper name="edit" :size="14" />
              </button>
              <button class="icon-btn danger" @click="deleteCard(card)" :title="i18n.deleteCard || '删除'">
                <IconWrapper name="delete" :size="14" />
              </button>
            </div>
          </div>
          <div class="card-content">{{ card.content }}</div>
          <div class="card-category">{{ card.category }}</div>
        </div>
      </div>

      <!-- 单卡模式 -->
      <div class="single-card-view" v-else>
        <div class="flashcard-large">
          <div class="card-title-large">{{ currentCard?.title }}</div>
          <div class="card-content-large">{{ currentCard?.content }}</div>
          <div class="card-category-large">{{ currentCard?.category }}</div>
        </div>

        <!-- 导航 -->
        <div class="card-navigation">
          <button
            class="nav-btn"
            @click.stop="previousCard"
            :disabled="currentIndex === 0"
          >
            <IconWrapper name="back" :size="20" />
          </button>
          <span class="card-counter">
            {{ currentIndex + 1 }} / {{ filteredCards.length }}
          </span>
          <button
            class="nav-btn"
            @click.stop="nextCard"
            :disabled="currentIndex === filteredCards.length - 1"
          >
            <IconWrapper name="forward" :size="20" />
          </button>
        </div>
      </div>

      <!-- 分页控制 -->
      <div class="pagination" v-if="viewMode === 'list' && totalPages > 1">
        <button
          class="page-btn"
          @click="currentPage--"
          :disabled="currentPage === 1"
        >
          {{ i18n.previous || '上一页' }}
        </button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button
          class="page-btn"
          @click="currentPage++"
          :disabled="currentPage === totalPages"
        >
          {{ i18n.next || '下一页' }}
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <IconWrapper name="file" :size="48" />
      <p>{{ i18n.noCards || '暂无卡片' }}</p>
      <button class="btn-primary" @click="showCreateDialog = true">
        {{ i18n.addCard || '添加卡片' }}
      </button>
    </div>

    <!-- 视图模式切换 -->
    <div class="view-mode-toggle" v-if="cards.length > 0">
      <button
        class="mode-btn"
        :class="{ active: viewMode === 'list' }"
        @click="viewMode = 'list'"
      >
        {{ i18n.listView || '列表' }}
      </button>
      <button
        class="mode-btn"
        :class="{ active: viewMode === 'single' }"
        @click="switchToSingleMode"
      >
        {{ i18n.singleView || '单卡' }}
      </button>
    </div>

    <!-- 创建/编辑对话框 -->
    <div class="dialog-overlay" v-if="showCreateDialog" @click.self="closeDialog">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h4>{{ editingCard ? (i18n.editCard || '编辑卡片') : (i18n.addCard || '添加卡片') }}</h4>
          <button class="close-btn" @click="closeDialog">
            <IconWrapper name="close" :size="16" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>{{ i18n.title || '标题' }}</label>
            <input
              v-model="formData.title"
              type="text"
              :placeholder="i18n.titlePlaceholder || '标题（不可重复）'"
              @blur="validateTitle"
            />
            <span class="error-msg" v-if="formErrors.title">{{ formErrors.title }}</span>
          </div>
          <div class="form-group">
            <label>{{ i18n.content || '内容' }}</label>
            <textarea
              v-model="formData.content"
              rows="4"
              :placeholder="i18n.contentPlaceholder || '内容'"
            ></textarea>
          </div>
          <div class="form-group">
            <label>{{ i18n.category || '类别' }}</label>
            <input
              v-model="formData.category"
              type="text"
              list="category-list"
              :placeholder="i18n.categoryPlaceholder || '类别'"
            />
            <datalist id="category-list">
              <option v-for="cat in categories" :key="cat" :value="cat" />
            </datalist>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="closeDialog">
            {{ i18n.cancel || '取消' }}
          </button>
          <button class="btn-primary" @click="saveCard" :disabled="!isFormValid">
            {{ i18n.save || '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showMessage } from 'siyuan'
import IconWrapper from '@/components/IconWrapper.vue'
import type { Plugin } from 'siyuan'
import { FlashcardStorage } from './storage'
import type { Flashcard, CreateFlashcardDTO } from './types'

interface Props {
  i18n: any
  plugin: Plugin
}

const props = defineProps<Props>()

// 状态
const storage = new FlashcardStorage(props.plugin)
const cards = ref<Flashcard[]>([])
const categories = ref<string[]>([])
const selectedCategory = ref<string>('all')
const viewMode = ref<'list' | 'single'>('list')
const currentPage = ref(1)
const pageSize = 10
const currentIndex = ref(0)

// 对话框状态
const showCreateDialog = ref(false)
const editingCard = ref<Flashcard | null>(null)
const formData = ref<CreateFlashcardDTO>({
  title: '',
  content: '',
  category: ''
})
const formErrors = ref<Record<string, string>>({})

// 计算属性
const filteredCards = computed(() => {
  if (selectedCategory.value === 'all') {
    return cards.value
  }
  return cards.value.filter(card => card.category === selectedCategory.value)
})

const currentCard = computed(() => filteredCards.value[currentIndex.value])

const totalPages = computed(() => Math.ceil(filteredCards.value.length / pageSize))

const paginatedCards = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredCards.value.slice(start, end)
})

const isFormValid = computed(() => {
  return formData.value.title.trim() !== '' &&
         formData.value.content.trim() !== '' &&
         Object.keys(formErrors.value).length === 0
})

// 方法
const loadCards = async () => {
  try {
    cards.value = await storage.getAllCards()
    categories.value = await storage.getCategories()
  } catch (error) {
    console.error('Failed to load cards:', error)
    showMessage('加载卡片失败', 3000, 'error')
  }
}

const handleCategoryChange = () => {
  currentPage.value = 1
  currentIndex.value = 0
}

const switchToSingleMode = () => {
  viewMode.value = 'single'
  currentIndex.value = 0
}

const previousCard = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const nextCard = () => {
  if (currentIndex.value < filteredCards.value.length - 1) {
    currentIndex.value++
  }
}

const validateTitle = async () => {
  if (!formData.value.title.trim()) {
    formErrors.value.title = '标题不能为空'
    return
  }

  const isUnique = await storage.isTitleUnique(
    formData.value.title,
    editingCard.value?.id
  )

  if (!isUnique) {
    formErrors.value.title = props.i18n.titleDuplicate || '标题已存在'
  } else {
    delete formErrors.value.title
  }
}

const saveCard = async () => {
  await validateTitle()

  if (!isFormValid.value) {
    return
  }

  try {
    if (editingCard.value) {
      await storage.updateCard(editingCard.value.id, formData.value)
      showMessage('卡片已更新', 2000, 'info')
    } else {
      await storage.createCard(formData.value)
      showMessage('卡片已创建', 2000, 'info')
    }

    closeDialog()
    await loadCards()
  } catch (error: any) {
    showMessage(error.message || '保存失败', 3000, 'error')
  }
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingCard.value = null
  formData.value = { title: '', content: '', category: '' }
  formErrors.value = {}
}

const editCard = (card: Flashcard) => {
  editingCard.value = card
  formData.value = {
    title: card.title,
    content: card.content,
    category: card.category
  }
  showCreateDialog.value = true
}

const deleteCard = async (card: Flashcard) => {
  if (!confirm(props.i18n.confirmDelete || '确定要删除这张卡片吗？')) {
    return
  }

  try {
    await storage.deleteCard(card.id)
    showMessage('卡片已删除', 2000, 'info')
    await loadCards()
  } catch (error: any) {
    showMessage(error.message || '删除失败', 3000, 'error')
  }
}

// 生命周期
onMounted(() => {
  loadCards()
})
</script>

<style scoped lang="scss">
@use './index.scss';
</style>
