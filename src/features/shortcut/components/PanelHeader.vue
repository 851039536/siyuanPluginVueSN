<!-- 快捷键面板工具栏：搜索/分类/新增 + 筛选/计数/导入导出重置 -->
<template>
  <div class="shortcut-header">
    <!-- 行1：搜索 + 分类 + 新增 -->
    <Toolbar
      variant="borderless"
      size="xsmall"
      :padded="false"
      class="shortcut-header__row"
    >
      <template #start>
        <Input
          :model-value="searchKeyword"
          :placeholder="i18n.searchPlaceholder"
          prefix-icon="search"
          size="xsmall"
          class="shortcut-header__search"
          @update:model-value="onSearchChange"
        />
      </template>
      <template #center>
        <Select
          :model-value="activeCategory"
          :options="selectOptions"
          size="xsmall"
          class="shortcut-header__category"
          @update:model-value="onCategoryChange"
        />
      </template>
      <template #end>
        <Button
          variant="primary"
          size="xsmall"
          icon="add"
          :title="i18n.addCustomShortcut"
          @click="$emit('add')"
        />
      </template>
    </Toolbar>

    <!-- 行2：筛选 + 计数 + 数据操作 -->
    <Toolbar
      variant="borderless"
      size="xsmall"
      :padded="false"
      class="shortcut-header__row"
    >
      <template #start>
        <div class="shortcut-header__filters">
          <Button
            :variant="activeFilter === 'recent' ? 'primary' : 'ghost'"
            :outlined="activeFilter === 'recent'"
            size="xsmall"
            icon="timerOutline"
            :aria-pressed="activeFilter === 'recent'"
            @click="$emit('toggleFilter', 'recent')"
          >
            {{ i18n.filterRecent }}
          </Button>
          <Button
            :variant="activeFilter === 'conflict' ? 'primary' : 'ghost'"
            :outlined="activeFilter === 'conflict'"
            size="xsmall"
            icon="warning"
            :aria-pressed="activeFilter === 'conflict'"
            @click="$emit('toggleFilter', 'conflict')"
          >
            {{ i18n.scFilterConflict }}
            <Tag
              v-if="conflictCount > 0"
              variant="warning"
              size="xsmall"
              shape="circle"
            >
              {{ conflictCount }}
            </Tag>
          </Button>
        </div>
      </template>
      <template #center>
        <span class="shortcut-header__count">{{ visibleCount }} / {{ totalCount }}</span>
      </template>
      <template #end>
        <div class="shortcut-header__actions">
          <!-- 导入：复用共享文件选择（自建图标按钮，隐藏其文件列表区） -->
          <FileUpload
            ref="importRef"
            mode="basic"
            size="xsmall"
            accept=".json,application/json"
            :file-limit="1"
            class="shortcut-header__import"
            @select="handleImportSelect"
          >
            <template #header="{ chooseCallback }">
              <Button
                variant="ghost"
                size="xsmall"
                icon="upload"
                :title="i18n.scImport"
                @click="chooseCallback"
              />
            </template>
            <template #content><!-- 导入不使用文件列表区 --></template>
          </FileUpload>
          <Button
            variant="ghost"
            size="xsmall"
            icon="download"
            :title="i18n.scExport"
            @click="$emit('export')"
          />
          <Button
            variant="danger"
            size="xsmall"
            icon="refreshLeft"
            :title="i18n.scReset"
            @click="$emit('reset')"
          />
        </div>
      </template>
    </Toolbar>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import type { ShortcutFilterMode } from "../types"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import FileUpload from "@/components/FileUpload.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import Tag from "@/components/Tag.vue"
import Toolbar from "@/components/Toolbar.vue"

interface Props {
  searchKeyword: string
  activeCategory: string
  activeFilter: ShortcutFilterMode
  /** 分类标识列表（首项为 "all"） */
  categories: string[]
  getCategoryLabel: (category: string) => string
  getCategoryCount: (category: string) => number
  totalCount: number
  visibleCount: number
  conflictCount: number
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:searchKeyword": [value: string]
  "update:activeCategory": [value: string]
  add: []
  toggleFilter: [target: ShortcutFilterMode]
  import: [file: File]
  export: []
  reset: []
}>()

/** 导入用文件选择器的实例引用（选完即清空队列，允许重复选同一个文件） */
const importRef = ref<InstanceType<typeof FileUpload> | null>(null)

const onSearchChange = (value: string | number | null) => {
  emit("update:searchKeyword", String(value ?? ""))
}

const onCategoryChange = (value: string | number | boolean | null) => {
  emit("update:activeCategory", String(value ?? "all"))
}

const selectOptions = computed((): SelectOption[] =>
  props.categories.map((category) => ({
    value: category,
    label: `${props.getCategoryLabel(category)} (${props.getCategoryCount(category)})`,
  })),
)

function handleImportSelect(files: File[]): void {
  const file = files[0]
  if (file) {
    emit("import", file)
  }
  importRef.value?.clear()
}
</script>

<style scoped lang="scss">
@use "../styles/PanelHeader.scss";
</style>
