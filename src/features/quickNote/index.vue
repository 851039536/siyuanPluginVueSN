<template>
  <div
    class="quick-note-panel"
    :class="{ 'quick-note-panel--minimized': minimized }"
  >
    <!-- 最小化态：贴边小条（横条/竖条由当前位置派生），按住可拖动，点击展开 -->
    <button
      v-if="minimized"
      class="mini-bar"
      :class="{ 'mini-bar--vertical': minimizeMeta.axis === 'vertical' }"
      :title="i18n.restore"
      @pointerdown="props.manager.startDrag($event)"
      @click="handleMiniBarClick"
    >
      <IconWrapper
        name="quickNote"
        :size="14"
      />
      <!-- 最小化条标题："速记"（竖条时纵向排版） -->
      <span class="mini-bar__title">{{ i18n.title }}</span>
      <!-- 待完成计数徽标 -->
      <span
        v-if="pendingCount > 0"
        class="mini-bar__count"
      >{{ pendingCount }}</span>
      <IconWrapper
        :name="minimizeMeta.expandIcon"
        :size="14"
        class="mini-bar__chevron"
      />
    </button>

    <!-- 展开态：完整面板 -->
    <template v-else>
      <!-- 面板头部（拖拽把手：按住空白区可拖动面板） -->
      <div
        class="panel-header"
        @pointerdown="props.manager.startDrag($event)"
      >
        <!-- 弹窗标题："速记" -->
        <h3 class="panel-title">
          <IconWrapper
            name="quickNote"
            :size="14"
            class="panel-title__icon"
          />
          {{ i18n.title }}
        </h3>
        <div class="header-actions">
          <!-- 预设位置菜单（悬浮提示："显示位置"，点击弹出五档预设） -->
          <div
            ref="menuWrapRef"
            class="position-menu-wrap"
          >
            <button
              class="close-btn"
              :title="i18n.position"
              @click="handleToggleMenu"
            >
              <IconWrapper
                name="layoutGrid"
                :size="12"
              />
            </button>
            <!-- 预设菜单项："居中/顶部/底部/左侧/右侧"（当前预设高亮，拖拽自定义态无高亮） -->
            <div
              v-if="menuOpen"
              class="position-menu"
            >
              <button
                v-for="p in QUICK_NOTE_POSITIONS"
                :key="p"
                class="position-menu__item"
                :class="{ 'position-menu__item--active': position === p }"
                @click="handleSelectPreset(p)"
              >
                {{ i18n[`position${p.charAt(0).toUpperCase()}${p.slice(1)}`] }}
              </button>
            </div>
          </div>
          <!-- 最小化按钮（悬浮提示："最小化"，箭头指向收缩方向） -->
          <button
            class="close-btn"
            :title="i18n.minimize"
            @click="handleToggleMinimize"
          >
            <IconWrapper
              :name="minimizeMeta.collapseIcon"
              :size="12"
            />
          </button>
          <button
            class="close-btn"
            @click="props.onClose?.()"
          >
            <IconWrapper
              name="close"
              :size="12"
            />
          </button>
        </div>
      </div>

      <!-- 新增速记区 -->
      <div class="add-area">
        <!-- 输入框占位："输入速记内容，Ctrl+Enter 快速添加" -->
        <textarea
          v-model="draft"
          class="add-textarea"
          :placeholder="i18n.addPlaceholder"
          rows="3"
          @keydown.ctrl.enter.prevent="handleAdd"
        />
        <!-- 按钮："添加" -->
        <SiButton
          size="small"
          :disabled="!draft.trim()"
          @click="handleAdd"
        >
          <IconWrapper
            name="plus"
            :size="12"
          />
          {{ i18n.add }}
        </SiButton>
      </div>

      <!-- 待完成/已完成 Tab 切换栏 -->
      <div class="filter-tabs">
        <!-- Tab："待完成"（含计数） -->
        <button
          class="filter-tab"
          :class="{ 'filter-tab--active': filter === 'pending' }"
          @click="filter = 'pending'"
        >
          {{ i18n.pending }}
          <span class="filter-tab__count">{{ pendingCount }}</span>
        </button>
        <!-- Tab："已完成"（含计数） -->
        <button
          class="filter-tab"
          :class="{ 'filter-tab--active': filter === 'done' }"
          @click="filter = 'done'"
        >
          {{ i18n.done }}
          <span class="filter-tab__count">{{ doneCount }}</span>
        </button>
      </div>

      <!-- 速记条目列表 -->
      <div class="note-list">
        <!-- 空态提示："暂无待完成速记" / "暂无已完成速记" -->
        <div
          v-if="filteredNotes.length === 0"
          class="note-list__empty"
        >
          {{ filter === "pending" ? i18n.emptyPending : i18n.emptyDone }}
        </div>
        <NoteItem
          v-for="note in filteredNotes"
          :key="note.id"
          :note="note"
          :i18n="i18n"
          @toggle-done="toggleDone(note.id)"
          @update="(content: string) => update(note.id, content)"
          @remove="handleRemove(note.id)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记 — 弹窗主面板
 * 自包含数据流：onMounted 从 manager.storage 加载条目，CRUD 经 useQuickNotes 直达存储；
 * 位置变更（预设菜单/拖拽）与最小化直达 manager，父层（Manager）不维护任何表单中间状态
 */
import type { Plugin } from "siyuan"
import type { QuickNoteManager } from "./index"
import type { QuickNotePlacement, QuickNotePosition } from "./types"
import { computed, onMounted, onUnmounted, ref } from "vue"
import SiButton from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import NoteItem from "./components/NoteItem.vue"
import { useQuickNotes } from "./composables/useQuickNotes"
import { POSITION_MINIMIZE_META, QUICK_NOTE_POSITIONS } from "./types"

const props = defineProps<{
  plugin: Plugin
  i18n: Record<string, string>
  manager: QuickNoteManager
  onClose?: () => void
}>()

const {
  filter,
  filteredNotes,
  pendingCount,
  doneCount,
  load,
  add,
  update,
  toggleDone,
  remove,
} = useQuickNotes(props.manager.storage)

// 新增输入草稿（persistent Modal 下关闭再打开不丢失）
const draft = ref("")

// 定位模式（预设/custom，初始化自 Manager 缓存；菜单高亮与最小化方向据此派生）
const position = ref<QuickNotePlacement>(props.manager.getPosition())

// 预设位置菜单开合与点击外部关闭用的容器引用
const menuOpen = ref(false)
const menuWrapRef = ref<HTMLElement | null>(null)

// 最小化状态（persistent Modal 下与 Manager 保持同步）
const minimized = ref(props.manager.isMinimized())

// 当前定位对应的最小化方向元数据（轴向 + 收起/展开箭头）
const minimizeMeta = computed(() => POSITION_MINIMIZE_META[position.value])

const handleAdd = async () => {
  if (!draft.value.trim()) return
  await add(draft.value)
  draft.value = ""
}

// 预设菜单开合：打开前同步 Manager 侧定位（拖拽后可能已变为 custom，用于高亮判断）
const handleToggleMenu = () => {
  position.value = props.manager.getPosition()
  menuOpen.value = !menuOpen.value
}

// 选择预设档位：吸附并退出自定义定位
const handleSelectPreset = (pos: QuickNotePosition) => {
  position.value = pos
  menuOpen.value = false
  props.manager.setPosition(pos)
}

// 点击菜单外部关闭预设菜单
const handleWindowClick = (e: MouseEvent) => {
  if (!menuOpen.value) return
  if (menuWrapRef.value?.contains(e.target as Node)) return
  menuOpen.value = false
}

// 最小化/展开切换：先同步定位（拖拽后已变 custom，据此派生收缩方向），Manager 改写容器与遮罩
const handleToggleMinimize = () => {
  position.value = props.manager.getPosition()
  minimized.value = !minimized.value
  props.manager.setMinimized(minimized.value)
}

// 小条点击：刚完成拖动则吞掉本次点击（不触发展开）
const handleMiniBarClick = () => {
  if (props.manager.consumeDragClick()) return
  handleToggleMinimize()
}

const handleRemove = (id: string) => {
  // 删除确认："确定删除这条速记吗？"
  if (!window.confirm(props.i18n.deleteConfirm)) return
  remove(id)
}

onMounted(() => {
  load()
  position.value = props.manager.getPosition()
  minimized.value = props.manager.isMinimized()
  // 预设菜单点击外部关闭（persistent 实例常驻，onUnmounted 对应清理）
  window.addEventListener("click", handleWindowClick)
})

onUnmounted(() => {
  window.removeEventListener("click", handleWindowClick)
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
