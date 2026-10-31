<!-- 添加 Git 项目弹窗（多设备路径录入，自行调用目录选择器） -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog">
      <!-- 弹窗头部 -->
      <div class="gp-dialog-header">
        <!-- 弹窗标题："添加" -->
        <span class="gp-dialog-title">{{ i18n.addProject }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <!-- 项目名称输入："项目名称" / "输入项目名称..." -->
        <Input
          v-model="name"
          :label="i18n.projectName"
          size="xsmall"
          :placeholder="i18n.namePlaceholder"
          @keydown="$event.key === 'Enter' && submit()"
        />
        <!-- 多设备路径行（与编辑弹窗共用 PathRowsEditor） -->
        <div class="gp-form-group">
          <!-- 标签："项目路径（跨设备适配）" -->
          <label class="gp-label">{{ i18n.projectPath }} <span class="gp-label-hint">{{ i18n.crossDeviceHint }}</span></label>
          <PathRowsEditor
            :rows="rows"
            :i18n="i18n"
            @add="addRow"
            @remove="removeRow"
            @pick="pickRow"
            @submit="submit"
          />
        </div>
        <!-- 分类下拉："分类" -->
        <Select
          v-model="catId"
          :label="i18n.category"
          size="xsmall"
          :options="categoryOptions"
        />
      </div>
      <!-- 底部操作栏 -->
      <div class="gp-dialog-footer">
        <!-- 按钮："取消" -->
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          {{ i18n.cancel }}
        </button>
        <!-- 按钮："添加"（名称与至少一条有效路径齐备才可用） -->
        <button
          class="vp-btn vp-btn--primary"
          :disabled="!name.trim() || !hasValidPath"
          @click="submit"
        >
          {{ i18n.add }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectPathExtras } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import Input from "@/components/Input.vue"
import type { SelectOption } from "@/components/Select.vue"
import Select from "@/components/Select.vue"
import { UNGROUPED_ID } from "../../types"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import { usePathRows } from "../../composables/usePathRows"
import PathRowsEditor from "./PathRowsEditor.vue"

const props = defineProps<{
  i18n: Record<string, any>
  categories: { id: string, name: string }[]
}>()

const categoryOptions = computed<SelectOption[]>(() =>
  props.categories.map((c) => ({ value: c.id, label: c.name })),
)

const emit = defineEmits<{
  "close": []
  "add": [data: ProjectPathExtras & { name: string, path: string, catId: string }]
}>()

// 弹窗打开时自动聚焦遮罩，使 Esc 关闭生效
// ⚠️ `rootRef` 必须保留为本地绑定：模板 `ref="rootRef"` 依赖它把根节点交给 composable 聚焦。
// TS 看不到「模板里的使用」，故以 void 显式消费，避免 noUnusedLocals 误判（下同各弹窗）。
const { rootRef } = useDialogKeyboard()
void rootRef

const name = ref("")
const catId = ref(UNGROUPED_ID)

// 多设备路径行（初始一行，设备名预填当前电脑名）
const { rows, initEmpty, addRow, removeRow, pickRow, hasValidPath, toPayload } = usePathRows(
  () => props.i18n.selectProjectDirTitle,
)
initEmpty()

function submit() {
  const payload = toPayload()
  if (!name.value.trim() || !payload) { return }
  emit("add", {
    name: name.value.trim(),
    ...payload,
    catId: catId.value,
  })
}
</script>
