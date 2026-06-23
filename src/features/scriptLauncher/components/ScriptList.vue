<template>
  <div class="script-list">
    <div class="script-list__filters">
      <Select
        v-model="selectedLanguage"
        :options="languageOptions"
        size="small"
        :placeholder="i18n.selectLanguage || '语言'"
      />
      <Select
        v-model="selectedCategory"
        :options="categoryOptions"
        size="small"
        :placeholder="i18n.selectCategory || '分类'"
      />
      <Input
        v-model="localSearchQuery"
        type="search"
        size="small"
        :placeholder="i18n.searchPlaceholder || '搜索脚本...'"
        prefix-icon="search"
      />
    </div>

    <div
      v-if="groupedScripts.length > 0"
      class="script-list__groups"
    >
      <div
        v-for="group in groupedScripts"
        :key="group.language"
        class="script-list__group"
      >
        <div
          class="script-list__group-header"
          :style="{ borderLeftColor: group.color }"
        >
          <IconWrapper
            :name="group.icon as any"
            :size="16"
            :color="group.color"
          />
          <span
            class="script-list__group-title"
            :style="{ color: group.color }"
          >{{ group.label }}</span>
          <Badge
            variant="default"
            size="small"
          >{{ group.scripts.length }}</Badge>
        </div>

        <div class="script-list__cards">
          <Card
            v-for="script in group.scripts"
            :key="script.id"
            variant="bordered"
            size="small"
            class="script-list__card"
          >
            <template #header>
              <div class="script-list__card-header">
                <span class="script-list__card-name">{{ script.name }}</span>
                <Badge
                  :color="getLanguageColor(script.language)"
                  size="small"
                >
                  {{ getLanguageLabel(script.language) }}
                </Badge>
              </div>
            </template>

            <div class="script-list__card-body">
              <p
                v-if="script.description"
                class="script-list__card-desc"
              >{{ script.description }}</p>
              <p class="script-list__card-meta">
                <span>{{ script.category }}</span>
                <span v-if="script.lastRunAt">{{ formatLastRun(script.lastRunAt) }}</span>
                <span v-else>{{ i18n.neverRun || "未运行" }}</span>
              </p>
              <p class="script-list__card-path">
                data/storage/sc/{{ script.fileName }}
              </p>
            </div>

            <template #footer>
              <div class="script-list__card-actions">
                <Button
                  variant="success"
                  size="small"
                  icon="play"
                  class="script-list__btn-run"
                  :title="i18n.runScript || '运行'"
                  @click="emit('run', script)"
                />
                <Button
                  variant="secondary"
                  size="small"
                  icon="edit"
                  :title="i18n.editScript || '编辑'"
                  @click="emit('edit', script)"
                />
                <Button
                  variant="danger"
                  size="small"
                  icon="delete"
                  :title="i18n.deleteScript || '删除'"
                  @click="emit('delete', script)"
                />
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>

    <div
      v-else
      class="script-list__empty"
    >
      <IconWrapper
        name="file"
        :size="48"
      />
      <p>{{ i18n.noScripts || "暂无脚本" }}</p>
      <Button
        variant="primary"
        icon="add"
        @click="emit('add')"
      >
        {{ i18n.addScript || "添加脚本" }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  Script,
  ScriptLanguage,
} from "../types"
import type { I18n } from "../types/index"
import {
  computed,
  ref,
} from "vue"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import Card from "@/components/Card.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { SCRIPT_LANGUAGE_CONFIG } from "../types"

interface Props {
  scripts: Script[]
  language?: string
  searchQuery?: string
  i18n: I18n
}

const props = withDefaults(defineProps<Props>(), {
  language: "all",
  searchQuery: "",
})

const emit = defineEmits<{
  select: [script: Script]
  delete: [script: Script]
  add: []
  edit: [script: Script]
  run: [script: Script]
}>()

const selectedLanguage = ref(props.language)
const selectedCategory = ref("all")
const localSearchQuery = ref(props.searchQuery)

const languageOptions = computed(() => [
  {
    value: "all",
    label: props.i18n.allLanguages || "全部语言",
  },
  ...Object.entries(SCRIPT_LANGUAGE_CONFIG).map(([key, cfg]) => ({
    value: key,
    label: cfg.label,
  })),
])

const categoryOptions = computed(() => {
  const categories = new Set(props.scripts.map((s) => s.category))
  return [
    {
      value: "all",
      label: props.i18n.allCategories || "全部分类",
    },
    ...Array.from(categories).sort().map((cat) => ({
      value: cat,
      label: cat,
    })),
  ]
})

const filteredScripts = computed(() => {
  let result = props.scripts

  if (selectedLanguage.value && selectedLanguage.value !== "all") {
    result = result.filter((s) => s.language === selectedLanguage.value)
  }

  if (selectedCategory.value && selectedCategory.value !== "all") {
    result = result.filter((s) => s.category === selectedCategory.value)
  }

  const query = localSearchQuery.value.trim().toLowerCase()
  if (query) {
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(query)
        || s.description.toLowerCase().includes(query)
        || s.category.toLowerCase().includes(query),
    )
  }

  return result
})

const groupedScripts = computed(() => {
  const groups = new Map<ScriptLanguage, Script[]>()
  for (const script of filteredScripts.value) {
    if (!groups.has(script.language)) {
      groups.set(script.language, [])
    }
    groups.get(script.language)!.push(script)
  }

  const order: ScriptLanguage[] = ["python", "nodejs", "bash", "powershell", "batch", "other"]
  return order
    .filter((lang) => groups.has(lang))
    .map((lang) => {
      const cfg = SCRIPT_LANGUAGE_CONFIG[lang]
      return {
        language: lang,
        label: cfg.label,
        icon: cfg.icon,
        color: cfg.color,
        scripts: groups.get(lang)!,
      }
    })
})

function getLanguageColor(language: ScriptLanguage): string {
  return SCRIPT_LANGUAGE_CONFIG[language]?.color || "#6B7280"
}

function getLanguageLabel(language: ScriptLanguage): string {
  return SCRIPT_LANGUAGE_CONFIG[language]?.label || language
}

function formatLastRun(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}
</script>

<style lang="scss" scoped>
@use "@/variables.scss" as *;

.script-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  &__filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $spacing-2;
    padding: $spacing-2;

    .si-input {
      grid-column: 1 / -1;
    }
  }

  &__groups {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    padding: 0 $spacing-2 $spacing-2;
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__group-header {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: $spacing-2 $spacing-3;
    border-left: 3px solid transparent;
    background: var(--b3-theme-surface-lighter, rgba(0, 0, 0, 0.03));
    border-radius: $radius-sm;
  }

  &__group-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    flex: 1;
  }

  &__cards {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__card {
    cursor: pointer;

    &:hover {
      border-color: var(--b3-theme-primary, $brand-primary);

      .script-list__card-actions {
        opacity: 1;
      }
    }
  }

  &__card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
    width: 100%;
  }

  &__card-name {
    font-weight: 600;
    font-size: $font-size-sm;
    color: var(--b3-theme-on-background, $brand-dark);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__card-body {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
  }

  &__card-desc {
    font-size: $font-size-xs;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    opacity: 0.45;
    margin: 0;
  }

  &__card-path {
    font-size: 10px;
    font-family: "JetBrains Mono", "Consolas", monospace;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    opacity: 0.5;
    margin: 2px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__card-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $spacing-1;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &__btn-run {
    background: rgba(16, 185, 129, 0.15) !important;
    color: #10b981 !important;
    border: 1px solid rgba(16, 185, 129, 0.3) !important;

    &:hover {
      background: rgba(16, 185, 129, 0.25) !important;
    }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-3;
    padding: $spacing-8 $spacing-4;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    text-align: center;
  }
}
</style>
