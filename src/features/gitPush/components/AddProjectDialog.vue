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
          <Icon icon="mdi:close" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <div class="gp-form-group">
          <label class="gp-label">{{ i18n.projectName || '项目名称' }}</label>
          <input
            v-model="name"
            class="gp-input"
            :placeholder="i18n.namePlaceholder || '输入项目名称...'"
            @keyup.enter="submit"
          />
        </div>
        <div class="gp-form-group">
          <label class="gp-label">{{ i18n.projectPath || '项目路径' }}</label>
          <div class="gp-path-row">
            <input
              v-model="path"
              class="gp-input"
              :placeholder="i18n.pathPlaceholder || '选择或输入项目路径...'"
              @keyup.enter="submit"
            />
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              @click="$emit('pick-dir')"
            >
              <Icon icon="mdi:folder-open" />
            </button>
          </div>
        </div>
        <div class="gp-form-group">
          <label class="gp-label">{{ i18n.category || '分类' }}</label>
          <select
            v-model="catId"
            class="gp-select"
          >
            <option
              v-for="cat in categories"
              :key="cat.id"
              :value="cat.id"
            >
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div class="gp-form-group">
          <label class="gp-label">标签（可选，逗号分隔）</label>
          <input
            v-model="tags"
            class="gp-input"
            placeholder="如：前端, 个人作品, 长期维护"
          />
        </div>
        <div
          v-if="error"
          class="gp-error"
        >
          {{ error }}
        </div>
        <div
          v-if="checking"
          class="gp-checking"
        >
          <Icon
            icon="mdi:loading"
            class="gp-spin"
          />
          {{ i18n.checkingGit || '正在检查 git 仓库...' }}
        </div>
        <div
          v-if="result !== null && !checking"
          class="gp-check-result"
          :class="{ success: result }"
        >
          {{ result ? (i18n.gitRepoDetected || '已检测到 git 仓库') : (i18n.notGitRepo || '未检测到 git 仓库，将仅记录路径') }}
        </div>
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
  ref,
  watch,
} from "vue"

const props = defineProps<{
  i18n: Record<string, any>
  categories: { id: string, name: string }[]
  selectedPath?: string
}>()

const emit = defineEmits<{
  "close": []
  "pick-dir": []
  "add": [data: { name: string, path: string, catId: string, tags: string[] }]
}>()

const name = ref("")
const path = ref("")
const catId = ref("__ungrouped__")
const tags = ref("")
const error = ref("")
const checking = ref(false)
const result = ref<boolean | null>(null)

// 目录选择器回填路径
watch(() => props.selectedPath, (p) => {
  if (p) path.value = p
})

function submit() {
  emit("add", {
    name: name.value.trim(),
    path: path.value.trim(),
    catId: catId.value,
    tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean),
  })
}
</script>
