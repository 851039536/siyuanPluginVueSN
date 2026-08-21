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
            {{ isEditMode ? i18n.editScript : i18n.addScript }}
          </h3>
          <Button
            variant="ghost"
            size="xsmall"
            icon="close"
            @click="emit('close')"
          />
        </div>

        <div class="script-editor__body">
          <Input
            v-model="form.name"
            :label="i18n.name"
            :placeholder="i18n.name"
            :error="errors.name"
            required
          />

          <Select
            v-model="form.language"
            :options="languageOptions"
            :label="i18n.language"
            required
          />

          <div class="script-editor__category-row">
            <Select
              v-model="selectedCategory"
              :options="categoryOptions"
              :label="i18n.category"
              class="script-editor__category-select"
            />
            <Input
              v-if="selectedCategory === '__custom__'"
              v-model="customCategory"
              :placeholder="i18n.customCategory"
              class="script-editor__category-input"
            />
          </div>

          <Input
            v-model="form.description"
            :label="i18n.description"
            :placeholder="i18n.description"
          />

          <Input
            v-model="form.content"
            type="textarea"
            :label="i18n.content"
            :placeholder="i18n.content"
            :rows="10"
            required
          />
        </div>

        <div class="script-editor__footer">
          <Button
            variant="secondary"
            @click="emit('close')"
          >
            {{ i18n.cancel }}
          </Button>
          <Button
            variant="primary"
            :disabled="!isValid"
            @click="handleSave"
          >
            {{ i18n.save }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { CreateScriptDTO, Script, ScriptLanguage } from "../types"
import type { I18n } from "../types/index"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import type { SelectOption } from "@/components/Select.vue"
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
  save: [data: CreateScriptDTO]
}>()

const PRESET_CATEGORIES = ["工具", "备份", "数据处理", "系统", "其他"]

const form = ref<{
  name: string
  language: ScriptLanguage
  category: string
  description: string
  content: string
}>({
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

const categoryOptions = computed<SelectOption[]>(() => [
  {
    value: "",
    label: props.i18n.selectCategory ?? "",
  },
  {
    value: "__custom__",
    label: props.i18n.customCategory ?? "",
  },
  ...PRESET_CATEGORIES.map((cat) => ({
    value: cat,
    label: cat,
  })),
])

const isValid = computed(() => {
  return (
    form.value.name.trim() !== ""
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
@use "../styles/ScriptEditor.scss";
</style>
