<!-- 常用关键字行：关键字 chip（共享 Button 承载点击/删除）+ 新增输入（共享 Input）+ 操作按钮（共享 Button） -->
<template>
  <div class="vp-freq-keywords">
    <div class="vp-freq-keywords__row">
      <span class="vp-freq-keywords__label">{{ i18n.frequentKeywords }}</span>

      <div
        v-if="keywords.length === 0"
        class="vp-freq-keywords__empty"
      >
        {{ i18n.noKeywords }}
      </div>

      <!-- chip：外壳只做「边框 + 药丸形 + 紧凑排布」（纯展示容器），两个动作各由一个共享 Button 承担
           ⚠️ 为什么不用 Tag 的 closable：Tag 虽声明了 click 事件却从未 emit（Vue 还会把已声明事件的
           监听器从 fallthrough attrs 里过滤掉），故 @click 落在 Tag 上不生效 —— 「点击关键字填入搜索框」
           这一主交互无法实现。改用两个并列 Button（关键词 / 关闭），保持无嵌套按钮的合法 HTML 与完整键盘语义 -->
      <div
        v-for="kw in keywords"
        :key="kw"
        class="vp-freq-keywords__chip"
      >
        <!-- 关键词按钮：点击填入搜索框 -->
        <Button
          class="vp-freq-keywords__chip-text"
          variant="ghost"
          text
          size="xsmall"
          dense
          :title="`${i18n.searchKeyword}: ${kw}`"
          :aria-label="`${i18n.searchKeyword}: ${kw}`"
          @click="emit('insert', kw)"
        >
          {{ kw }}
        </Button>
        <!-- 关闭按钮：删除该关键字（可访问名称："删除"） -->
        <Button
          class="vp-freq-keywords__chip-del"
          variant="ghost"
          text
          rounded
          size="xsmall"
          dense
          icon="close"
          :title="i18n.deleteKeyword"
          :aria-label="i18n.deleteKeyword"
          @click="handleDelete(kw)"
        />
      </div>

      <!-- 添加输入区 -->
      <div
        v-if="isAdding"
        class="vp-freq-keywords__add-wrap"
      >
        <Input
          ref="addInputRef"
          v-model="newKeyword"
          class="vp-freq-keywords__add-input"
          type="text"
          size="xsmall"
          :placeholder="i18n.keywordPlaceholder"
          :maxlength="KEYWORD_MAX_LENGTH"
          @keydown="handleAddKeydown"
        />
        <!-- 确认按钮："确定" -->
        <Button
          variant="primary"
          size="xsmall"
          :disabled="!newKeyword.trim()"
          @click="handleAdd"
        >
          {{ i18n.confirm }}
        </Button>
        <!-- 取消按钮："取消" -->
        <Button
          variant="ghost"
          text
          size="xsmall"
          @click="cancelAdd"
        >
          {{ i18n.cancel }}
        </Button>
      </div>
      <!-- 添加入口：纯图标按钮（aria："添加常用关键字"） -->
      <Button
        v-else
        class="vp-freq-keywords__plus"
        variant="ghost"
        rounded
        size="xsmall"
        icon="plus"
        :title="i18n.addKeyword"
        :aria-label="i18n.addKeyword"
        @click="startAdd"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  nextTick,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"

interface Props {
  keywords: string[]
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "insert", keyword: string): void
  (e: "add", keyword: string): void
  (e: "delete", keyword: string): void
}

/** 关键字最大长度（与整改前原生 maxlength 保持一致） */
const KEYWORD_MAX_LENGTH = 60

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isAdding = ref(false)
const newKeyword = ref("")
const addInputRef = ref<InstanceType<typeof Input> | null>(null)

/** 进入新增态并聚焦共享 Input（聚焦走组件暴露的 focus()） */
const startAdd = () => {
  isAdding.value = true
  newKeyword.value = ""
  void nextTick(() => {
    addInputRef.value?.focus()
  })
}

/** 取消新增 */
const cancelAdd = () => {
  isAdding.value = false
  newKeyword.value = ""
}

/** 新增态键盘：Enter 提交、Escape 取消（Input 透出原生 KeyboardEvent） */
const handleAddKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault()
    handleAdd()
  } else if (event.key === "Escape") {
    cancelAdd()
  }
}

/** 提交新增（去空白、同值不重复添加） */
const handleAdd = () => {
  const kw = newKeyword.value.trim()
  if (!kw) return
  if (props.keywords.includes(kw)) {
    return // 重复不添加
  }
  emit("add", kw)
  cancelAdd()
}

/** 删除关键字 */
const handleDelete = (kw: string) => {
  emit("delete", kw)
}
</script>

<style scoped lang="scss">
@use "../styles/FrequentKeywords.scss";
</style>
