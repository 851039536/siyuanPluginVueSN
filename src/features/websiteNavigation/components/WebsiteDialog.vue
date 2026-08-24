<!--
  网站导航 — 添加/编辑弹窗
-->
<template>
  <Teleport to="body">
    <Transition name="website-fade">
      <div
        v-if="visible"
        class="website-dialog-overlay"
        @click.self="handleClose"
      >
        <Transition name="website-scale">
          <div
            v-if="visible"
            class="website-dialog"
            @click.stop
          >
            <div class="dialog-header">
              <!-- 弹窗标题：添加网站/编辑网站 -->
              <h3>{{ isEdit ? i18n.editWebsite : i18n.addWebsite }}</h3>
              <Button
                icon="close"
                variant="ghost"
                size="xsmall"
                @click="handleClose"
              />
            </div>
            <div class="dialog-body">
              <div class="form-group">
                <!-- 名称 -->
                <label>{{ i18n.name }}</label>
                <Input
                  v-model="form.name"
                  type="text"
                  :placeholder="i18n.namePlaceholder"
                  required
                />
              </div>
              <div class="form-group">
                <!-- 网址 -->
                <label>{{ i18n.url }}</label>
                <Input
                  v-model="form.url"
                  type="text"
                  :placeholder="i18n.urlPlaceholder"
                  required
                />
              </div>
              <div class="form-group">
                <!-- 类别 -->
                <label>{{ i18n.category }}</label>
                <Select
                  v-model="form.category"
                  :options="categoryOptions"
                />
              </div>
              <div class="form-group">
                <!-- 描述 -->
                <label>{{ i18n.description }}</label>
                <Input
                  v-model="form.description"
                  type="text"
                  :placeholder="i18n.descriptionPlaceholder"
                />
              </div>
            </div>
            <div class="dialog-footer">
              <!-- 取消 -->
              <Button
                variant="ghost"
                @click="handleClose"
              >
                {{ i18n.cancel }}
              </Button>
              <!-- 保存 -->
              <Button
                variant="primary"
                :disabled="!form.name.trim() || !form.url.trim()"
                :loading="saving"
                @click="handleSave"
              >
                {{ i18n.save }}
              </Button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { I18n } from "../types"
import type {
  CreateWebsiteDTO,
  WebsiteEntry,
} from "@/utils/sharedStorage/websiteStorage"
import { DEFAULT_CATEGORY_ID } from "@/utils/sharedStorage/websiteStorage"
import {
  computed,
  reactive,
  ref,
  watch,
} from "vue"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import {
  categories,
  createEntry,
  entries,
  updateEntry,
} from "../composables/useWebsiteNavigation"

const props = defineProps<{
  visible: boolean
  i18n: I18n
  entryId: string | null
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "saved"): void
}>()

const isEdit = computed(() => !!props.entryId)
const saving = ref(false)

const currentEntry = computed<WebsiteEntry | null>(() =>
  props.entryId ? entries.value.find((e) => e.id === props.entryId) ?? null : null,
)

const initForm = (): CreateWebsiteDTO => ({
  name: currentEntry.value?.name || "",
  url: currentEntry.value?.url || "",
  category: currentEntry.value?.category || DEFAULT_CATEGORY_ID,
  description: currentEntry.value?.description || "",
})

const form = reactive<CreateWebsiteDTO>(initForm())

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      Object.assign(form, initForm())
    }
  },
)

const categoryOptions = computed(() =>
  categories.value.map((c) => ({
    value: c.id,
    label: c.name,
  })),
)

const handleSave = async () => {
  if (!form.name.trim() || !form.url.trim() || saving.value) return

  saving.value = true
  try {
    if (props.entryId) {
      const ok = await updateEntry(props.entryId, form)
      if (!ok) {
        showMessage(props.i18n.saveFailed ?? "", 3000, "error")
        return
      }
      showMessage(props.i18n.updateSuccess ?? "", 2000, "info")
    } else {
      await createEntry(form)
      showMessage(props.i18n.createSuccess ?? "", 2000, "info")
    }
    emit("saved")
  } catch {
    showMessage(props.i18n.saveFailed ?? "", 3000, "error")
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  if (saving.value) return
  emit("close")
}
</script>
