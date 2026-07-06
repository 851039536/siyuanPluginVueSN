<!-- 添加 Git 项目弹窗 -->
<template>
  <div
    class="gp-mask"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog">
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">{{ i18n.addProject || '添加' }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <Input
          v-model="name"
          :label="i18n.projectName || '项目名称'"
          size="xsmall"
          :placeholder="i18n.namePlaceholder || '输入项目名称...'"
          @keydown="$event.key === 'Enter' && submit()"
        />
        <div class="gp-form-group">
          <label class="gp-label">{{ i18n.projectPath || '项目路径' }}</label>
          <div class="gp-path-row">
            <Input
              v-model="path"
              size="xsmall"
              :placeholder="i18n.pathPlaceholder || '选择或输入项目路径...'"
              @keydown="$event.key === 'Enter' && submit()"
            />
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              @click="$emit('pick-dir')"
            >
              <Icon icon="mdi:folder-open" height="12" />
            </button>
          </div>
        </div>
        <Select
          v-model="catId"
          :label="i18n.category || '分类'"
          size="xsmall"
          :options="categoryOptions"
        />

      </div>
      <div class="gp-dialog-footer">
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          {{ i18n.cancel || '取消' }}
        </button>
        <button
          class="vp-btn vp-btn--primary"
          :disabled="!name || !path"
          @click="submit"
        >
          {{ i18n.add || '添加' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
  watch,
} from "vue"
import Input from "@/components/Input.vue"
import type { SelectOption } from "@/components/Select.vue"
import Select from "@/components/Select.vue"
import { UNGROUPED_ID } from "../types"

const props = defineProps<{
  i18n: Record<string, any>
  categories: { id: string, name: string }[]
  selectedPath?: string
}>()

const categoryOptions = computed<SelectOption[]>(() =>
  props.categories.map((c) => ({ value: c.id, label: c.name })),
)

const emit = defineEmits<{
  "close": []
  "pick-dir": []
  "add": [data: { name: string, path: string, catId: string }]
}>()

const name = ref("")
const path = ref("")
const catId = ref(UNGROUPED_ID)

// 目录选择器回填路径
watch(() => props.selectedPath, (p) => {
  if (p) path.value = p
})

function submit() {
  emit("add", {
    name: name.value.trim(),
    path: path.value.trim(),
    catId: catId.value,
  })
}
</script>
