<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="flashcard-dialog-overlay" @click.self="close">
        <div class="flashcard-dialog">
          <Button
            variant="ghost"
            size="small"
            icon="close"
            class="close-btn"
            @click="close"
          />

          <div v-if="filteredCards.length === 0" class="empty-state">
            <IconWrapper name="file" :size="64" />
            <p>{{ i18n.noCards || '暂无卡片' }}</p>
          </div>

          <template v-else>
            <div class="flashcard-large">
              <div class="card-title-large">{{ currentCard?.title }}</div>
              <div class="card-content-large">{{ currentCard?.content }}</div>
              <div class="card-meta-large">
                <span class="card-category-large">{{ currentCard?.category }}</span>
                <span class="practice-count">{{ i18n.practiceCount || '练习次数' }}: {{ currentCard?.practiceCount || 0 }}</span>
              </div>
              <Button
                variant="success"
                size="large"
                @click="playWord(currentCard)"
              >
                {{ i18n.play || '播放' }}
              </Button>
            </div>

            <div class="category-filter">
              <label>{{ i18n.category || '类别' }}:</label>
              <Select
                v-model="selectedCategory"
                :options="categoryOptions"
                @change="currentIndex = 0"
              />
            </div>

            <div class="card-navigation">
              <Button
                variant="ghost"
                icon="chevronLeft"
                :disabled="currentIndex === 0"
                @click="previousCard"
              />
              <Button
                variant="ghost"
                icon="shuffle"
                @click="randomCard"
              />
              <span class="card-counter">
                {{ currentIndex + 1 }} / {{ filteredCards.length }}
              </span>
              <Button
                variant="ghost"
                icon="chevronRight"
                :disabled="currentIndex === filteredCards.length - 1"
                @click="nextCard"
              />
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, shallowRef } from "vue";
import { showMessage } from "siyuan";

import IconWrapper from "@/components/IconWrapper.vue";
import Button from "@/components/Button.vue";
import Select from "@/components/Select.vue";
import type { SelectOption } from "@/components/Select.vue";
import type { Plugin } from "siyuan";

import { FlashcardStorage } from "../types/storage";
import type { Flashcard, I18n } from "../types";

interface Props {
  i18n: I18n;
  plugin: Plugin;
}

const props = defineProps<Props>();

const visible = ref(false);
const storage = new FlashcardStorage(props.plugin);
const cards = shallowRef<Flashcard[]>([]);
const categories = shallowRef<string[]>([]);
const selectedCategory = ref<string>("all");
const currentIndex = ref(0);

const filteredCards = computed(() => {
  if (selectedCategory.value === "all") {
    return cards.value;
  }
  return cards.value.filter((card) => card.category === selectedCategory.value);
});

const currentCard = computed(() => filteredCards.value[currentIndex.value]);

const categoryOptions = computed<SelectOption[]>(() => [
  { value: "all", label: props.i18n.allCategories || "全部" },
  ...categories.value.map((cat) => ({ value: cat, label: cat })),
]);

const loadCards = async () => {
  try {
    cards.value = await storage.getAllCards();
    categories.value = await storage.getCategories();
    currentIndex.value = 0;
  } catch (error) {
    console.error("Failed to load cards:", error);
  }
};

const playWord = async (card: Flashcard) => {
  try {
    const utterance = new SpeechSynthesisUtterance(card.title);
    utterance.lang = "en-US";
    utterance.rate = 0.8;

    utterance.onend = async () => {
      await storage.incrementPracticeCount(card.id);
      const index = cards.value.findIndex((c) => c.id === card.id);
      if (index !== -1) {
        cards.value[index].practiceCount =
          (cards.value[index].practiceCount || 0) + 1;
      }
    };

    speechSynthesis.speak(utterance);
  } catch (error) {
    showMessage(props.i18n.playFailed || "播放失败", 2000, "error");
  }
};

const previousCard = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    currentCard.value && playWord(currentCard.value);
  }
};

const nextCard = () => {
  if (currentIndex.value < filteredCards.value.length - 1) {
    currentIndex.value++;
    currentCard.value && playWord(currentCard.value);
  }
};

const randomCard = () => {
  if (filteredCards.value.length <= 1) return;
  let newIndex: number;
  do {
    newIndex = Math.floor(Math.random() * filteredCards.value.length);
  } while (newIndex === currentIndex.value && filteredCards.value.length > 1);
  currentIndex.value = newIndex;
  currentCard.value && playWord(currentCard.value);
};

const open = () => {
  visible.value = true;
  loadCards();
};

const close = () => {
  visible.value = false;
};

defineExpose({
  open,
  close,
  visible,
});

let dataChangeHandler: (() => void) | null = null;

onMounted(() => {
  dataChangeHandler = () => loadCards();
  window.addEventListener("flashcardDataChanged", dataChangeHandler);
});

onUnmounted(() => {
  if (dataChangeHandler) {
    window.removeEventListener("flashcardDataChanged", dataChangeHandler);
    dataChangeHandler = null;
  }
});
</script>

<style scoped lang="scss">
@use '../styles/index.scss' as *;

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
    z-index: 1;
  }
}

.card-counter {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  min-width: 60px;
  text-align: center;
}


.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;

  .flashcard-dialog {
    transform: scale(0.9) translateY(20px);
  }
}
</style>
