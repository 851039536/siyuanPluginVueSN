<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="script-editor-mask"
    >
      <div class="script-editor">
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
            :error="nameError"
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
import { hasIllegalFileNameChars } from "../utils"
import { SCRIPT_LANGUAGE_CONFIG } from "../types"

interface Props {
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

/** 名称前端校验：脚本名直接用作磁盘文件名，非法字符在保存前拦截 */
const nameError = computed(() => {
  const name = form.value.name.trim()
  if (!name) return ""
  return hasIllegalFileNameChars(name) ? props.i18n.nameInvalidChars ?? "" : ""
})

const isValid = computed(() => {
  return (
    form.value.name.trim() !== ""
    && nameError.value === ""
    && form.value.content.trim() !== ""
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

// 遮罩不响应点击关闭：编辑内容可能未保存，只能通过取消/关闭按钮退出，防误触丢稿

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
