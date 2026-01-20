<template>
  <div class="flashcard-reading-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <IconWrapper name="flashcardReading" :size="20" />
        <span>{{ i18n.panelTitle || '单词阅读' }}</span>
      </h3>
      <div class="header-actions">
        <button class="action-btn help-btn" @click="showHelpDialog = true" :title="i18n.usageGuide || '使用说明'">
          <svg class="help-icon" viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
          </svg>
        </button>
        <button class="action-btn" @click="showCreateDialog = true" :title="i18n.addCard || '添加卡片'">
          <IconWrapper name="add" :size="16" />
        </button>
        <button class="action-btn" @click="loadCards" :title="i18n.refresh || '刷新'">
          <IconWrapper name="refresh" :size="16" />
        </button>
      </div>
    </div>

    <!-- 类别筛选和搜索 -->
    <div class="category-filter">
      <div class="filter-left">
        <label>{{ i18n.category || '类别' }}:</label>
        <select v-model="selectedCategory" @change="handleCategoryChange">
          <option value="all">{{ i18n.allCategories || '全部' }}</option>
          <option v-for="cat in categories" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>
      </div>
      <div class="filter-right">
        <div class="search-box">
          <IconWrapper name="search" :size="14" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="i18n.searchPlaceholder || '搜索标题或内容...'"
          />
          <button
            v-if="searchQuery"
            class="clear-btn"
            @click="searchQuery = ''"
            :title="i18n.clearSearch || '清除'"
          >
            <IconWrapper name="close" :size="12" />
          </button>
        </div>
        <div class="statistics">
          <span class="stat-item">{{ i18n.total || '总计' }}: {{ cards.length }}</span>
          <template v-if="selectedCategory !== 'all' || searchQuery">
            <span class="stat-divider">|</span>
            <span class="stat-item">
              {{ selectedCategory !== 'all' ? selectedCategory : (i18n.filtered || '筛选') }}:
              {{ filteredCards.length }}
            </span>
          </template>
        </div>
      </div>
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
              <button class="icon-btn play-btn" @click="playWord(card)" :title="i18n.play || '播放'">
                <svg class="icon-icon" viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M8 5v14l11-7z"/>
                </svg>
              </button>
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
      <div class="single-card-view" v-else-if="viewMode === 'single'">
        <div class="flashcard-large">
          <div class="card-title-large">{{ currentCard?.title }}</div>
          <div class="card-content-large">{{ currentCard?.content }}</div>
          <div class="card-meta-large">
            <span class="card-category-large">{{ currentCard?.category }}</span>
            <span class="practice-count">{{ i18n.practiceCount || '练习次数' }}: {{ currentCard?.practiceCount || 0 }}</span>
          </div>
          <!-- 播放按钮 -->
          <button class="play-btn-large" @click="playWord(currentCard)" :title="i18n.play || '播放'">
            <svg class="play-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M8 5v14l11-7z"/>
            </svg>
            {{ i18n.play || '播放' }}
          </button>
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
          <button
            class="nav-btn random-btn"
            @click.stop="randomCard"
            :title="i18n.randomCard || '随机'"
          >
            <svg class="icon-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
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

      <!-- 统计模式 -->
      <div class="statistics-view" v-else-if="viewMode === 'statistics'">
        <!-- 总体统计 -->
        <div class="stats-overview">
          <div class="stat-card">
            <div class="stat-value">{{ statisticsData.totalPractice }}</div>
            <div class="stat-label">{{ i18n.totalPractice || '总练习次数' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ statisticsData.practicedCards }}</div>
            <div class="stat-label">{{ i18n.practicedCards || '已练习卡片' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ statisticsData.totalCards }}</div>
            <div class="stat-label">{{ i18n.totalCards || '总卡片数' }}</div>
          </div>
        </div>

        <!-- 类别统计柱状图 -->
        <div class="chart-section" v-if="statisticsData.categoryStats.length > 0">
          <h4 class="chart-title">{{ i18n.categoryStats || '类别统计' }}</h4>
          <div class="bar-chart">
            <div
              v-for="(item, index) in statisticsData.categoryStats"
              :key="item.category"
              class="bar-item"
            >
              <div class="bar-label">{{ item.category }}</div>
              <div class="bar-container">
                <div
                  class="bar-fill"
                  :style="{
                    width: (item.count / statisticsData.categoryStats[0].count * 100) + '%',
                    backgroundColor: getBarColor(index)
                  }"
                >
                  <span class="bar-value">{{ item.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 卡片统计排行榜 -->
        <div class="chart-section" v-if="statisticsData.cardStats.length > 0">
          <h4 class="chart-title">{{ i18n.topCards || '练习排行榜' }}</h4>
          <div class="rank-list">
            <div
              v-for="(item, index) in statisticsData.cardStats"
              :key="item.title"
              class="rank-item"
            >
              <div class="rank-number" :class="{ 'top-three': index < 3 }">{{ index + 1 }}</div>
              <div class="rank-info">
                <div class="rank-title">{{ item.title }}</div>
                <div class="rank-category">{{ item.category }}</div>
              </div>
              <div class="rank-count">{{ item.count }}</div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div class="empty-stats" v-else>
          <IconWrapper name="file" :size="48" />
          <p>{{ i18n.noPracticeData || '暂无练习数据' }}</p>
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
      <button
        class="mode-btn"
        :class="{ active: viewMode === 'statistics' }"
        @click="viewMode = 'statistics'"
      >
        {{ i18n.statisticsView || '统计' }}
      </button>
    </div>

    <!-- 使用说明对话框 -->
    <div class="dialog-overlay" v-if="showHelpDialog" @click.self="showHelpDialog = false">
      <div class="dialog help-dialog" @click.stop>
        <div class="dialog-header">
          <h4>{{ i18n.usageGuide || '使用说明' }}</h4>
          <button class="close-btn" @click="showHelpDialog = false">
            <IconWrapper name="close" :size="16" />
          </button>
        </div>
        <div class="dialog-body help-body">
          <div class="help-section">
            <h5>{{ i18n.helpOverview || '功能概述' }}</h5>
            <p>{{ i18n.helpOverviewDesc || '闪卡式单词阅读工具，支持分类管理、发音播放和练习统计。' }}</p>
          </div>
          <div class="help-section">
            <h5>{{ i18n.helpCardManagement || '卡片管理' }}</h5>
            <ul>
              <li>{{ i18n.helpAddCard || '添加卡片：点击右上角 + 按钮，输入标题、内容和类别' }}</li>
              <li>{{ i18n.helpEditCard || '编辑卡片：点击卡片上的编辑按钮' }}</li>
              <li>{{ i18n.helpDeleteCard || '删除卡片：点击卡片上的删除按钮' }}</li>
              <li>{{ i18n.helpCardCategory || '类别管理：支持预设类别和自定义类别' }}</li>
            </ul>
          </div>
          <div class="help-section">
            <h5>{{ i18n.helpViewModes || '视图模式' }}</h5>
            <ul>
              <li>{{ i18n.helpListView || '列表视图：双列网格显示所有卡片，支持分页' }}</li>
              <li>{{ i18n.helpSingleView || '单卡视图：大卡片显示，支持上下翻页和随机切换' }}</li>
              <li>{{ i18n.helpStatisticsView || '统计视图：展示练习数据和排行榜' }}</li>
            </ul>
          </div>
          <div class="help-section">
            <h5>{{ i18n.helpPractice || '练习功能' }}</h5>
            <ul>
              <li>{{ i18n.helpPronunciation || '发音播放：点击播放按钮使用 Web Speech API 播放发音' }}</li>
              <li>{{ i18n.helpAutoPlay || '自动播放：单卡模式下切换卡片时自动播放发音' }}</li>
              <li>{{ i18n.helpPracticeCount || '练习统计：每次播放后自动记录练习次数' }}</li>
            </ul>
          </div>
          <div class="help-section">
            <h5>{{ i18n.helpSearch || '搜索和筛选' }}</h5>
            <ul>
              <li>{{ i18n.helpCategoryFilter || '类别筛选：下拉选择特定类别查看' }}</li>
              <li>{{ i18n.helpSearchKeyword || '关键词搜索：搜索标题和内容' }}</li>
            </ul>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-primary" @click="showHelpDialog = false">
            {{ i18n.close || '关闭' }}
          </button>
        </div>
      </div>
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
              @input="handleTitleInput"
              @blur="validateTitle"
            />
            <span class="error-msg" v-if="formErrors.title">{{ formErrors.title }}</span>
          </div>
          <div class="form-group">
            <label>{{ i18n.content || '内容' }}</label>
            <textarea
              v-model="formData.content"
              rows="6"
              :placeholder="i18n.contentPlaceholder || '内容'"
            ></textarea>
          </div>
          <div class="form-group">
            <label>{{ i18n.category || '类别' }}</label>
            <div class="category-input-group">
              <select v-model="formData.category" @change="handleCategorySelect">
                <option value="">{{ i18n.selectCategory || '请选择类别' }}</option>
                <option value="__custom__">{{ i18n.customCategory || '自定义...' }}</option>
                <option v-for="cat in allCategories" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
              <input
                v-if="formData.category === '__custom__'"
                v-model="customCategory"
                type="text"
                :placeholder="i18n.customCategoryPlaceholder || '输入自定义类别'"
                class="custom-category-input"
                @input="updateCustomCategory"
              />
            </div>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
const searchQuery = ref<string>('')
const viewMode = ref<'list' | 'single' | 'statistics'>('list')
const currentPage = ref(1)
const pageSize = 10
const currentIndex = ref(0)

// 对话框状态
const showCreateDialog = ref(false)
const showHelpDialog = ref(false)
const editingCard = ref<Flashcard | null>(null)
const formData = ref<CreateFlashcardDTO>({
  title: '',
  content: '',
  category: ''
})
const formErrors = ref<Record<string, string>>({})
const customCategory = ref('')

// 预设类别
const presetCategories = ['C#', '编程单词', 'JavaScript', 'TypeScript', 'Vue', 'Rust']

// 计算属性
const allCategories = computed(() => {
  const uniqueCategories = new Set([...presetCategories, ...categories.value])
  return Array.from(uniqueCategories).sort()
})

const filteredCards = computed(() => {
  let result = cards.value

  // 先按类别筛选
  if (selectedCategory.value !== 'all') {
    result = result.filter(card => card.category === selectedCategory.value)
  }

  // 再按搜索关键词筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(card =>
      card.title.toLowerCase().includes(query) ||
      card.content.toLowerCase().includes(query)
    )
  }

  return result
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
         formData.value.category.trim() !== '' &&
         Object.keys(formErrors.value).length === 0
})

// 统计相关计算属性
const statisticsData = computed(() => {
  // 按类别统计
  const categoryStats = new Map<string, number>()
  // 按卡片统计
  const cardStats: Array<{ title: string; category: string; count: number }> = []

  cards.value.forEach(card => {
    // 类别统计
    const count = card.practiceCount || 0
    categoryStats.set(card.category, (categoryStats.get(card.category) || 0) + count)

    // 卡片统计
    if (count > 0) {
      cardStats.push({
        title: card.title,
        category: card.category,
        count
      })
    }
  })

  // 按练习次数排序
  cardStats.sort((a, b) => b.count - a.count)

  // 转换类别统计为数组并排序
  const categoryArray = Array.from(categoryStats.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  // 总练习次数
  const totalPractice = cards.value.reduce((sum, card) => sum + (card.practiceCount || 0), 0)

  // 已练习卡片数
  const practicedCards = cards.value.filter(card => (card.practiceCount || 0) > 0).length

  return {
    totalPractice,
    practicedCards,
    totalCards: cards.value.length,
    categoryStats: categoryArray,
    cardStats: cardStats.slice(0, 20) // 只显示前20张
  }
})

// 方法
const loadCards = async () => {
  try {
    cards.value = await storage.getAllCards()
    categories.value = await storage.getCategories()
  } catch (error) {
    console.error('Failed to load cards:', error)
    showMessage(props.i18n.loadFailed || '加载卡片失败', 3000, 'error')
  }
}

const handleCategoryChange = () => {
  currentPage.value = 1
  currentIndex.value = 0
  // 切换类别时保留搜索状态
}

const switchToSingleMode = () => {
  viewMode.value = 'single'
  currentIndex.value = 0
}

/**
 * 自动播放当前卡片
 */
const playCurrentCard = () => {
  const card = currentCard.value
  if (card) {
    playWord(card)
  }
}

const previousCard = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    playCurrentCard()
  }
}

const nextCard = () => {
  if (currentIndex.value < filteredCards.value.length - 1) {
    currentIndex.value++
    playCurrentCard()
  }
}

/**
 * 随机选择一张卡片并自动播放
 * 使用 Fisher-Yates 洗牌算法思想，从当前筛选的卡片中随机选择
 */
const randomCard = () => {
  if (filteredCards.value.length <= 1) {
    return
  }
  // 生成不同于当前索引的随机索引
  let newIndex: number
  do {
    newIndex = Math.floor(Math.random() * filteredCards.value.length)
  } while (newIndex === currentIndex.value && filteredCards.value.length > 1)
  currentIndex.value = newIndex
  playCurrentCard()
}

/**
 * 获取柱状图颜色
 */
const getBarColor = (index: number): string => {
  const colors = [
    'var(--b3-theme-primary)',
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ]
  return colors[index % colors.length]
}

const handleTitleInput = () => {
  // 当标题变化时，清除之前的错误信息
  if (formErrors.value.title) {
    delete formErrors.value.title
  }
}

const validateTitle = async () => {
  if (!formData.value.title.trim()) {
    formErrors.value.title = props.i18n.titleEmpty || '标题不能为空'
    return
  }

  // 如果是编辑模式且标题未变化，跳过唯一性检查
  if (editingCard.value && formData.value.title === editingCard.value.title) {
    delete formErrors.value.title
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
      showMessage(props.i18n.updateSuccess || '卡片已更新', 2000, 'info')
    } else {
      await storage.createCard(formData.value)
      showMessage(props.i18n.createSuccess || '卡片已创建', 2000, 'info')
    }

    closeDialog()
    await loadCards()
  } catch (error: any) {
    showMessage(error.message || props.i18n.saveFailed || '保存失败', 3000, 'error')
  }
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingCard.value = null
  formData.value = { title: '', content: '', category: '' }
  formErrors.value = {}
  customCategory.value = ''
}

// 处理类别选择
const handleCategorySelect = () => {
  if (formData.value.category === '__custom__') {
    customCategory.value = ''
    formData.value.category = ''
  }
}

// 更新自定义类别
const updateCustomCategory = () => {
  formData.value.category = customCategory.value.trim()
}

const editCard = (card: Flashcard) => {
  editingCard.value = card
  const category = card.category
  // 检查是否为自定义类别（不在预设类别中）
  const isCustomCategory = !presetCategories.includes(category)
  formData.value = {
    title: card.title,
    content: card.content,
    category: isCustomCategory ? '__custom__' : category
  }
  customCategory.value = isCustomCategory ? category : ''
  showCreateDialog.value = true
}

const deleteCard = async (card: Flashcard) => {
  if (!confirm(props.i18n.confirmDelete || '确定要删除这张卡片吗？')) {
    return
  }

  try {
    await storage.deleteCard(card.id)
    showMessage(props.i18n.deleteSuccess || '卡片已删除', 2000, 'info')
    await loadCards()
  } catch (error: any) {
    showMessage(error.message || props.i18n.deleteFailed || '删除失败', 3000, 'error')
  }
}

/**
 * 播放单词发音（使用 Web Speech API）
 * 参考 wordQuery 功能的实现方式
 * 单卡模式下传入卡片对象，播放完成后自动增加练习次数
 */
const playWord = async (wordOrCard: string | Flashcard) => {
  const word = typeof wordOrCard === 'string' ? wordOrCard : wordOrCard.title
  const card = typeof wordOrCard === 'string' ? null : wordOrCard

  try {
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US' // 默认美式发音
    utterance.rate = 0.8 // 语速稍慢，便于听清

    // 单卡模式下，播放结束后增加练习次数
    if (card) {
      utterance.onend = async () => {
        await storage.incrementPracticeCount(card.id)
        // 更新本地数据
        const index = cards.value.findIndex(c => c.id === card.id)
        if (index !== -1) {
          cards.value[index].practiceCount = (cards.value[index].practiceCount || 0) + 1
        }
      }
    }

    speechSynthesis.speak(utterance)
  } catch (error) {
    console.error('Failed to play pronunciation:', error)
    showMessage(props.i18n.playFailed || '播放失败', 2000, 'error')
  }
}

// 生命周期
onMounted(() => {
  loadCards()

  // 监听数据变化事件（由 PronunciationDialog 触发）
  const handleDataChanged = () => {
    loadCards()
  }
  window.addEventListener('flashcardDataChanged', handleDataChanged)

  // 保存引用以便在 onUnmounted 中移除
  ;(window as any).__flashcardDataChangedHandler = handleDataChanged
})

onUnmounted(() => {
  // 移除事件监听器
  const handler = (window as any).__flashcardDataChangedHandler
  if (handler) {
    window.removeEventListener('flashcardDataChanged', handler)
    delete (window as any).__flashcardDataChangedHandler
  }
})

// 监听搜索变化，重置分页和索引
watch(searchQuery, () => {
  currentPage.value = 1
  currentIndex.value = 0
})
</script>

<style scoped lang="scss">
@use './index.scss';
</style>
