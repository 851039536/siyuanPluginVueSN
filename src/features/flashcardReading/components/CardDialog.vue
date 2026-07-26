<!-- 单词阅读功能 - 卡片创建/编辑弹窗（自包含：内部持有表单状态并直接调用 storage 持久化） -->
<template>
  <div
    v-if="visible"
    class="dialog-overlay"
    @click.self="$emit('close')"
  >
    <div
      class="dialog"
      @click.stop
    >
      <!-- 弹窗标题："编辑" / "添加卡片" -->
      <div class="dialog-header">
        <h4>{{ editingCard ? t.editCard : t.addCard }}</h4>
        <Button
          variant="ghost"
          size="xsmall"
          icon="close"
          @click="$emit('close')"
        />
      </div>
      <!-- 表单区：标题 / 内容 / 类别 -->
      <div class="dialog-body">
        <!-- 标题输入（占位："标题（不可重复）"） -->
        <Input
          v-model="formData.title"
          :label="t.title"
          :placeholder="t.titlePlaceholder"
          :error="formErrors.title"
          size="small"
          required
          @input="handleTitleInput"
          @blur="validateTitle"
        />
        <!-- 内容输入（占位："内容"） -->
        <Input
          v-model="formData.content"
          type="textarea"
          :label="t.content"
          :placeholder="t.contentPlaceholder"
          :maxlength="1000"
          :showCount="true"
          :rows="8"
          size="small"
        />
        <div class="form-group">
          <!-- 类别标签："类别" -->
          <label>{{ t.category }}</label>
          <div class="category-input-group">
            <Select
              v-model="formData.category"
              :options="categoryOptions"
              size="small"
              @change="handleCategorySelect"
            />
            <!-- 自定义类别输入（占位："输入自定义类别"） -->
            <Input
              v-if="formData.category === '__custom__'"
              v-model="customCategory"
              :placeholder="t.customCategoryPlaceholder"
              class="custom-category-input"
              size="small"
            />
          </div>
        </div>
      </div>
      <!-- 底部操作栏："取消" / "保存" -->
      <div class="dialog-footer">
        <Button
          variant="secondary"
          @click="$emit('close')"
        >
          {{ t.cancel }}
        </Button>
        <Button
          variant="primary"
          :disabled="!isFormValid"
          @click="save"
        >
          {{ t.save }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  CreateFlashcardDTO,
  Flashcard,
  FormErrors,
  I18n,
} from "../types"
import type { SelectOption } from "@/components/Select.vue"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { emitCustomEvent } from "@/utils/eventBus"
import { getErrorMessage } from "@/utils/stringUtils"
import { useFlashcardStorage } from "../composables/useFlashcardStorage"
import { useI18n } from "../composables/useI18n"
import { CARD_CONFIG } from "../types"

const props = defineProps<{
  visible: boolean
  editingCard: Flashcard | null
  i18n: I18n
  plugin: Plugin
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const t = useI18n(props.i18n)

// 共享 storage 单例：与 Dock 面板复用同一实例与类别数据
const { storage, categories } = useFlashcardStorage(props.plugin)

const formData = ref<CreateFlashcardDTO>({
  title: "",
  content: "",
  category: "",
})
const formErrors = ref<FormErrors>({})
const customCategory = ref("")

const allCategories = computed(() => {
  const uniqueCategories = new Set([
    ...CARD_CONFIG.PRESET_CATEGORIES,
    ...categories.value,
  ])
  return Array.from(uniqueCategories).sort()
})

const categoryOptions = computed<SelectOption[]>(() => [
  {
    value: "",
    label: t.value.selectCategory,
  },
  {
    value: "__custom__",
    label: t.value.customCategory,
  },
  ...allCategories.value.map((cat) => ({
    value: cat,
    label: cat,
  })),
])

const isFormValid = computed(() => {
  const hasValidCategory =
    formData.value.category === "__custom__"
      ? customCategory.value.trim() !== ""
      : formData.value.category.trim() !== ""

  return (
    formData.value.title.trim() !== ""
    && formData.value.content.trim() !== ""
    && hasValidCategory
    && Object.keys(formErrors.value).length === 0
  )
})

// 弹窗打开时初始化表单：编辑模式回填卡片数据，新建模式清空
watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    formErrors.value = {}
    const card = props.editingCard
    if (card) {
      const isCustomCategory = !CARD_CONFIG.PRESET_CATEGORIES.includes(card.category)
      formData.value = {
        title: card.title,
        content: card.content,
        category: isCustomCategory ? "__custom__" : card.category,
      }
      customCategory.value = isCustomCategory ? card.category : ""
    } else {
      formData.value = {
        title: "",
        content: "",
        category: "",
      }
      customCategory.value = ""
    }
  },
)

const handleTitleInput = () => {
  if (formErrors.value.title) {
    delete formErrors.value.title
  }
}

const validateTitle = async () => {
  if (!formData.value.title.trim()) {
    formErrors.value.title = t.value.titleEmpty
    return
  }

  if (props.editingCard && formData.value.title === props.editingCard.title) {
    delete formErrors.value.title
    return
  }

  const isUnique = await storage.isTitleUnique(
    formData.value.title,
    props.editingCard?.id,
  )

  if (!isUnique) {
    formErrors.value.title = t.value.titleDuplicate
  } else {
    delete formErrors.value.title
  }
}

const handleCategorySelect = () => {
  if (formData.value.category === "__custom__") {
    customCategory.value = ""
  }
}

const save = async () => {
  await validateTitle()

  if (!isFormValid.value) {
    return
  }

  const categoryToSave =
    formData.value.category === "__custom__"
      ? customCategory.value.trim()
      : formData.value.category

  if (!categoryToSave) {
    showMessage(t.value.selectCategory, 2000, "error")
    return
  }

  try {
    const cardData = {
      ...formData.value,
      category: categoryToSave,
    }

    if (props.editingCard) {
      await storage.updateCard(props.editingCard.id, cardData)
      showMessage(t.value.updateSuccess, 2000, "info")
    } else {
      await storage.createCard(cardData)
      showMessage(t.value.createSuccess, 2000, "info")
    }

    // 广播数据变更，驱动 Dock/弹窗共享状态刷新
    emitCustomEvent("flashcardDataChanged")
    emit("saved")
  } catch (error: unknown) {
    showMessage(
      getErrorMessage(error) || t.value.saveFailed,
      3000,
      "error",
    )
  }
}
</script>
