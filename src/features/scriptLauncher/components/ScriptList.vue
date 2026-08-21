<template>
  <div class="script-list">
    <div class="script-list__filters">
      <Select
        v-model="selectedLanguage"
        :options="languageOptions"
        size="xsmall"
        :placeholder="i18n.selectLanguage"
      />
      <Select
        v-model="selectedCategory"
        :options="categoryOptions"
        size="xsmall"
        :placeholder="i18n.selectCategory"
      />
      <Input
        v-model="localSearchQuery"
        type="search"
        size="xsmall"
        :placeholder="i18n.searchPlaceholder"
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
            size="xsmall"
          >{{ group.scripts.length }}</Badge>
        </div>

        <div class="script-list__cards">
          <Card
            v-for="script in group.scripts"
            :key="script.id"
            variant="bordered"
            size="xsmall"
            class="script-list__card"
          >
            <template #header>
              <div class="script-list__card-header">
                <span class="script-list__card-name">{{ script.name }}</span>
                <Badge
                  :color="getLanguageColor(script.language)"
                  size="xsmall"
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
                <span v-else>{{ i18n.neverRun }}</span>
              </p>
              <p class="script-list__card-path">
                data/storage/sc/{{ script.fileName }}
              </p>
            </div>

            <template #footer>
              <div class="script-list__card-actions">
                <Button
                  variant="success"
                  size="xsmall"
                  icon="play"
                  class="script-list__btn-run"
                  :title="i18n.runScript"
                  @click="emit('run', script)"
                />
                <Button
                  variant="secondary"
                  size="xsmall"
                  icon="edit"
                  :title="i18n.editScript"
                  @click="emit('edit', script)"
                />
                <Button
                  variant="danger"
                  size="xsmall"
                  icon="delete"
                  :title="i18n.deleteScript"
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
      <p>{{ i18n.noScripts }}</p>
      <Button
        variant="primary"
        icon="add"
        @click="emit('add')"
      >
        {{ i18n.addScript }}
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
import type { SelectOption } from "@/components/Select.vue"
import { SCRIPT_LANGUAGE_CONFIG } from "../types"

interface Props {
  scripts: Script[]
  i18n: I18n
}

const props = defineProps<Props>()

const emit = defineEmits<{
  delete: [script: Script]
  add: []
  edit: [script: Script]
  run: [script: Script]
}>()

const selectedLanguage = ref("all")
const selectedCategory = ref("all")
const localSearchQuery = ref("")

const languageOptions = computed<SelectOption[]>(() => [
  {
    value: "all",
    label: props.i18n.allLanguages ?? "",
  },
  ...Object.entries(SCRIPT_LANGUAGE_CONFIG).map(([key, cfg]) => ({
    value: key,
    label: cfg.label,
  })),
])

const categoryOptions = computed<SelectOption[]>(() => {
  const categories = new Set(props.scripts.map((s) => s.category))
  return [
    {
      value: "all",
      label: props.i18n.allCategories ?? "",
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
  // SCRIPT_LANGUAGE_CONFIG 覆盖全部语言，color 必存在，无需兜底
  return SCRIPT_LANGUAGE_CONFIG[language].color
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
@use "../styles/ScriptList.scss";
</style>
