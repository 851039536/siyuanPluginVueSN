<template>
  <div class="flashcard-reading-panel">
    <PanelHeader
      :i18n="i18n"
      @addCard="openCreateDialog"
      @refresh="loadCards"
    />

    <CategoryFilter
      v-model:selectedCategory="selectedCategory"
      v-model:searchQuery="searchQuery"
      :i18n="i18n"
      :categoryOptions="categoryOptions"
      :totalCards="cards.length"
      :filteredCount="filteredCards.length"
    />

    <div class="card-container" v-if="cards.length > 0">
      <CardList
        v-if="viewMode === 'list'"
        :cards="paginatedCards"
        :i18n="i18n"
        @play="playWord"
        @copyTitle="copyTitle"
        @copyContent="copyContent"
        @edit="editCard"
        @delete="deleteCard"
      />

      <SingleCardView
        v-else-if="viewMode === 'single'"
        :currentCard="currentCard"
        :currentIndex="currentIndex"
        :totalCards="filteredCards.length"
        :i18n="i18n"
        @play="playWord"
        @previous="previousCard"
        @next="nextCard"
        @random="randomCard"
      />

      <StatisticsView
        v-else-if="viewMode === 'statistics'"
        :statistics="statisticsData"
        :i18n="i18n"
      />

      <div class="pagination" v-if="viewMode === 'list' && totalPages > 1">
        <Button
          variant="secondary"
          size="small"
          @click="currentPage--"
          :disabled="currentPage === 1"
        >
          {{ i18n.previous || '上一页' }}
        </Button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <Button
          variant="secondary"
          size="small"
          @click="currentPage++"
          :disabled="currentPage === totalPages"
        >
          {{ i18n.next || '下一页' }}
        </Button>
      </div>
    </div>

    <div class="empty-state" v-else>
      <IconWrapper name="file" :size="48" />
      <p>{{ i18n.noCards || '暂无卡片' }}</p>
      <Button variant="primary" icon="add" @click="openCreateDialog">
        {{ i18n.addCard || '添加卡片' }}
      </Button>
    </div>

    <div class="view-mode-toggle" v-if="cards.length > 0">
      <Button
        :variant="viewMode === 'list' ? 'primary' : 'secondary'"
        size="small"
        @click="viewMode = 'list'"
      >
        {{ i18n.listView || '列表' }}
      </Button>
      <Button
        :variant="viewMode === 'single' ? 'primary' : 'secondary'"
        size="small"
        @click="switchToSingleMode"
      >
        {{ i18n.singleView || '单卡' }}
      </Button>
      <Button
        :variant="viewMode === 'statistics' ? 'primary' : 'secondary'"
        size="small"
        @click="viewMode = 'statistics'"
      >
        {{ i18n.statisticsView || '统计' }}
      </Button>
    </div>

    <CardDialog
      :visible="showCreateDialog"
      :editingCard="editingCard"
      :formData="formData"
      :formErrors="formErrors"
      :customCategory="customCategory"
      :categoryOptions="formCategoryOptions"
      :isValid="isFormValid"
      :i18n="i18n"
      @close="closeDialog"
      @save="saveCard"
      @input:title="handleTitleInput"
      @validate:title="validateTitle"
      @change:category="handleCategorySelect"
      @update:formData="formData = $event"
      @update:customCategory="customCategory = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, shallowRef } from "vue";
import { showMessage } from "siyuan";

import IconWrapper from "@/components/IconWrapper.vue";
import Button from "@/components/Button.vue";
import type { SelectOption } from "@/components/Select.vue";
import type { Plugin } from "siyuan";

import PanelHeader from "./components/PanelHeader.vue";
import CategoryFilter from "./components/CategoryFilter.vue";
import CardList from "./components/CardList.vue";
import SingleCardView from "./components/SingleCardView.vue";
import StatisticsView from "./components/StatisticsView.vue";
import CardDialog from "./components/CardDialog.vue";

import { FlashcardStorage } from "./types/storage";
import type {
  Flashcard,
  CreateFlashcardDTO,
  ViewMode,
  StatisticsData,
  I18n,
} from "./types";

const CONFIG = {
  PAGE_SIZE: 10,
  PRESET_CATEGORIES: [
    "C#",
    "编程单词",
    "JavaScript",
    "TypeScript",
    "Vue",
    "Rust",
  ] as string[],
};

interface Props {
  i18n: I18n;
  plugin: Plugin;
}

const props = defineProps<Props>();

const storage = new FlashcardStorage(props.plugin);
const cards = shallowRef<Flashcard[]>([]);
const categories = shallowRef<string[]>([]);
const selectedCategory = ref<string>("all");
const searchQuery = ref<string>("");
const viewMode = ref<ViewMode>("list");
const currentPage = ref(1);
const currentIndex = ref(0);

const showCreateDialog = ref(false);
const editingCard = ref<Flashcard | null>(null);
const formData = ref<CreateFlashcardDTO>({
  title: "",
  content: "",
  category: "",
});
const formErrors = ref<Record<string, string>>({});
const customCategory = ref("");

const normalizedSearchQuery = computed(() =>
  searchQuery.value.toLowerCase().trim(),
);

const categoryOptions = computed<SelectOption[]>(() => [
  { value: "all", label: props.i18n.allCategories || "全部" },
  ...categories.value.map((cat) => ({ value: cat, label: cat })),
]);

const formCategoryOptions = computed<SelectOption[]>(() => [
  { value: "", label: props.i18n.selectCategory || "请选择类别" },
  { value: "__custom__", label: props.i18n.customCategory || "自定义..." },
  ...allCategories.value.map((cat) => ({ value: cat, label: cat })),
]);

const allCategories = computed(() => {
  const uniqueCategories = new Set([
    ...CONFIG.PRESET_CATEGORIES,
    ...categories.value,
  ]);
  return Array.from(uniqueCategories).sort();
});

const filteredCards = computed(() => {
  let result = cards.value;
  const category = selectedCategory.value;
  const query = normalizedSearchQuery.value;

  if (category !== "all") {
    result = result.filter((card) => card.category === category);
  }

  if (query) {
    result = result.filter(
      (card) =>
        card.title.toLowerCase().includes(query) ||
        card.content.toLowerCase().includes(query),
    );
  }

  return result;
});

const currentCard = computed(() => filteredCards.value[currentIndex.value]);

const totalPages = computed(() =>
  Math.ceil(filteredCards.value.length / CONFIG.PAGE_SIZE),
);

const paginatedCards = computed(() => {
  const start = (currentPage.value - 1) * CONFIG.PAGE_SIZE;
  const end = start + CONFIG.PAGE_SIZE;
  return filteredCards.value.slice(start, end);
});

const isFormValid = computed(() => {
  const hasValidCategory =
    formData.value.category === "__custom__"
      ? customCategory.value.trim() !== ""
      : formData.value.category.trim() !== "";

  return (
    formData.value.title.trim() !== "" &&
    formData.value.content.trim() !== "" &&
    hasValidCategory &&
    Object.keys(formErrors.value).length === 0
  );
});

const statisticsData = computed<StatisticsData>(() => {
  const cardList = cards.value;
  const categoryStats = new Map<string, number>();
  const cardStats: Array<{ title: string; category: string; count: number }> =
    [];
  let totalPractice = 0;
  let practicedCards = 0;

  for (const card of cardList) {
    const count = card.practiceCount || 0;
    totalPractice += count;
    if (count > 0) practicedCards++;

    categoryStats.set(
      card.category,
      (categoryStats.get(card.category) || 0) + count,
    );

    if (count > 0) {
      cardStats.push({ title: card.title, category: card.category, count });
    }
  }

  cardStats.sort((a, b) => b.count - a.count);
  const categoryArray = Array.from(categoryStats.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalPractice,
    practicedCards,
    totalCards: cardList.length,
    categoryStats: categoryArray,
    cardStats: cardStats.slice(0, 20),
  };
});

const loadCards = async () => {
  try {
    cards.value = await storage.getAllCards();
    categories.value = await storage.getCategories();
  } catch (error) {
    console.error("Failed to load cards:", error);
    showMessage(props.i18n.loadFailed || "加载卡片失败", 3000, "error");
  }
};

const switchToSingleMode = () => {
  viewMode.value = "single";
  const len = filteredCards.value.length;
  currentIndex.value = len > 0 ? Math.floor(Math.random() * len) : 0;
};

const playCurrentCard = () => {
  const card = currentCard.value;
  if (card) {
    playWord(card);
  }
};

const previousCard = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    playCurrentCard();
  }
};

const nextCard = () => {
  if (currentIndex.value < filteredCards.value.length - 1) {
    currentIndex.value++;
    playCurrentCard();
  }
};

const randomCard = () => {
  if (filteredCards.value.length <= 1) {
    return;
  }
  let newIndex: number;
  do {
    newIndex = Math.floor(Math.random() * filteredCards.value.length);
  } while (newIndex === currentIndex.value && filteredCards.value.length > 1);
  currentIndex.value = newIndex;
  playCurrentCard();
};

const handleTitleInput = () => {
  if (formErrors.value.title) {
    delete formErrors.value.title;
  }
};

const validateTitle = async () => {
  if (!formData.value.title.trim()) {
    formErrors.value.title = props.i18n.titleEmpty || "标题不能为空";
    return;
  }

  if (editingCard.value && formData.value.title === editingCard.value.title) {
    delete formErrors.value.title;
    return;
  }

  const isUnique = await storage.isTitleUnique(
    formData.value.title,
    editingCard.value?.id,
  );

  if (!isUnique) {
    formErrors.value.title = props.i18n.titleDuplicate || "标题已存在";
  } else {
    delete formErrors.value.title;
  }
};

const openCreateDialog = () => {
  showCreateDialog.value = true;
};

const saveCard = async () => {
  await validateTitle();

  if (!isFormValid.value) {
    return;
  }

  const categoryToSave =
    formData.value.category === "__custom__"
      ? customCategory.value.trim()
      : formData.value.category;

  if (!categoryToSave) {
    showMessage(props.i18n.selectCategory || "请选择类别", 2000, "error");
    return;
  }

  try {
    const cardData = {
      ...formData.value,
      category: categoryToSave,
    };

    if (editingCard.value) {
      await storage.updateCard(editingCard.value.id, cardData);
      showMessage(props.i18n.updateSuccess || "卡片已更新", 2000, "info");
    } else {
      await storage.createCard(cardData);
      showMessage(props.i18n.createSuccess || "卡片已创建", 2000, "info");
    }

    closeDialog();
    await loadCards();
  } catch (error: any) {
    showMessage(
      error.message || props.i18n.saveFailed || "保存失败",
      3000,
      "error",
    );
  }
};

const closeDialog = () => {
  showCreateDialog.value = false;
  editingCard.value = null;
  formData.value = { title: "", content: "", category: "" };
  formErrors.value = {};
  customCategory.value = "";
};

const handleCategorySelect = () => {
  if (formData.value.category === "__custom__") {
    customCategory.value = "";
  }
};

const editCard = (card: Flashcard) => {
  editingCard.value = card;
  const category = card.category;
  const isCustomCategory = !CONFIG.PRESET_CATEGORIES.includes(category);
  formData.value = {
    title: card.title,
    content: card.content,
    category: isCustomCategory ? "__custom__" : category,
  };
  customCategory.value = isCustomCategory ? category : "";
  showCreateDialog.value = true;
};

const deleteCard = async (card: Flashcard) => {
  if (!confirm(props.i18n.confirmDelete || "确定要删除这张卡片吗？")) {
    return;
  }

  try {
    await storage.deleteCard(card.id);
    showMessage(props.i18n.deleteSuccess || "卡片已删除", 2000, "info");
    await loadCards();
  } catch (error: any) {
    showMessage(
      error.message || props.i18n.deleteFailed || "删除失败",
      3000,
      "error",
    );
  }
};

const playWord = async (wordOrCard: string | Flashcard | null) => {
  if (!wordOrCard) return;

  const word = typeof wordOrCard === "string" ? wordOrCard : wordOrCard.title;
  const card = typeof wordOrCard === "string" ? null : wordOrCard;

  try {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.8;

    if (card) {
      utterance.onend = async () => {
        await storage.incrementPracticeCount(card.id);
        const index = cards.value.findIndex((c) => c.id === card.id);
        if (index !== -1) {
          cards.value[index].practiceCount =
            (cards.value[index].practiceCount || 0) + 1;
        }
      };
    }

    speechSynthesis.speak(utterance);
  } catch (error) {
    console.error("Failed to play pronunciation:", error);
    showMessage(props.i18n.playFailed || "播放失败", 2000, "error");
  }
};

const copyTitle = async (card: Flashcard) => {
  try {
    await navigator.clipboard.writeText(card.title);
    showMessage("已复制单词", 2000, "info");
  } catch (error) {
    console.error("Failed to copy title:", error);
    showMessage("复制失败", 2000, "error");
  }
};

const copyContent = async (card: Flashcard) => {
  try {
    await navigator.clipboard.writeText(card.content);
    showMessage("已复制内容", 2000, "info");
  } catch (error) {
    console.error("Failed to copy content:", error);
    showMessage("复制失败", 2000, "error");
  }
};

let dataChangeHandler: (() => void) | null = null;

onMounted(() => {
  loadCards();

  dataChangeHandler = () => loadCards();
  window.addEventListener("flashcardDataChanged", dataChangeHandler);
});

onUnmounted(() => {
  if (dataChangeHandler) {
    window.removeEventListener("flashcardDataChanged", dataChangeHandler);
    dataChangeHandler = null;
  }
});

watch(searchQuery, () => {
  currentPage.value = 1;
  currentIndex.value = 0;
});

watch(selectedCategory, () => {
  currentPage.value = 1;
  currentIndex.value = 0;
});
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
