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
        {{ i18n.title }}
      </h3>
      <button
        class="close-btn"
        @click="props.onClose?.()"
      >
        <IconWrapper
          name="close"
          :size="16"
        />
      </button>
    </div>

    <div class="panel-content">
      <!-- 功能开关区 -->
      <!-- 开关标签："书签标记" -->
      <label class="setting-label">
        <IconWrapper
          name="bookmarkMarker"
          :size="14"
        />
        {{ i18n.enableBookmarkMarker }}
      </label>
      <SiSwitch
        v-model="settings.enableBookmarkMarker.value"
        @change="handleToggleChange"
      />
      <!-- 功能描述："根据文档书签内容在文件树中显示颜色标记" -->
      <p class="toggle-description">
        {{ i18n.bookmarkMarkerDescription }}
      </p>

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

          <!-- 规则列表 -->
          <RuleItem
            v-for="(rule, index) in settings.rules.value"
            :key="index"
            :rule="rule"
            :index="index"
            :i18n="i18n"
            @change="handleRulesChange"
            @remove="removeRule(index)"
          />

          <!-- 按钮："添加规则" -->
          <button
            class="add-rule-btn"
            @click="addRule"
          >
            <IconWrapper
              name="plus"
              :size="14"
            />
            {{ i18n.addRule }}
          </button>
        </div>

        <!-- 更新间隔设置区 -->
        <div class="update-interval">
          <!-- 标签："更新间隔" -->
          <label class="interval-label">
            {{ i18n.updateInterval }}
          </label>
          <select
            v-model="settings.updateInterval.value"
            class="interval-select"
            @change="handleIntervalChange"
          >
            <!-- 选项："30分钟" -->
            <option value="1800000">
              {{ i18n.interval30min }}
            </option>
            <!-- 选项："1小时" -->
            <option value="3600000">
              {{ i18n.interval1hour }}
            </option>
            <!-- 选项："2小时" -->
            <option value="7200000">
              {{ i18n.interval2hour }}
            </option>
            <!-- 选项："4小时" -->
            <option value="14400000">
              {{ i18n.interval4hour }}
            </option>
          </select>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 书签标记 — 设置面板主组件
 * 负责功能开关、规则列表渲染与更新间隔设置，单条规则编辑委托给 RuleItem
 */
import { showMessage } from "siyuan"
import IconWrapper from "@/components/IconWrapper.vue"
import SiSwitch from "@/components/Switch.vue"
import RuleItem from "./components/RuleItem.vue"
import { useBookmarkMarkerSettings } from "./composables/useBookmarkMarkerSettings"

const props = defineProps<{
  i18n: Record<string, string>
  plugin?: any
  onBookmarkMarkerChange?: (action: string, data?: any) => void
  onClose?: () => void
}>()

const settings = useBookmarkMarkerSettings(props.plugin)

const handleToggleChange = async () => {
  await settings.save()
  props.onBookmarkMarkerChange?.("toggle", {
    enabled: settings.enableBookmarkMarker.value,
    rules: settings.rules.value,
    updateInterval: Number(settings.updateInterval.value),
  })
  // 提示："书签标记已启用" / "书签标记已禁用"
  showMessage(
    settings.enableBookmarkMarker.value ? props.i18n.msgEnabled : props.i18n.msgDisabled,
    2000,
    "info",
  )
}

const handleRulesChange = async () => {
  await settings.save()
  props.onBookmarkMarkerChange?.("rulesChanged", { rules: settings.rules.value })
  // 提示："标记规则已更新"
  showMessage(props.i18n.msgRulesUpdated, 2000, "info")
}

const handleIntervalChange = async () => {
  await settings.save()
  props.onBookmarkMarkerChange?.("intervalChanged", { updateInterval: Number(settings.updateInterval.value) })
  // 提示："更新间隔已修改"
  showMessage(props.i18n.msgIntervalUpdated, 2000, "info")
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
  handleRulesChange()
}

const removeRule = (index: number) => {
  settings.rules.value.splice(index, 1)
  handleRulesChange()
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
