<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="script-editor-mask"
      @click="handleMaskClick"
    >
      <div
        class="script-editor"
        @click.stop
      >
        <div class="script-editor__header">
          <h3 class="script-editor__title">
            {{ isEditMode ? (i18n.editScript || "编辑脚本") : (i18n.addScript || "添加脚本") }}
          </h3>
          <Button
            variant="ghost"
            size="small"
            icon="close"
            @click="emit('close')"
          />
        </div>

        <div class="script-editor__body">
          <Input
            v-model="form.name"
            :label="i18n.name || '名称'"
            :placeholder="i18n.name || '脚本名称'"
            :error="errors.name"
            required
          />

          <Select
            v-model="form.language"
            :options="languageOptions"
            :label="i18n.language || '语言'"
            required
          />

          <div class="script-editor__category-row">
            <Select
              v-model="selectedCategory"
              :options="categoryOptions"
              :label="i18n.category || '分类'"
              class="script-editor__category-select"
            />
            <Input
              v-if="selectedCategory === '__custom__'"
              v-model="customCategory"
              :placeholder="i18n.customCategory || '自定义分类'"
              class="script-editor__category-input"
            />
          </div>

          <Input
            v-model="form.description"
            :label="i18n.description || '描述'"
            :placeholder="i18n.description || '脚本描述（可选）'"
          />

          <Input
            v-model="form.content"
            type="textarea"
            :label="i18n.content || '脚本内容'"
            :placeholder="i18n.content || '在此输入脚本代码...'"
            :rows="10"
            required
          />
        </div>

        <div class="script-editor__footer">
          <Button
            variant="secondary"
            @click="emit('close')"
          >
            {{ i18n.cancel || "取消" }}
          </Button>
          <Button
            variant="primary"
            :disabled="!isValid"
            @click="handleSave"
          >
            {{ i18n.save || "保存" }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { Script } from "../types"
import type { I18n } from "../types/index"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { SCRIPT_LANGUAGE_CONFIG } from "../types"

interface Props {
  plugin: Plugin
  i18n: I18n
  script?: Script | null
  visible?: boolean
  content?: string
}

const props = withDefaults(defineProps<Props>(), {
  script: null,
  visible: false,
  content: "",
})

const emit = defineEmits<{
  close: []
  save: [data: {
    name: string
    language: string
    category: string
    description: string
    content: string
  }]
}>()

const PRESET_CATEGORIES = ["工具", "备份", "数据处理", "系统", "其他"]

const form = ref({
  name: "",
  language: "python",
  category: "",
  description: "",
  content: "",
})

const selectedCategory = ref("")
const customCategory = ref("")
const errors = ref<Record<string, string>>({})

const isEditMode = computed(() => !!props.script)

const languageOptions = computed(() =>
  Object.entries(SCRIPT_LANGUAGE_CONFIG).map(([key, cfg]) => ({
    value: key,
    label: cfg.label,
  })),
)

const categoryOptions = computed(() => [
  {
    value: "",
    label: props.i18n.selectCategory || "请选择分类",
  },
  {
    value: "__custom__",
    label: props.i18n.customCategory || "自定义...",
  },
  ...PRESET_CATEGORIES.map((cat) => ({
    value: cat,
    label: cat,
  })),
])

const isValid = computed(() => {
  return (
    form.value.name.trim() !== ""
    && form.value.language !== ""
    && form.value.content.trim() !== ""
    && Object.keys(errors.value).length === 0
  )
})

function getCategoryToSave(): string {
  if (selectedCategory.value === "__custom__") {
    return customCategory.value.trim()
  }
  return selectedCategory.value
}

function resetForm() {
  if (props.script) {
    form.value = {
      name: props.script.name,
      language: props.script.language,
      category: props.script.category,
      description: props.script.description,
      content: props.content || "",
    }
    const isCustom = !PRESET_CATEGORIES.includes(props.script.category)
    selectedCategory.value = isCustom ? "__custom__" : props.script.category
    customCategory.value = isCustom ? props.script.category : ""
  } else {
    form.value = {
      name: "",
      language: "python",
      category: "",
      description: "",
      content: "",
    }
    selectedCategory.value = ""
    customCategory.value = ""
  }
  errors.value = {}
}

function handleSave() {
  if (!isValid.value) return

  const category = getCategoryToSave()
  emit("save", {
    name: form.value.name.trim(),
    language: form.value.language,
    category,
    description: form.value.description.trim(),
    content: form.value.content,
  })
}

function handleMaskClick() {
  emit("close")
}

watch(
  () => [props.visible, props.script],
  ([visible]) => {
    if (visible) resetForm()
  },
)
</script>

<style lang="scss" scoped>
@use "@/variables.scss" as *;

.script-editor-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.script-editor {
  width: 560px;
  max-width: 90vw;
  max-height: 90vh;
  background: var(--b3-theme-background, $brand-light);
  border-radius: $radius-lg;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-4 $spacing-5;
    border-bottom: 1px solid var(--b3-border-color, $brand-subtle-gray);
  }

  &__title {
    margin: 0;
    font-family: $font-heading;
    font-size: $font-size-lg;
    font-weight: 600;
    color: var(--b3-theme-on-background, $brand-dark);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    padding: $spacing-4 $spacing-5;
    overflow-y: auto;
    flex: 1;
  }

  &__category-row {
    display: flex;
    align-items: flex-end;
    gap: $spacing-2;
  }

  &__category-select {
    flex: 1;
  }

  &__category-input {
    flex: 1;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $spacing-2;
    padding: $spacing-3 $spacing-5;
    border-top: 1px solid var(--b3-border-color, $brand-subtle-gray);
  }
}
</style>
