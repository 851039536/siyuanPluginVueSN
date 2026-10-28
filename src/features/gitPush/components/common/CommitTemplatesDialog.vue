<!-- gitPush 提交模板管理弹窗（内联编辑名称/内容，保存整表；内容支持 {branch} / {files} 占位符） -->
<template>
  <Dialog
    :visible="true"
    :header="i18n.commitTemplatesTitle"
    size="medium"
    :close-label="i18n.close"
    @update:visible="emit('close')"
  >
    <div class="gp-tpl-dialog">
      <!-- 说明文案："内容支持 {branch}（当前分支）与 {files}（暂存文件数）" -->
      <p class="gp-tpl-hint">
        {{ i18n.templatePatternHint }}
      </p>
      <!-- 空态："暂无模板，点击下方按钮新增" -->
      <div
        v-if="rows.length === 0"
        class="gp-tpl-empty"
      >
        {{ i18n.templateEmpty }}
      </div>
      <!-- 模板行：名称 + 内容 + 删除 -->
      <div
        v-for="(row, i) in rows"
        :key="row.id"
        class="gp-tpl-row"
      >
        <Input
          v-model="row.name"
          size="xsmall"
          class="gp-tpl-name"
          :placeholder="i18n.templateName"
          :aria-label="i18n.templateName"
        />
        <Textarea
          v-model="row.pattern"
          size="xsmall"
          class="gp-tpl-pattern"
          :rows="2"
          :placeholder="i18n.templatePattern"
          :aria-label="i18n.templatePattern"
        />
        <Button
          variant="ghost"
          size="xsmall"
          dense
          severity="danger"
          icon="deleteOutline"
          :title="i18n.delete"
          @click="removeRow(i)"
        />
      </div>
      <!-- 新增按钮 -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="plus"
        @click="addRow"
      >
        {{ i18n.addTemplate }}
      </Button>
    </div>
    <template #footer>
      <Button
        variant="ghost"
        size="xsmall"
        dense
        @click="emit('close')"
      >
        {{ i18n.cancel }}
      </Button>
      <Button
        variant="primary"
        size="xsmall"
        dense
        :disabled="!canSave"
        @click="save"
      >
        {{ i18n.save }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
// gitPush 提交模板管理弹窗（自包含编辑态，保存时整表回传）
import type { CommitTemplate } from "../../types/storage"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Input from "@/components/Input.vue"
import Textarea from "@/components/Textarea.vue"

const props = defineProps<{
  i18n: Record<string, any>
  templates: CommitTemplate[]
}>()

const emit = defineEmits<{
  close: []
  saved: [templates: CommitTemplate[]]
}>()

/** 编辑副本（保存前不改动父级数据） */
const rows = ref<CommitTemplate[]>(props.templates.map((t) => ({ ...t })))

/**
 * 是否允许保存：禁止「只填了名称或只填了内容」的半成品行；
 * 完全空行在保存时会被丢弃（用户点「新增」后又放弃的常见路径）。
 */
const canSave = computed(() =>
  rows.value.every((r) => {
    const hasName = r.name.trim() !== ""
    const hasPattern = r.pattern.trim() !== ""
    return hasName === hasPattern
  }),
)

/** 新增空行（id 只需在当前会话内唯一） */
function addRow() {
  rows.value.push({
    id: `tpl-${Date.now()}-${rows.value.length}`,
    name: "",
    pattern: "",
  })
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

function save() {
  // ⚠️ 名称去空白，内容保留原样：`feat: ` 这类模板的尾部空格是内容的一部分
  const next = rows.value
    .filter((r) => r.name.trim() !== "" && r.pattern.trim() !== "")
    .map((r) => ({ ...r, name: r.name.trim() }))
  emit("saved", next)
}
</script>

<style lang="scss">
@use "../../styles/CommitTemplatesDialog.scss";
</style>
