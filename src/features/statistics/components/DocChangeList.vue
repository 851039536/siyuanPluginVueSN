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
    v-else-if="changedDocs.newDocs.length > 0 || changedDocs.modifiedDocs.length > 0 || deletedDocs.length > 0"
    class="changed-docs-content"
  >
    <div
      v-if="changedDocs.newDocs.length > 0"
      class="changed-docs-group"
    >
      <div class="changed-docs-group-title">
        <IconWrapper
          name="success"
          :size="12"
        />
        <!-- 分组标题："新增（N）" -->
        {{ i18n.todayCreated }}（{{ changedDocs.newDocs.length }}）
      </div>
      <div
        v-for="doc in changedDocs.newDocs"
        :key="doc.id"
        class="changed-doc-item new"
        :title="i18n.openDocHint"
        @click="openDoc(doc.id)"
      >
        <span class="changed-doc-icon">
          <IconWrapper
            name="plus"
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
    <div
      v-if="changedDocs.modifiedDocs.length > 0"
      class="changed-docs-group"
    >
      <div class="changed-docs-group-title">
        <IconWrapper
          name="edit"
          :size="12"
        />
        <!-- 分组标题："修改（N）" -->
        {{ i18n.todayModified }}（{{ changedDocs.modifiedDocs.length }}）
      </div>
      <div
        v-for="doc in changedDocs.modifiedDocs"
        :key="doc.id"
        class="changed-doc-item modified"
        :title="i18n.openDocHint"
        @click="openDoc(doc.id)"
      >
        <span class="changed-doc-icon">
          <IconWrapper
            name="edit"
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
    <div
      v-if="deletedDocs.length > 0"
      class="changed-docs-group"
    >
      <div class="changed-docs-group-title">
        <IconWrapper
          name="delete"
          :size="12"
        />
        <!-- 分组标题："删除（N）" -->
        {{ i18n.deletedTitle }}（{{ deletedDocs.length }}）
      </div>
      <div
        v-for="(doc, idx) in deletedDocs"
        :key="idx"
        class="changed-doc-item deleted"
      >
        <span class="changed-doc-icon">
          <IconWrapper
            name="delete"
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
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  changedDocs?: { newDocs: ChangedDoc[], modifiedDocs: ChangedDoc[] }
  deletedDocs?: DeletedDoc[]
  loading?: boolean
  i18n?: Record<string, any>
}

withDefaults(defineProps<Props>(), {
  changedDocs: () => ({
    newDocs: [],
    modifiedDocs: [],
  }),
  deletedDocs: () => [],
  loading: false,
  i18n: () => ({}),
})

function openDoc(docId: string) {
  if (docId) {
    window.open(`siyuan://blocks/${docId}`)
  }
}
</script>

<style lang="scss" scoped>
@use '../styles/DocChangeSection.scss';
@use '../styles/index.scss' as stats;
</style>
