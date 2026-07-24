<!-- 密码箱修改主密码弹窗 — 自包含，校验后直接调用认证层 composable 重新加密 -->
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
              <h2>修改主密码</h2>
              <Button
                icon="close"
                variant="ghost"
                size="xsmall"
                @click="$emit('close')"
              />
            </div>

            <div class="dialog-body">
              <form
                class="change-password-form"
                @submit.prevent="submit"
              >
                <Input
                  v-model="oldPassword"
                  label="当前密码"
                  type="password"
                  size="xsmall"
                  placeholder="请输入当前密码"
                  :show-password="true"
                  required
                />

                <Input
                  v-model="newPassword"
                  label="新密码"
                  type="password"
                  size="xsmall"
                  placeholder="请输入新密码"
                  :show-password="true"
                  :minlength="6"
                  required
                />

                <Input
                  v-model="confirmPassword"
                  label="确认新密码"
                  type="password"
                  size="xsmall"
                  placeholder="请再次输入新密码"
                  :show-password="true"
                  :minlength="6"
                  required
                />

                <div
                  v-if="errorMessage"
                  class="error-message"
                >
                  <IconWrapper
                    name="error"
                    :size="16"
                  />
                  {{ errorMessage }}
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
                    :disabled="!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()"
                  >
                    确认修改
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
import { showMessage } from "siyuan"
import {
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { usePasswordVaultAuth } from "../composables/usePasswordVaultAuth"

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const { changePassword } = usePasswordVaultAuth()

const oldPassword = ref("")
const newPassword = ref("")
const confirmPassword = ref("")
const errorMessage = ref("")

// 打开/关闭时重置内部状态
watch(
  () => props.visible,
  () => {
    oldPassword.value = ""
    newPassword.value = ""
    confirmPassword.value = ""
    errorMessage.value = ""
  },
)

const submit = async () => {
  errorMessage.value = ""

  if (!oldPassword.value.trim() || !newPassword.value.trim() || !confirmPassword.value.trim()) {
    errorMessage.value = "请填写所有字段"
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = "两次输入的新密码不一致"
    return
  }
  if (newPassword.value.length < 6) {
    errorMessage.value = "新密码至少需要6个字符"
    return
  }
  if (oldPassword.value === newPassword.value) {
    errorMessage.value = "新密码不能与当前密码相同"
    return
  }

  try {
    const error = await changePassword(oldPassword.value, newPassword.value)
    if (error) {
      errorMessage.value = error
      return
    }
    showMessage("密码修改成功，请记住新密码", 3000, "info")
    emit("close")
  } catch (err) {
    console.error("Change password failed:", err)
    errorMessage.value = "密码修改失败，请重试"
  }
}
</script>

<style lang="scss" scoped>
@use '../styles/ChangePasswordModal.scss';
@use '../styles/index.scss';
</style>
