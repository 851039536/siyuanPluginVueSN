<!-- 密码箱添加/编辑条目弹窗 — 自包含，直接调用数据层 composable 完成持久化 -->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="password-vault-overlay modal-overlay"
        @click="$emit('close')"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="password-vault-dialog small"
            @click.stop
          >
            <div class="dialog-header">
              <h2>{{ editingEntry ? '编辑密码' : '添加密码' }}</h2>
              <Button
                icon="close"
                variant="ghost"
                size="xsmall"
                @click="$emit('close')"
              />
            </div>

            <div class="dialog-body">
              <form
                class="entry-form"
                @submit.prevent="save"
              >
                <div class="form-group">
                  <Select
                    v-model="form.category"
                    label="类别"
                    :options="categories.map(cat => ({
                      value: cat.id,
                      label: cat.name,
                    }))"
                    size="xsmall"
                    required
                  />
                </div>

                <div class="form-group">
                  <Input
                    v-model="form.name"
                    label="名称"
                    type="text"
                    size="xsmall"
                    placeholder="请输入名称（如：Google、GitHub等）"
                    required
                  />
                </div>

                <div class="form-group">
                  <Input
                    v-model="form.account"
                    label="账号"
                    type="text"
                    size="xsmall"
                    placeholder="请输入账号"
                    required
                  />
                </div>

                <div class="form-group">
                  <Input
                    v-model="form.password"
                    label="密码"
                    :type="showFormPassword ? 'text' : 'password'"
                    size="xsmall"
                    placeholder="请输入密码"
                    :show-password="true"
                    required
                  />
                </div>

                <div class="form-group">
                  <Input
                    v-model="form.description"
                    type="textarea"
                    label="描述"
                    size="xsmall"
                    placeholder="请输入描述信息"
                    :rows="3"
                  />
                </div>

                <div class="form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    @click="$emit('close')"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                  >
                    保存
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { PasswordEntry } from "../types"
import type { EntryFormData } from "../composables/usePasswordVaultData"
import type { PendingEntryData } from "../utils/parser"
import {
  onMounted,
  reactive,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { usePasswordVaultData } from "../composables/usePasswordVaultData"

interface Props {
  visible: boolean
  /** 编辑目标条目；为空表示新增 */
  editingEntry?: PasswordEntry | null
  /** 新增时的预填数据（来自浮动工具栏"存密码"） */
  prefill?: PendingEntryData | null
}

const props = withDefaults(defineProps<Props>(), {
  editingEntry: null,
  prefill: null,
})

const emit = defineEmits<{
  (e: "saved"): void
  (e: "close"): void
}>()

const {
  categories,
  upsertEntry,
} = usePasswordVaultData()

const showFormPassword = ref(false)
const form = reactive<EntryFormData>({
  category: "",
  name: "",
  account: "",
  password: "",
  description: "",
})

// 挂载时根据 editingEntry / prefill 初始化表单（弹窗由父层 v-if 控制，每次打开都会重新挂载）
onMounted(() => {
  showFormPassword.value = false
  const source = props.editingEntry ?? props.prefill
  form.category = props.editingEntry?.category ?? categories.value[0]?.id ?? ""
  form.name = source?.name ?? ""
  form.account = source?.account ?? ""
  form.password = source?.password ?? ""
  form.description = source?.description ?? ""
})

const save = async () => {
  try {
    await upsertEntry({ ...form }, props.editingEntry?.id)
    emit("saved")
  } catch (error) {
    console.error("Failed to save entry:", error)
  }
}
</script>

<style lang="scss" scoped>
@use '../styles/EntryFormModal.scss';
@use '../styles/index.scss';
</style>
