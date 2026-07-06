<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="html-viewer-overlay modal-overlay"
        @click="emit('update:visible', false)"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="html-viewer-dialog small"
            @click.stop
          >
            <div class="dialog-header">
              <h2>{{ snippet ? '编辑片段' : '新建片段' }}</h2>
              <Button
                icon="close"
                variant="ghost"
                size="xsmall"
                @click="emit('update:visible', false)"
              />
            </div>
            <div class="dialog-body">
              <form
                class="edit-form"
                @submit.prevent="handleSubmit"
              >
                <div class="form-group">
                  <Input
                    v-model="form.name"
                    label="名称"
                    type="text"
                    placeholder="请输入片段名称"
                    required
                  />
                </div>
                <div class="form-group">
                  <Select
                    v-model="form.category"
                    label="分类"
                    :options="categoryOptions"
                    required
                  />
                </div>
                <div
                  v-if="snippet"
                  class="form-group"
                >
                  <label class="form-label">HTML内容</label>
                  <textarea
                    v-model="form.content"
                    class="edit-content-editor"
                    placeholder="请输入HTML代码..."
                    rows="10"
                    spellcheck="false"
                    required
                  ></textarea>
                </div>
                <div class="form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    @click="emit('update:visible', false)"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    :disabled="!form.name.trim() || (snippet ? !form.content.trim() : false)"
                  >
                    保存
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  HtmlCategory,
  HtmlSnippet,
} from "../types"
import {
  computed,
  reactive,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

interface Props {
  visible: boolean
  /** 编辑模式传入已有片段，新建传 null/undefined */
  snippet?: HtmlSnippet | null
  categories: HtmlCategory[]
  /** 新建时的 HTML 内容（从主编辑器传入） */
  defaultContent?: string
}

const props = withDefaults(defineProps<Props>(), {
  snippet: null,
  defaultContent: "",
})

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
  (e: "save", payload: { id?: string, name: string, category: string, content?: string }): void
}>()

const form = reactive({
  name: "",
  category: "default",
  content: "",
})

const categoryOptions = computed(() =>
  props.categories.map((cat) => ({
    value: cat.id,
    label: cat.name,
  })),
)

watch(
  () => props.visible,
  (val) => {
    if (!val) return
    if (props.snippet) {
      form.name = props.snippet.name
      form.category = props.snippet.category
      form.content = props.snippet.content
    } else {
      form.name = ""
      form.category = props.categories[0]?.id || "default"
      form.content = props.defaultContent
    }
  },
)

function handleSubmit() {
  if (!form.name.trim()) return
  if (props.snippet && !form.content.trim()) return

  emit("save", {
    id: props.snippet?.id,
    name: form.name.trim(),
    category: form.category,
    content: props.snippet ? form.content : undefined,
  })
  emit("update:visible", false)
}
</script>
