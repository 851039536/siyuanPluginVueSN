<!-- IDE 管理配置弹窗 -->
<template>
  <div
    class="gp-mask"
    @click.self="$emit('close')"
  >
    <div
      class="gp-dialog"
      style="width: 460px;"
    >
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">管理自定义 IDE</span>
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
                size="small"
                style="width:150px"
                :options="presetSelectOptions"
              />
              <Input
                v-model="editIdePath"
                size="small"
                placeholder="可执行文件路径"
                style="flex:1"
                @keydown="$event.key === 'Enter' && $emit('save-edit-ide', idx, editIdePreset, editIdePath)"
                @keydown.escape="editingIdeIdx = -1"
              />
              <button
                class="vp-btn vp-btn--primary vp-btn--sm"
                :disabled="!editIdePath.trim()"
                @click="$emit('save-edit-ide', idx, editIdePreset, editIdePath)"
              >
                保存
              </button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                @click="editingIdeIdx = -1"
              >
                取消
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
                编辑
              </button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                @click="confirmDelete(idx)"
              >
                {{ confirmingMgmtDelIdx === idx ? '确认?' : '删除' }}
              </button>
            </template>
          </div>
        </div>
        <div
          v-else
          class="gp-ide-mgmt-empty"
        >
          暂无自定义 IDE，在下方添加
        </div>
        <div
          class="gp-ide-divider"
          style="margin:8px 0"
        />
        <div class="gp-ide-mgmt-add">
          <Select
            v-model="addIdePreset"
            size="small"
            style="width:150px"
            :options="presetSelectOptions"
          />
          <Input
            v-model="addIdePath"
            size="small"
            placeholder="可执行文件路径（如 D:/Tools/devenv.exe）"
            style="flex:1"
            @keydown="$event.key === 'Enter' && addIde()"
          />
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!addIdePath.trim()"
            @click="addIde"
          >
            添加
          </button>
        </div>
      </div>
      <div class="gp-dialog-footer">
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          关闭
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

const props = defineProps<{
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
