<!--
  网站导航 — 添加/编辑弹窗
-->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="website-dialog-overlay"
        @click.self="handleClose"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="website-dialog"
            @click.stop
          >
            <div class="dialog-header">
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
                <label>{{ i18n.name }}</label>
                <Input
                  v-model="form.name"
                  type="text"
                  :placeholder="i18n.namePlaceholder"
                  required
                />
              </div>
              <div class="form-group">
                <label>{{ i18n.url }}</label>
                <Input
                  v-model="form.url"
                  type="text"
                  :placeholder="i18n.urlPlaceholder"
                  required
                />
              </div>
              <div class="form-group">
                <label>{{ i18n.category }}</label>
                <Select
                  v-model="form.category"
                  :options="categoryOptions"
                />
              </div>
              <div class="form-group">
                <label>{{ i18n.description }}</label>
                <Input
                  v-model="form.description"
                  type="text"
                  :placeholder="i18n.descriptionPlaceholder"
                />
              </div>
            </div>
            <div class="dialog-footer">
              <Button
                variant="ghost"
                @click="handleClose"
              >
                {{ i18n.cancel }}
              </Button>
              <Button
                variant="primary"
                :disabled="!form.name.trim() || !form.url.trim()"
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
import type {
  I18n,
  WebsiteCategory,
  WebsiteEntry,
} from "../types"
import {
  computed,
  reactive,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

const props = defineProps<{
  visible: boolean
  i18n: I18n
  categories: WebsiteCategory[]
  editingEntry: WebsiteEntry | null
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "save", data: { name: string, url: string, category: string, description: string }): void
}>()

const isEdit = computed(() => !!props.editingEntry)

const initForm = () => ({
  name: props.editingEntry?.name || "",
  url: props.editingEntry?.url || "",
  category: props.editingEntry?.category || "default",
  description: props.editingEntry?.description || "",
})

const form = reactive(initForm())

watch(
  () => props.editingEntry,
  () => Object.assign(form, initForm()),
)

const categoryOptions = computed(() =>
  props.categories.map((c) => ({
    value: c.id,
    label: c.name,
  })),
)

const handleSave = () => {
  if (!form.name.trim() || !form.url.trim()) return
  emit("save", { ...form })
}

const handleClose = () => {
  emit("close")
}
</script>
