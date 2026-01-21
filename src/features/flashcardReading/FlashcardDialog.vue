<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="flashcard-dialog-overlay" @click.self="close">
        <div class="flashcard-dialog">
          <!-- 关闭按钮 -->
          <Button
            icon="pi pi-times"
            severity="secondary"
            variant="text"
            rounded
            class="close-btn"
            @click="close"
          />

          <!-- 空状态 -->
          <div v-if="filteredCards.length === 0" class="empty-state">
            <svg viewBox="0 0 24 24" width="64" height="64">
              <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            <p>{{ i18n.noCards || '暂无卡片' }}</p>
          </div>

          <!-- 单卡视图 -->
          <template v-else>
            <div class="flashcard-large">
              <div class="card-title-large">{{ currentCard?.title }}</div>
              <div class="card-content-large">{{ currentCard?.content }}</div>
              <div class="card-meta-large">
                <span class="card-category-large">{{ currentCard?.category }}</span>
                <span class="practice-count">{{ i18n.practiceCount || '练习次数' }}: {{ currentCard?.practiceCount || 0 }}</span>
              </div>
              <!-- 播放按钮 -->
              <Button
                :label="i18n.play || '播放'"
                icon="pi pi-play"
                iconPos="left"
                size="large"
                rounded
                raised
                class="play-btn-large"
                @click="playWord(currentCard)"
              />
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

            <!-- 导航 -->
            <div class="card-navigation">
              <Button
                icon="pi pi-chevron-left"
                severity="secondary"
                rounded
                outlined
                @click="previousCard"
                :disabled="currentIndex === 0"
              />
              <Button
                icon="pi pi-sort-alt"
                severity="secondary"
                rounded
                outlined
                @click="randomCard"
              />
              <span class="card-counter">
                {{ currentIndex + 1 }} / {{ filteredCards.length }}
              </span>
              <Button
                icon="pi pi-chevron-right"
                severity="secondary"
                rounded
                outlined
                @click="nextCard"
                :disabled="currentIndex === filteredCards.length - 1"
              />
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { showMessage } from 'siyuan'
import Button from 'primevue/button'
import type { Plugin } from 'siyuan'
import { FlashcardStorage } from './storage'
import type { Flashcard } from './types'

interface Props {
  i18n: any
  plugin: Plugin
}

const props = defineProps<Props>()

const visible = ref(false)
const storage = new FlashcardStorage(props.plugin)
const cards = ref<Flashcard[]>([])
const categories = ref<string[]>([])
const selectedCategory = ref<string>('all')
const currentIndex = ref(0)

const filteredCards = computed(() => {
  if (selectedCategory.value === 'all') {
    return cards.value
  }
  return cards.value.filter(card => card.category === selectedCategory.value)
})

const currentCard = computed(() => filteredCards.value[currentIndex.value])

const loadCards = async () => {
  try {
    cards.value = await storage.getAllCards()
    categories.value = await storage.getCategories()
    currentIndex.value = 0
  } catch (error) {
    console.error('Failed to load cards:', error)
  }
}

const handleCategoryChange = () => {
  currentIndex.value = 0
}

const playWord = async (card: Flashcard) => {
  try {
    const utterance = new SpeechSynthesisUtterance(card.title)
    utterance.lang = 'en-US'
    utterance.rate = 0.8

    utterance.onend = async () => {
      await storage.incrementPracticeCount(card.id)
      const index = cards.value.findIndex(c => c.id === card.id)
      if (index !== -1) {
        cards.value[index].practiceCount = (cards.value[index].practiceCount || 0) + 1
      }
    }

    speechSynthesis.speak(utterance)
  } catch (error) {
    showMessage(props.i18n.playFailed || '播放失败', 2000, 'error')
  }
}

const previousCard = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    playAuto()
  }
}

const nextCard = () => {
  if (currentIndex.value < filteredCards.value.length - 1) {
    currentIndex.value++
    playAuto()
  }
}

const randomCard = () => {
  if (filteredCards.value.length <= 1) return
  let newIndex: number
  do {
    newIndex = Math.floor(Math.random() * filteredCards.value.length)
  } while (newIndex === currentIndex.value && filteredCards.value.length > 1)
  currentIndex.value = newIndex
  playAuto()
}

const playAuto = () => {
  const card = currentCard.value
  if (card) {
    playWord(card)
  }
}

const open = () => {
  visible.value = true
  loadCards()
}

const close = () => {
  visible.value = false
}

// 暴露方法和属性供外部调用
defineExpose({
  open,
  close,
  visible
})

// 监听数据变化事件
onMounted(() => {
  const handleDataChanged = () => {
    loadCards()
  }
  window.addEventListener('flashcardDataChanged', handleDataChanged)
  ;(window as any).__flashcardDialogDataChangedHandler = handleDataChanged
})
</script>

<style scoped lang="scss">
.flashcard-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.flashcard-dialog {
  position: relative;
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  background: var(--b3-theme-background);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;

  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
  color: var(--b3-theme-on-surface);

  svg {
    opacity: 0.3;
  }

  p {
    font-size: 14px;
    opacity: 0.7;
  }
}

.flashcard-large {
  background: linear-gradient(135deg, var(--b3-theme-primary) 0%, var(--b3-theme-primary-light) 100%);
  border-radius: 16px;
  padding: 28px 20px;
  color: var(--b3-theme-on-primary);
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 400px;
  justify-content: center;
  align-items: center;
  text-align: center;
  overflow: hidden;
}

.card-title-large {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  flex-shrink: 0;
}

.card-content-large {
  font-size: 15px;
  line-height: 1.6;
  opacity: 0.9;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  max-width: 100%;

  // 自定义滚动条样式
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;

    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  }
}

.card-meta-large {
  display: flex;
  gap: 16px;
  font-size: 14px;
  opacity: 0.8;
  flex-shrink: 0;
}

.card-category-large {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
}

.category-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--b3-list-hover);
  border-radius: 12px;

  label {
    font-size: 14px;
    color: var(--b3-theme-on-background);
    white-space: nowrap;
  }

  select {
    flex: 1;
    padding: 8px 12px;
    border: none;
    background: var(--b3-theme-background);
    border-radius: 8px;
    font-size: 14px;
    color: var(--b3-theme-on-background);
    cursor: pointer;
  }
}

.card-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.card-counter {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  min-width: 60px;
  text-align: center;
}

// 对话框动画
.dialog-enter-active,
.dialog-leave-active {
  transition: all 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;

  .flashcard-dialog {
    transform: scale(0.9) translateY(20px);
  }
}

.dialog-enter-to,
.dialog-leave-from {
  opacity: 1;

  .flashcard-dialog {
    transform: scale(1) translateY(0);
  }
}
</style>
