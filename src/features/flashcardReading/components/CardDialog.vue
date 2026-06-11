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
      <div class="dialog-header">
        <h4>{{ editingCard ? t.editCard : t.addCard }}</h4>
        <Button
          variant="ghost"
          size="small"
          icon="close"
          @click="$emit('close')"
        />
      </div>
      <div class="dialog-body">
        <Input
          :modelValue="localFormData.title"
          :label="t.title"
          :placeholder="t.titlePlaceholder"
          :error="formErrors.title"
          required
          @update:modelValue="updateField('title', $event)"
          @input="$emit('inputTitle')"
          @blur="$emit('validateTitle')"
        />
        <Input
          type="textarea"
          :modelValue="localFormData.content"
          :label="t.content"
          :placeholder="t.contentPlaceholder"
          :maxlength="1000"
          :showCount="true"
          :rows="8"
          @update:modelValue="updateField('content', $event)"
        />
        <div class="form-group">
          <label>{{ t.category }}</label>
          <div class="category-input-group">
            <Select
              :modelValue="localFormData.category"
              :options="categoryOptions"
              @update:modelValue="updateField('category', $event)"
              @change="$emit('changeCategory')"
            />
            <Input
              v-if="localFormData.category === '__custom__'"
              :modelValue="localCustomCategory"
              :placeholder="t.customCategoryPlaceholder"
              class="custom-category-input"
              @update:modelValue="emit('update:customCategory', String($event))"
            />
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <Button
          variant="secondary"
          @click="$emit('close')"
        >
          {{ t.cancel }}
        </Button>
        <Button
          variant="primary"
          :disabled="!isValid"
          @click="$emit('save')"
        >
          {{ t.save }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CreateFlashcardDTO,
  Flashcard,
  FormErrors,
  I18n,
} from "../types"
import type { SelectOption } from "@/components/Select.vue"
import {
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { useI18n } from "../composables/useI18n"

const props = defineProps<{
  visible: boolean
  editingCard: Flashcard | null
  formData: CreateFlashcardDTO
  formErrors: FormErrors
  customCategory: string
  categoryOptions: SelectOption[]
  isValid: boolean
  i18n: I18n
}>()

const emit = defineEmits<{
  "close": []
  "save": []
  "inputTitle": []
  "validateTitle": []
  "changeCategory": []
  "update:formData": [value: CreateFlashcardDTO]
  "update:customCategory": [value: string]
}>()

const t = useI18n(props.i18n)

const localFormData = ref<CreateFlashcardDTO>({ ...props.formData })
const localCustomCategory = ref(props.customCategory)

watch(
  () => props.formData,
  (val) => { localFormData.value = { ...val } },
  { deep: true },
)
watch(() => props.customCategory, (val) => {
  localCustomCategory.value = val
})

const updateField = (field: keyof CreateFlashcardDTO, value: unknown) => {
  localFormData.value[field] = String(value)
  emit("update:formData", { ...localFormData.value })
}
</script>
