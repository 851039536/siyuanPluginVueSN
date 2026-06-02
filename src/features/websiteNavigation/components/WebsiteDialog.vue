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
              <h3>{{ isEdit ? i18n.editWebsite || '编辑网站' : i18n.addWebsite || '添加网站' }}</h3>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="handleClose"
              />
            </div>
            <div class="dialog-body">
              <div class="form-group">
                <label>{{ i18n.name || '名称' }}</label>
                <Input
                  v-model="form.name"
                  type="text"
                  :placeholder="i18n.namePlaceholder || '网站名称'"
                  required
                />
              </div>
              <div class="form-group">
                <label>{{ i18n.url || '网址' }}</label>
                <Input
                  v-model="form.url"
                  type="text"
                  :placeholder="i18n.urlPlaceholder || 'https://example.com'"
                  required
                />
              </div>
              <div class="form-group">
                <label>{{ i18n.category || '类别' }}</label>
                <Select
                  v-model="form.category"
                  :options="categoryOptions"
                />
              </div>
              <div class="form-group">
                <label>{{ i18n.description || '描述' }}</label>
                <Input
                  v-model="form.description"
                  type="text"
                  :placeholder="i18n.descriptionPlaceholder || '备注描述'"
                />
              </div>
            </div>
            <div class="dialog-footer">
              <Button
                variant="ghost"
                @click="handleClose"
              >
                {{ i18n.cancel || '取消' }}
              </Button>
              <Button
                variant="primary"
                :disabled="!form.name.trim() || !form.url.trim()"
                @click="handleSave"
              >
                {{ i18n.save || '保存' }}
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
