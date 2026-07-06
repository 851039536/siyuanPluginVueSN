<!-- 远程仓库配置弹窗 -->
<template>
  <div
    class="gp-mask"
    @click.self="$emit('close')"
  >
    <div
      class="gp-dialog"
      style="width: 420px;"
    >
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">仓库配置 — {{ project.name }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <div
          v-if="remotes.length"
          class="gp-remote-list"
        >
          <div
            v-for="r in remotes"
            :key="r.name"
            class="gp-remote-row"
          >
            <span class="gp-remote-name">{{ r.name }}</span>
            <template v-if="editingRemoteName === r.name">
              <Input
                v-model="editingRemoteUrl"
                size="xsmall"
                style="flex:1"
                @keydown="$event.key === 'Enter' && saveRemoteEdit(r.name)"
                @keydown.escape="editingRemoteName = ''"
              />
              <button
                class="vp-btn vp-btn--primary vp-btn--sm"
                :disabled="!editingRemoteUrl.trim()"
                @click="saveRemoteEdit(r.name)"
              >
                保存
              </button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                @click="editingRemoteName = ''"
              >
                取消
              </button>
            </template>
            <template v-else>
              <span
                class="gp-remote-url"
                :title="r.url"
              >{{ r.url }}</span>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                title="编辑此远程 URL"
                @click="startEdit(r.name, r.url)"
              >
                编辑
              </button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                title="删除此远程"
                @click="$emit('remove-remote', r.name)"
              >
                删除
              </button>
            </template>
          </div>
        </div>
        <div
          v-else
          class="gp-remote-empty"
        >
          暂无远程仓库
        </div>
        <div class="gp-remote-add">
          <Select
            v-model="newRemoteName"
            size="xsmall"
            style="width:130px"
            :options="remoteMetaOptions"
            placeholder="选择平台"
          />
          <Input
            v-model="newRemoteUrl"
            size="xsmall"
            placeholder="远程 URL"
            style="flex:1"
            @keydown="$event.key === 'Enter' && addRemote()"
          />
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!newRemoteName || !newRemoteUrl.trim()"
            @click="addRemote"
          >
            添加
          </button>
        </div>
        <div
          v-if="error"
          class="gp-error"
        >
          {{ error }}
        </div>
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
  project: { id: string, name: string, path: string }
  remotes: { name: string, url: string }[]
  remotesMeta: { key: string, label: string }[]
  error: string
}>()

const remoteMetaOptions = computed<SelectOption[]>(() =>
  props.remotesMeta.map((r) => ({ value: r.key, label: r.label })),
)

const emit = defineEmits<{
  "close": []
  "add-remote": [remoteName: string, url: string]
  "remove-remote": [name: string]
  "edit-remote": [name: string, url: string]
}>()

const newRemoteName = ref("github")
const newRemoteUrl = ref("")
const editingRemoteName = ref("")
const editingRemoteUrl = ref("")

function addRemote() {
  emit("add-remote", newRemoteName.value.trim(), newRemoteUrl.value.trim())
  newRemoteUrl.value = ""
}

function startEdit(name: string, url: string) {
  editingRemoteName.value = name
  editingRemoteUrl.value = url
}

function saveRemoteEdit(name: string) {
  emit("edit-remote", name, editingRemoteUrl.value)
  editingRemoteName.value = ""
}
</script>
