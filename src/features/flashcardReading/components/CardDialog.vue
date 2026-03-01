<template>
  <div class="dialog-overlay" v-if="visible" @click.self="$emit('close')">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h4>{{ editingCard ? (i18n.editCard || '编辑卡片') : (i18n.addCard || '添加卡片') }}</h4>
        <Button variant="ghost" size="small" icon="close" @click="$emit('close')" />
      </div>
      <div class="dialog-body">
        <Input
          :modelValue="localFormData.title"
          @update:modelValue="updateField('title', String($event))"
          :label="i18n.title || '标题'"
          :placeholder="i18n.titlePlaceholder || '标题（不可重复）'"
          :error="formErrors.title"
          @input="$emit('input:title')"
          @blur="$emit('validate:title')"
          required
        />
        <Textarea
          :modelValue="localFormData.content"
          @update:modelValue="updateField('content', $event)"
          :label="i18n.content || '内容'"
          :placeholder="i18n.contentPlaceholder || '内容'"
          :maxlength="1000"
          :showCount="true"
          :rows="8"
        />
        <div class="form-group">
          <label>{{ i18n.category || '类别' }}</label>
          <div class="category-input-group">
            <Select
              :modelValue="localFormData.category"
              @update:modelValue="updateField('category', String($event))"
              :options="categoryOptions"
              @change="$emit('change:category')"
            />
            <Input
              v-if="localFormData.category === '__custom__'"
              :modelValue="localCustomCategory"
@update:modelValue="emit('update:customCategory', String($event))"
              :placeholder="i18n.customCategoryPlaceholder || '输入自定义类别'"
              class="custom-category-input"
            />
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <Button variant="secondary" @click="$emit('close')">
          {{ i18n.cancel || '取消' }}
        </Button>
        <Button variant="primary" @click="$emit('save')" :disabled="!isValid">
          {{ i18n.save || '保存' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from '@/components/Button.vue'
import Input from '@/components/Input.vue'
import Textarea from '@/components/Textarea.vue'
import Select from '@/components/Select.vue'
import type { SelectOption } from '@/components/Select.vue'
import type { Flashcard, FormData, FormErrors, I18n } from '../types'

const props = defineProps<{
  visible: boolean
  editingCard: Flashcard | null
  formData: FormData
  formErrors: FormErrors
  customCategory: string
  categoryOptions: SelectOption[]
  isValid: boolean
  i18n: I18n
}>()

const emit = defineEmits<{
  close: []
  save: []
  'input:title': []
  'validate:title': []
  'change:category': []
  'update:formData': [value: FormData]
  'update:customCategory': [value: string]
}>()

const localFormData = ref<FormData>({ title: '', content: '', category: '' })
const localCustomCategory = ref('')

watch(() => props.formData, (newVal) => {
  localFormData.value = { ...newVal }
}, { immediate: true, deep: true })

watch(() => props.customCategory, (newVal) => {
  localCustomCategory.value = newVal
}, { immediate: true })

const updateField = (field: keyof FormData, value: string) => {
  localFormData.value[field] = value
  emit('update:formData', { ...localFormData.value })
}
</script>
