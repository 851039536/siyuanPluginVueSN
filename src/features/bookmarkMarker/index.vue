<!-- 书签标记设置面板：功能开关、规则列表编辑与更新间隔设置（单条规则编辑委托给 RuleItem） -->
<template>
  <div class="bookmark-marker-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <!-- 弹窗标题："书签标记" -->
      <h3 class="panel-title">
        <IconWrapper
          name="bookmarkMarker"
          :size="18"
          class="panel-title__icon"
        />
        {{ i18n.bookmarkMarkerTitle }}
      </h3>
      <!-- 纯图标按钮：关闭面板（ariaLabel："关闭"） -->
      <Button
        variant="ghost"
        text
        size="small"
        icon="close"
        :aria-label="i18n.panelCloseLabel"
        @click="props.onClose?.()"
      />
    </div>

    <div class="panel-content">
      <!-- 功能开关区：面板标题已标识功能名，开关行不再重复"书签标记"文案 -->
      <div class="toggle-row">
        <SiSwitch
          v-model="settings.enableBookmarkMarker.value"
          @change="handleToggleChange"
        />
        <!-- 功能描述："根据文档书签内容在文件树中显示颜色标记" -->
        <p class="toggle-description">
          {{ i18n.bookmarkMarkerDescription }}
        </p>
      </div>

      <!-- 标记规则设置区 -->
      <template v-if="settings.enableBookmarkMarker.value">
        <div class="rules-settings">
          <!-- 区块标题："标记规则" -->
          <div class="settings-title">
            <IconWrapper
              name="bookmarkMarker"
              :size="14"
            />
            {{ i18n.bookmarkRules }}
          </div>

          <!-- 规则列表（key 取规则对象身份，避免删除中间项时子组件状态错位） -->
          <RuleItem
            v-for="(rule, index) in settings.rules.value"
            :key="keyOfRule(rule)"
            :rule="rule"
            :index="index"
            :i18n="i18n"
            @patch="handleRulePatch(rule, $event)"
            @commit="handleRulesCommit"
            @remove="removeRule(rule)"
          />

          <!-- 按钮："添加规则" -->
          <Button
            variant="primary"
            outlined
            block
            size="small"
            icon="plus"
            @click="addRule"
          >
            {{ i18n.addRule }}
          </Button>
        </div>

        <!-- 更新间隔设置区（标签由共享 Select 的 label 承载） -->
        <div class="update-interval">
          <!-- 标签："更新间隔" -->
          <Select
            size="small"
            placement="top"
            :label="i18n.markerUpdateInterval"
            :model-value="settings.updateInterval.value"
            :options="intervalOptions"
            @update:model-value="handleIntervalChange"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { SelectOption } from "@/components/Select.vue"
import type {
  BookmarkMarkerActionPayload,
  BookmarkMarkerI18n,
  BookmarkRule,
  RulePatch,
} from "./types"
import { computed } from "vue"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import SiSwitch from "@/components/Switch.vue"
import RuleItem from "./components/RuleItem.vue"
import { useBookmarkMarkerSettings } from "./composables/useBookmarkMarkerSettings"
import { UPDATE_INTERVAL_OPTIONS } from "./types"

const props = defineProps<{
  /** 模块 i18n 键（扁平结构） */
  i18n: BookmarkMarkerI18n
  plugin?: Plugin
  /** 面板 → Manager 的变更派发（判别联合载荷） */
  onBookmarkMarkerChange?: (payload: BookmarkMarkerActionPayload) => void
  onClose?: () => void
}>()

const settings = useBookmarkMarkerSettings(props.plugin)

// ===== 更新间隔下拉 =====

/** 间隔选项：值与文案均来自 UPDATE_INTERVAL_OPTIONS 单一数据源 */
const intervalOptions = computed<SelectOption[]>(() =>
  UPDATE_INTERVAL_OPTIONS.map((opt) => ({
    value: String(opt.value),
    label: props.i18n[opt.labelKey],
  })),
)

// ===== 规则列表稳定 key =====

/**
 * 规则对象 → 稳定数字 key。
 * 不能直接用索引：删除中间规则时索引会整体前移，Vue 会复用组件实例，
 * 携带内部状态（如颜色调色板开合）的子组件会随之错位。
 */
const ruleKeys = new WeakMap<BookmarkRule, number>()
let nextRuleKey = 0
const keyOfRule = (rule: BookmarkRule): number => {
  let key = ruleKeys.get(rule)
  if (key === undefined) {
    nextRuleKey += 1
    key = nextRuleKey
    ruleKeys.set(rule, key)
  }
  return key
}

// ===== 规则编辑（patch 只改内存 / commit 才落盘） =====

/** 子组件补丁：合并到父级自有的规则对象（不落盘、不提示） */
const handleRulePatch = (rule: BookmarkRule, payload: RulePatch) => {
  Object.assign(rule, payload)
}

/** 提交：落盘 + 通知 Manager + 提示（持续型交互仅在操作结束时触发） */
const handleRulesCommit = async () => {
  await settings.save()
  props.onBookmarkMarkerChange?.({ action: "rulesChanged", rules: settings.rules.value })
  showMessage(props.i18n.msgRulesUpdated, 2000, "info")
}

const addRule = () => {
  settings.rules.value.push({
    bookmarkNames: [],
    color: "#ffffff",
    backgroundColor: "#1890ff",
    icon: "",
    displayMode: "bg",
    alpha: 0.25,
    matchMode: "exact",
  })
  // 立即持久化，避免添加后直接关闭弹窗（非持久 Modal）丢失新规则
  handleRulesCommit()
}

/** 按对象身份定位删除（与 v-for 的 key 策略一致） */
const removeRule = (rule: BookmarkRule) => {
  const index = settings.rules.value.indexOf(rule)
  if (index === -1) return
  settings.rules.value.splice(index, 1)
  handleRulesCommit()
}

// ===== 开关与间隔 =====

const handleToggleChange = async () => {
  await settings.save()
  props.onBookmarkMarkerChange?.({
    action: "toggle",
    enabled: settings.enableBookmarkMarker.value,
    rules: settings.rules.value,
    updateInterval: Number(settings.updateInterval.value),
  })
  // 提示："书签标记已启用" / "书签标记已禁用"
  showMessage(
    settings.enableBookmarkMarker.value
      ? props.i18n.bookmarkMarkerMsgEnabled
      : props.i18n.bookmarkMarkerMsgDisabled,
    2000,
    "info",
  )
}

const handleIntervalChange = async (value: string | number | boolean | null) => {
  settings.updateInterval.value = String(value ?? "")
  await settings.save()
  props.onBookmarkMarkerChange?.({
    action: "intervalChanged",
    updateInterval: Number(settings.updateInterval.value),
  })
  // 提示："更新间隔已修改"
  showMessage(props.i18n.msgIntervalUpdated, 2000, "info")
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
