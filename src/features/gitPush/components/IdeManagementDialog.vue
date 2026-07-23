<!-- IDE 管理配置弹窗 -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div
      class="gp-dialog"
      style="width: 460px;"
    >
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">{{ i18n.manageCustomIde || '管理自定义 IDE' }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
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
                style="width:150px"
                :options="presetSelectOptions"
              />
              <Input
                v-model="editIdePath"
                size="xsmall"
                :placeholder="i18n.exePathPlaceholder || '可执行文件路径'"
                style="flex:1"
                @keydown="$event.key === 'Enter' && $emit('save-edit-ide', idx, editIdePreset, editIdePath)"
                @keydown.escape.stop="editingIdeIdx = -1"
              />
              <button
                class="vp-btn vp-btn--primary vp-btn--sm"
                :disabled="!editIdePath.trim()"
                @click="$emit('save-edit-ide', idx, editIdePreset, editIdePath)"
              >
                {{ i18n.save || '保存' }}
              </button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                @click="editingIdeIdx = -1"
              >
                {{ i18n.cancel || '取消' }}
              </button>
            </template>
            <template v-else>
              <Icon
                :icon="getIcon(custom.name)"
                height="12"
              />
              <span class="gp-ide-mgmt-name">{{ custom.name }}</span>
              <span
                class="gp-ide-mgmt-path"
                :title="custom.path"
              >{{ custom.path }}</span>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                @click="startEdit(idx, custom.name, custom.path)"
              >
                {{ i18n.edit || '编辑' }}
              </button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                @click="confirmDelete(idx)"
              >
                {{ confirmingMgmtDelIdx === idx ? (i18n.confirmShort || '确认?') : (i18n.delete || '删除') }}
              </button>
            </template>
          </div>
        </div>
        <div
          v-else
          class="gp-ide-mgmt-empty"
        >
          {{ i18n.noCustomIde || '暂无自定义 IDE，在下方添加' }}
        </div>
        <div
          class="gp-ide-divider"
          style="margin:8px 0"
        />
        <div class="gp-ide-mgmt-add">
          <Select
            v-model="addIdePreset"
            size="xsmall"
            style="width:150px"
            :options="presetSelectOptions"
          />
          <Input
            v-model="addIdePath"
            size="xsmall"
            :placeholder="i18n.exePathExample || '可执行文件路径（如 D:/Tools/devenv.exe）'"
            style="flex:1"
            @keydown="$event.key === 'Enter' && addIde()"
          />
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!addIdePath.trim()"
            @click="addIde"
          >
            {{ i18n.add || '添加' }}
          </button>
        </div>
      </div>
      <div class="gp-dialog-footer">
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          {{ i18n.close || '关闭' }}
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
import { useDialogKeyboard } from "../composables/useDialogKeyboard"

const props = defineProps<{
  i18n: Record<string, any>
  customIdes: { name: string, path: string }[]
  presetOptions: { name: string, icon: string }[]
  getIcon: (name: string) => string
}>()

const presetSelectOptions = computed<SelectOption[]>(() =>
  props.presetOptions.map((p) => ({ value: p.name, label: p.name })),
)

const emit = defineEmits<{
  "close": []
  "add-ide": [preset: string, path: string]
  "save-edit-ide": [idx: number, preset: string, path: string]
  "delete-ide": [idx: number]
}>()

const { rootRef } = useDialogKeyboard()

const addIdePreset = ref("Visual Studio")
const addIdePath = ref("")
const editingIdeIdx = ref(-1)
const editIdePreset = ref("")
const editIdePath = ref("")
const confirmingMgmtDelIdx = ref(-1)

function addIde() {
  emit("add-ide", addIdePreset.value, addIdePath.value.trim())
  addIdePath.value = ""
}

function startEdit(idx: number, name: string, path: string) {
  editingIdeIdx.value = idx
  editIdePreset.value = props.presetOptions.some((p) => p.name === name) ? name : "其他"
  editIdePath.value = path
}

function confirmDelete(idx: number) {
  if (confirmingMgmtDelIdx.value === idx) {
    emit("delete-ide", idx)
    confirmingMgmtDelIdx.value = -1
  } else {
    confirmingMgmtDelIdx.value = idx
  }
}
</script>
