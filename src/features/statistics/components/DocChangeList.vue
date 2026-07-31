<!-- 单日文档变更列表：新增/修改/删除三分组 + 加载/空状态 -->
<template>
  <div
    v-if="loading"
    class="changed-docs-loading"
  >
    <!-- 加载提示："加载中..." -->
    {{ i18n.loading }}
  </div>

  <div
    v-else-if="hasChanges"
    class="changed-docs-content"
  >
    <!-- 三分组统一由 groups 配置数组驱动（新增/修改可点击打开，删除只读） -->
    <div
      v-for="group in groups"
      :key="group.key"
      class="changed-docs-group"
    >
      <div class="changed-docs-group-title">
        <IconWrapper
          :name="group.titleIcon"
          :size="12"
        />
        <!-- 分组标题："新增/修改/删除（N）" -->
        {{ group.title }}（{{ group.docs.length }}）
      </div>
      <div
        v-for="(doc, idx) in group.docs"
        :key="group.clickable ? (doc as ChangedDoc).id : `${group.key}-${doc.title}-${doc.time ?? ''}-${idx}`"
        class="changed-doc-item"
        :class="group.itemClass"
        :title="group.clickable ? i18n.openDocHint : undefined"
        @click="group.clickable && openDocById((doc as ChangedDoc).id)"
      >
        <span class="changed-doc-icon">
          <IconWrapper
            :name="group.itemIcon"
            :size="11"
          />
        </span>
        <!-- 文档标题（空标题显示"无标题"） -->
        <span class="changed-doc-title">{{ doc.title || i18n.untitled }}</span>
        <span
          v-if="doc.time"
          class="changed-doc-time"
        >{{ doc.time }}</span>
      </div>
    </div>
  </div>
  <div
    v-else
    class="changed-docs-empty"
  >
    <!-- 空状态："当天无新增或修改" -->
    {{ i18n.noDocChanges }}
  </div>
</template>

<script setup lang="ts">
import type {
  ChangedDoc,
  DeletedDoc,
} from "../types"
import type { IconKey } from "@/config/icons"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { openDocById } from "../utils"

interface Props {
  changedDocs?: { newDocs: ChangedDoc[], modifiedDocs: ChangedDoc[] }
  deletedDocs?: DeletedDoc[]
  loading?: boolean
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  changedDocs: () => ({
    newDocs: [],
    modifiedDocs: [],
  }),
  deletedDocs: () => [],
  loading: false,
  i18n: () => ({}),
})

interface Group {
  key: string
  title: string
  titleIcon: IconKey
  itemIcon: IconKey
  itemClass: string
  clickable: boolean
  docs: Array<ChangedDoc | DeletedDoc>
}

// 三分组元数据 + 数据，仅保留非空分组供模板遍历
const groups = computed<Group[]>(() => {
  const list: Group[] = [
    {
      key: "new",
      title: props.i18n.todayCreated,
      titleIcon: "success",
      itemIcon: "plus",
      itemClass: "new",
      clickable: true,
      docs: props.changedDocs.newDocs,
    },
    {
      key: "modified",
      title: props.i18n.todayModified,
      titleIcon: "edit",
      itemIcon: "edit",
      itemClass: "modified",
      clickable: true,
      docs: props.changedDocs.modifiedDocs,
    },
    {
      key: "deleted",
      title: props.i18n.deletedTitle,
      titleIcon: "delete",
      itemIcon: "delete",
      itemClass: "deleted",
      clickable: false,
      docs: props.deletedDocs,
    },
  ]
  return list.filter((g) => g.docs.length > 0)
})

const hasChanges = computed(() => groups.value.length > 0)
</script>

<style lang="scss" scoped>
@use '../styles/DocChangeSection.scss';
@use '../styles/index.scss' as stats;
</style>
