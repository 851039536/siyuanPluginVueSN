<!-- 弹窗帮助入口：帮助按钮 + 说明弹层（编辑项目等表单弹窗共用） -->
<template>
  <div
    ref="rootEl"
    class="gp-help-wrap"
  >
    <button
      class="vp-btn vp-btn--ghost vp-btn--xs gp-help-btn"
      :title="i18n.help"
      @click="showHelp = !showHelp"
    >
      <Icon
        icon="mdi:help-circle-outline"
        height="10"
      />
    </button>
    <!-- 帮助说明弹层 -->
    <div
      v-if="showHelp"
      class="gp-help-popover"
      @click.stop
    >
      <div class="gp-help-header">
        <Icon
          icon="mdi:information-outline"
          height="12"
        />
        <!-- 弹层标题："帮助说明" -->
        <span>{{ i18n.help }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--xs gp-help-close"
          @click="showHelp = false"
        >
          <Icon
            icon="mdi:close"
            height="10"
          />
        </button>
      </div>
      <div class="gp-help-body">
        <div
          v-for="item in items"
          :key="item.icon"
          class="gp-help-item"
        >
          <Icon
            :icon="item.icon"
            height="12"
            class="gp-help-item-icon"
          />
          <!-- 帮助条目正文（本地路径/仓库链接/Git 远程/数据持久化说明） -->
          <p>{{ item.text }}</p>
        </div>
      </div>
      <div class="gp-help-footer">
        <!-- 按钮："知道了" -->
        <button
          class="vp-btn vp-btn--primary vp-btn--xs"
          @click="showHelp = false"
        >
          {{ i18n.gotIt }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 帮助弹层：条目文案来自 i18n 分片 gitPush.json 的 help* 键
import { Icon } from "@iconify/vue"
import { computed, onUnmounted, ref, watch } from "vue"

const props = defineProps<{
  i18n: Record<string, any>
}>()

const showHelp = ref(false)
const rootEl = ref<HTMLElement | null>(null)

/** 打开时点击外部关闭（capture 监听，避免被弹层内部 stopPropagation 影响） */
function onDocMouseDown(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    showHelp.value = false
  }
}

watch(showHelp, (open) => {
  if (open) {
    document.addEventListener("mousedown", onDocMouseDown, true)
  } else {
    document.removeEventListener("mousedown", onDocMouseDown, true)
  }
})

onUnmounted(() => {
  document.removeEventListener("mousedown", onDocMouseDown, true)
})

const items = computed(() => [
  { icon: "mdi:folder-outline", text: props.i18n.helpLocalPaths },
  { icon: "mdi:link-variant", text: props.i18n.helpRepoLinks },
  { icon: "mdi:source-repository", text: props.i18n.helpGitRemotes },
  { icon: "mdi:database-outline", text: props.i18n.helpPersistence },
])
</script>
