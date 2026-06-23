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
            class="html-viewer-dialog"
            @click.stop
          >
            <div class="dialog-header">
              <div class="header-title">
                <IconWrapper
                  name="folder"
                  :size="22"
                />
                <h2>HTML 片段库</h2>
              </div>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="emit('update:visible', false)"
              />
            </div>
            <div class="dialog-body">
              <!-- 分类筛选 -->
              <div class="category-filter">
                <div class="category-chips">
                  <button
                    v-for="cat in allCategoryChips"
                    :key="cat.id"
                    class="category-chip"
                    :class="{ active: selectedCategory === cat.id }"
                    :style="{ '--cat-color': cat.color }"
                    @click="selectedCategory = cat.id"
                  >
                    <span
                      class="chip-dot"
                      :style="{ backgroundColor: cat.color }"
                    ></span>
                    {{ cat.name }}
                  </button>
                </div>
                <Button
                  icon="settings"
                  variant="ghost"
                  size="small"
                  title="管理分类"
                  @click="emit('manage-categories')"
                />
              </div>

              <!-- 搜索 -->
              <div class="snippet-controls">
                <IconWrapper
                  name="search"
                  :size="16"
                  class="search-icon"
                />
                <Input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索片段名称..."
                  size="small"
                />
                <Button
                  icon="add"
                  variant="primary"
                  size="small"
                  @click="emit('create-snippet')"
                >
                  新建片段
                </Button>
              </div>

              <!-- 片段列表 -->
              <div class="snippet-grid">
                <div
                  v-for="snippet in filteredSnippets"
                  :key="snippet.id"
                  class="snippet-card"
                >
                  <div class="snippet-header">
                    <h3>{{ snippet.name }}</h3>
                    <span
                      class="snippet-category-tag"
                      :style="{
                        backgroundColor: `${getCategoryById(snippet.category)?.color}20`,
                        color: getCategoryById(snippet.category)?.color,
                      }"
                    >
                      {{ getCategoryById(snippet.category)?.name || '未分类' }}
                    </span>
                  </div>
                  <div class="snippet-preview-mini">
                    <iframe
                      class="mini-preview-iframe"
                      sandbox="allow-scripts"
                      :srcdoc="getPreviewHtml(snippet.content)"
                    ></iframe>
                  </div>
                  <div class="snippet-meta">
                    <span class="snippet-time">{{ formatTime(snippet.updatedAt) }}</span>
                  </div>
                  <div class="snippet-actions">
                    <Button
                      variant="ghost"
                      size="small"
                      @click="emit('load-snippet', snippet)"
                    >
                      加载
                    </Button>
                    <Button
                      variant="ghost"
                      size="small"
                      @click="emit('edit-snippet', snippet)"
                    >
                      编辑
                    </Button>
                    <Button
                      icon="delete"
                      variant="ghost"
                      size="small"
                      title="删除"
                      @click="emit('delete-snippet', snippet.id)"
                    />
                  </div>
                </div>

                <div
                  v-if="filteredSnippets.length === 0"
                  class="no-snippets"
                >
                  {{ searchQuery ? '未找到匹配的片段' : '暂无HTML片段，点击新建' }}
                </div>
              </div>
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
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"

interface Props {
  visible: boolean
  snippets: HtmlSnippet[]
  categories: HtmlCategory[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
  (e: "load-snippet", snippet: HtmlSnippet): void
  (e: "edit-snippet", snippet: HtmlSnippet): void
  (e: "delete-snippet", id: string): void
  (e: "create-snippet"): void
  (e: "manage-categories"): void
}>()

const selectedCategory = ref("all")
const searchQuery = ref("")

const allCategoryChips = computed(() => [
  {
    id: "all",
    name: "全部",
    color: "#b0aea5",
  },
  ...props.categories,
])

const categoriesMap = computed(() => {
  const map = new Map<string, HtmlCategory>()
  for (const cat of props.categories) {
    map.set(cat.id, cat)
  }
  return map
})

const getCategoryById = (id: string): HtmlCategory | undefined => {
  return categoriesMap.value.get(id)
}

const filteredSnippets = computed(() => {
  let result = props.snippets
  if (selectedCategory.value !== "all") {
    result = result.filter((s) => s.category === selectedCategory.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((s) => s.name.toLowerCase().includes(q))
  }
  return result
})

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getPreviewHtml(content: string): string {
  return `<style>body{margin:0;padding:4px;overflow:hidden;pointer-events:none;font-size:12px;}</style>${content}`
}
</script>
