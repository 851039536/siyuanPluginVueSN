<!-- IDE 管理配置弹窗（表单状态自包含，通过 camelCase 回调提交增删改） -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-dialog--ide">
      <div class="gp-dialog-header">
        <!-- 弹窗标题："管理自定义 IDE" -->
        <span class="gp-dialog-title">{{ i18n.manageCustomIde }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <!-- 自定义 IDE 列表（行内编辑） -->
        <div
          v-if="customIdes.length > 0"
          class="gp-ide-mgmt-list"
        >
          <div
            v-for="(custom, idx) in customIdes"
            :key="idx"
            class="gp-ide-mgmt-row"
          >
            <template v-if="editingIdeIdx === idx">
              <Select
                v-model="editIdePreset"
                size="xsmall"
                class="gp-ide-preset-select"
                :options="presetSelectOptions"
              />
              <!-- 输入框占位："可执行文件路径" -->
              <Input
                v-model="editIdePath"
                size="xsmall"
                :placeholder="i18n.exePathPlaceholder"
                class="gp-grow"
                @keydown.enter="submitEdit(idx)"
                @keydown.escape.stop="editingIdeIdx = -1"
              />
              <!-- 按钮："保存" -->
              <button
                class="vp-btn vp-btn--primary vp-btn--sm"
                :disabled="!editIdePath.trim()"
                @click="submitEdit(idx)"
              >
                {{ i18n.save }}
              </button>
              <!-- 按钮："取消" -->
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                @click="editingIdeIdx = -1"
              >
                {{ i18n.cancel }}
              </button>
            </template>
            <template v-else>
              <Icon
                :icon="getIdePresetIcon(custom.name)"
                height="12"
              />
              <span class="gp-ide-mgmt-name">{{ custom.name }}</span>
              <span
                class="gp-ide-mgmt-path"
                :title="custom.path"
              >{{ custom.path }}</span>
              <!-- 按钮："编辑" -->
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                @click="startEdit(idx, custom.name, custom.path)"
              >
                {{ i18n.edit }}
              </button>
              <!-- 按钮："删除"（再点一次显示"确认?"） -->
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                @click="confirmDelete(idx)"
              >
                {{ confirmingDelIdx === idx ? i18n.confirmShort : i18n.delete }}
              </button>
            </template>
          </div>
        </div>
        <!-- 空态提示："暂无自定义 IDE，在下方添加" -->
        <div
          v-else
          class="gp-ide-mgmt-empty"
        >
          {{ i18n.noCustomIde }}
        </div>
        <div class="gp-ide-divider" />
        <!-- 添加行：预设下拉 + 路径输入 + 添加按钮 -->
        <div class="gp-ide-mgmt-add">
          <Select
            v-model="addIdePreset"
            size="xsmall"
            class="gp-ide-preset-select"
            :options="presetSelectOptions"
          />
          <!-- 输入框占位："可执行文件路径（如 D:/Tools/devenv.exe）" -->
          <Input
            v-model="addIdePath"
            size="xsmall"
            :placeholder="i18n.exePathExample"
            class="gp-grow"
            @keydown.enter="submitAdd"
          />
          <!-- 按钮："添加" -->
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!addIdePath.trim()"
            @click="submitAdd"
          >
            {{ i18n.add }}
          </button>
        </div>
      </div>
      <!-- 底部操作栏 -->
      <div class="gp-dialog-footer">
        <!-- 按钮："关闭" -->
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          {{ i18n.close }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import Input from "@/components/Input.vue"
import type { SelectOption } from "@/components/Select.vue"
import Select from "@/components/Select.vue"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import { getIdePresetIcon, IDE_PRESETS, OTHER_IDE_NAME } from "../../composables/useIdeManagement"

const props = defineProps<{
  i18n: Record<string, any>
  customIdes: { name: string, path: string }[]
  /** 操作回调（camelCase 事件绑定，数据由弹窗自包含提交，父组件不持有表单状态） */
  onAdd: (name: string, path: string) => void
  onSaveEdit: (idx: number, name: string, path: string) => void
  onDelete: (idx: number) => void
}>()

defineEmits<{
  close: []
}>()

const { rootRef } = useDialogKeyboard()

const presetSelectOptions = computed<SelectOption[]>(() =>
  IDE_PRESETS.map((p) => ({ value: p.name, label: p.name })),
)

// ── 表单状态（自包含，父组件不感知） ──
const addIdePreset = ref(IDE_PRESETS[0].name)
const addIdePath = ref("")
const editingIdeIdx = ref(-1)
const editIdePreset = ref("")
const editIdePath = ref("")
const confirmingDelIdx = ref(-1)

function submitAdd() {
  if (!addIdePath.value.trim()) return
  props.onAdd(addIdePreset.value, addIdePath.value.trim())
  addIdePath.value = ""
}

function submitEdit(idx: number) {
  if (!editIdePath.value.trim()) return
  props.onSaveEdit(idx, editIdePreset.value, editIdePath.value)
  editingIdeIdx.value = -1
}

function startEdit(idx: number, name: string, path: string) {
  editingIdeIdx.value = idx
  editIdePreset.value = IDE_PRESETS.some((p) => p.name === name) ? name : OTHER_IDE_NAME
  editIdePath.value = path
  confirmingDelIdx.value = -1
}

/** 两段式删除：首次点击进入确认态，再次点击执行删除 */
function confirmDelete(idx: number) {
  if (confirmingDelIdx.value === idx) {
    props.onDelete(idx)
    confirmingDelIdx.value = -1
  } else {
    confirmingDelIdx.value = idx
  }
}
</script>
