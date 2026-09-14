<!-- 添加/编辑快捷键对话框：共享 Dialog 承载，字段级校验；分组从现有分组下拉选择，可切换为新建 -->
<template>
  <Dialog
    :visible="visible"
    :header="title"
    size="small"
    :close-label="i18n.cancel"
    dismissable-mask
    class="shortcut-dialog"
    @update:visible="handleVisibleChange"
  >
    <div class="shortcut-dialog__body">
      <Input
        v-model="form.name"
        :label="i18n.shortcutName"
        :placeholder="i18n.enterName"
        :error="errors.name"
        size="small"
        @update:model-value="errors.name = ''"
      />
      <Input
        v-model="form.description"
        :label="i18n.description"
        :placeholder="i18n.enterDescription"
        size="small"
      />
      <!-- 内容：要复制的东西（快捷键 / 命令行 / 任意文本），形态由纯函数自动判定 -->
      <Input
        v-model="form.content"
        :label="i18n.scContent"
        :placeholder="i18n.scContentPlaceholder"
        :error="errors.content"
        required
        size="small"
        @update:model-value="errors.content = ''"
      />
      <!-- 快捷键：可选，留空即与内容相同 -->
      <Input
        v-model="form.keys"
        :label="i18n.scHotkey"
        :placeholder="i18n.scHotkeyPlaceholder"
        :hint="i18n.scHotkeyTip"
        size="small"
      />

      <!-- 分组：下拉选择现有分组；选「新建分组…」后切换为输入框 -->
      <Select
        v-if="!customGroupMode"
        :model-value="groupSelectValue"
        :options="groupSelectOptions"
        :label="i18n.group"
        :placeholder="i18n.enterGroup"
        filterable
        size="small"
        @update:model-value="handleGroupSelect"
      />
      <div
        v-else
        class="shortcut-dialog__group-custom"
      >
        <Input
          ref="newGroupInputRef"
          v-model="form.group"
          :label="i18n.group"
          :placeholder="i18n.enterGroup"
          :error="errors.group"
          size="small"
          class="shortcut-dialog__group-input"
          @update:model-value="errors.group = ''"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="chevronDown"
          :title="i18n.scPickFromList"
          @click="backToGroupList"
        />
      </div>
    </div>

    <template #footer>
      <Button
        variant="secondary"
        size="small"
        @click="$emit('close')"
      >
        {{ i18n.cancel }}
      </Button>
      <Button
        variant="primary"
        size="small"
        @click="handleConfirm"
      >
        {{ i18n.confirm }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import type {
  ShortcutFormData,
  ShortcutInfo,
} from "../types"
import {
  computed,
  nextTick,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { buildCustomShortcut } from "../utils"

/**
 * 「新建分组」哨兵值：仅在 Select 内部流转，不会写进表单数据
 * （前缀带双下划线，避免与真实分组名冲突）
 */
const NEW_GROUP_VALUE = "__new_group__"

interface Props {
  visible: boolean
  /** 编辑目标（为 null 表示新增，表单重置） */
  initial: ShortcutInfo | null
  /** 现有分组名（由视图层从当前数据派生，作为下拉选项来源） */
  groups?: string[]
  i18n: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  groups: () => [],
})

const emit = defineEmits<{
  close: []
  confirm: [shortcut: ShortcutInfo]
  error: [message: string]
}>()

const form = ref<ShortcutFormData>({
  id: "",
  name: "",
  description: "",
  content: "",
  keys: "",
  group: "",
})

const errors = ref({ name: "", content: "", group: "" })

/** 分组是否处于「新建」态（下拉 ⇄ 输入框） */
const customGroupMode = ref(false)
/** 新建分组输入框（切换后需要手动聚焦，否则用户敲键盘会落空） */
const newGroupInputRef = ref<InstanceType<typeof Input> | null>(null)
/** 分组下拉的受控值（与 form.group 分离：新建态下不指向任何选项） */
const groupSelectValue = ref("")

/** 默认分组：自定义项未指定分组时的落点 */
const defaultGroup = computed(() => props.i18n.customShortcuts || "")

/**
 * 分组下拉选项：默认分组 + 现有分组 + 当前值（去重升序），末尾追加「新建分组…」。
 * 带上默认分组与当前值是为了「首次使用（数据里还没有自定义组）」与
 * 「编辑一个用旧分组名的条目」两种情况下下拉都不会空白。
 */
const groupSelectOptions = computed((): SelectOption[] => {
  const names = new Set<string>()
  if (defaultGroup.value) names.add(defaultGroup.value)
  for (const name of props.groups) {
    if (name) names.add(name)
  }
  if (form.value.group) names.add(form.value.group)

  const options: SelectOption[] = Array.from(names)
    .sort()
    .map((name) => ({ value: name, label: name }))
  options.push({ value: NEW_GROUP_VALUE, label: props.i18n.scNewGroup })
  return options
})

const title = computed(() =>
  props.initial ? props.i18n.editShortcut : props.i18n.addCustomShortcut,
)

// initial 变化时同步表单（新增传 null 重置，编辑回填）
watch(
  () => props.initial,
  (value) => {
    form.value = value
      ? {
          id: value.id,
          name: value.name,
          description: value.description,
          // 回填「要复制的内容」：与卡片显示同源（copyContent 优先，回退 keys）
          // keys 可选（命令行类条目没有键位）⇒ 统一兜底为空串，表单侧恒为字符串
          content: value.copyContent || value.keys || "",
          keys: value.keys ?? "",
          group: value.group || props.i18n.customShortcuts,
        }
      : {
          id: "",
          name: "",
          description: "",
          content: "",
          keys: "",
          group: props.i18n.customShortcuts,
        }
    errors.value = { name: "", content: "", group: "" }
    customGroupMode.value = false
    groupSelectValue.value = form.value.group
  },
  { immediate: true },
)

/**
 * 分组下拉选择：哨兵值切到新建态，其余写入表单。
 *
 * ⚠️ `Select` 是纯受控组件（显示完全取决于 `modelValue`，自身不持有值）
 * ⇒ 必须同步回写 `groupSelectValue`，否则选中后触发器文案与下拉勾选态不会变化。
 * ⚠️ 切到新建态后 `Select` 被 `v-if` 换成 `Input`，**必须手动把焦点交给新输入框**：
 * 否则用户直接敲键盘会落空（输入框实际为空），确认时分组静默回落默认值 —— 表现为「新建分组没效果」。
 */
async function handleGroupSelect(value: string | number | boolean | null): Promise<void> {
  const next = String(value ?? "")
  if (next === NEW_GROUP_VALUE) {
    customGroupMode.value = true
    form.value.group = ""
    errors.value.group = ""
    await nextTick()
    newGroupInputRef.value?.focus()
    return
  }
  customGroupMode.value = false
  groupSelectValue.value = next
  form.value.group = next
}

/** 从新建态回到下拉选择（分组值回落为默认分组） */
function backToGroupList(): void {
  customGroupMode.value = false
  errors.value.group = ""
  form.value.group = defaultGroup.value
  groupSelectValue.value = defaultGroup.value
}

/** 关闭请求（Esc / 遮罩 / 右上角关闭按钮）统一转为 close */
function handleVisibleChange(value: boolean): void {
  if (!value) {
    emit("close")
  }
}

function handleConfirm(): void {
  const name = form.value.name.trim()
  // 内容必填（快捷键可选）：留空静默回落会让「填了内容却没生效」看起来像 bug
  const content = form.value.content.trim()
  const group = form.value.group.trim()
  // 新建分组态下分组名必填：留空静默回落默认分组会让「新建分组」看起来没生效
  const groupRequired = customGroupMode.value && !group

  errors.value = {
    name: name ? "" : props.i18n.fillRequired,
    content: content ? "" : props.i18n.fillRequired,
    group: groupRequired ? props.i18n.fillRequired : "",
  }

  if (!name || !content || groupRequired) {
    emit("error", props.i18n.fillRequired)
    return
  }

  emit("confirm", buildCustomShortcut(form.value, props.i18n.customShortcuts))
}
</script>

<style scoped lang="scss">
@use "../styles/ShortcutDialog.scss";
</style>
