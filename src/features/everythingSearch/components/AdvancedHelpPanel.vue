<template>
  <div class="vp-adv-help">
    <div class="vp-adv-help__header">
      <!-- 面板标题："高级搜索语法" -->
      <span class="vp-adv-help__label">{{ i18n.advHelpTitle }}</span>
      <!-- 面板提示："点击标签插入到搜索框" -->
      <span class="vp-adv-help__hint">{{ i18n.advHelpHint }}</span>
    </div>
    <div class="vp-adv-help__tags">
      <!-- 语法标签（label/desc 走 i18n：扩展名/文件大小/修改日期等） -->
      <button
        v-for="item in syntaxList"
        :key="item.keyword"
        class="vp-adv-help__tag"
        :title="item.desc"
        @click="insertSyntax(item.keyword)"
      >
        <code>{{ item.keyword }}</code>
        <span>{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

interface Props {
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "insert", keyword: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

interface SyntaxItem {
  keyword: string
  label: string
  desc: string
}

/** 语法说明列表（文案走 i18n，keyword 为 Everything 语法不翻译） */
const syntaxList = computed<SyntaxItem[]>(() => [
  {
    keyword: "ext:",
    label: props.i18n.extension,
    desc: props.i18n.syntaxExtDesc,
  },
  {
    keyword: "size:",
    label: props.i18n.fileSize,
    desc: props.i18n.syntaxSizeDesc,
  },
  {
    keyword: "date:",
    label: props.i18n.modDate,
    desc: props.i18n.syntaxDateDesc,
  },
  {
    keyword: "attrib:",
    label: props.i18n.syntaxAttrib,
    desc: props.i18n.syntaxAttribDesc,
  },
  {
    keyword: "child:",
    label: props.i18n.syntaxChild,
    desc: props.i18n.syntaxChildDesc,
  },
  {
    keyword: "parent:",
    label: props.i18n.syntaxParent,
    desc: props.i18n.syntaxParentDesc,
  },
  {
    keyword: "type:",
    label: props.i18n.syntaxType,
    desc: props.i18n.syntaxTypeDesc,
  },
  {
    keyword: "dupe:",
    label: props.i18n.syntaxDupe,
    desc: props.i18n.syntaxDupeDesc,
  },
  {
    keyword: "empty:",
    label: props.i18n.syntaxEmpty,
    desc: props.i18n.syntaxEmptyDesc,
  },
  {
    keyword: "len:",
    label: props.i18n.syntaxLen,
    desc: props.i18n.syntaxLenDesc,
  },
  {
    keyword: "|",
    label: props.i18n.syntaxOr,
    desc: props.i18n.syntaxOrDesc,
  },
  {
    keyword: "!",
    label: props.i18n.syntaxNot,
    desc: props.i18n.syntaxNotDesc,
  },
  {
    keyword: "\"\"",
    label: props.i18n.syntaxExact,
    desc: props.i18n.syntaxExactDesc,
  },
  {
    keyword: "\\ ",
    label: props.i18n.syntaxEscape,
    desc: props.i18n.syntaxEscapeDesc,
  },
])

const insertSyntax = (keyword: string) => {
  emit("insert", keyword)
}
</script>

<style scoped lang="scss">
@use "../styles/AdvancedHelpPanel.scss";
</style>
