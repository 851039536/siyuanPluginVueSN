<template>
  <div class="vp-adv-help">
    <div class="vp-adv-help__header">
      <span class="vp-adv-help__label">高级搜索语法</span>
      <span class="vp-adv-help__hint">点击标签插入到搜索框</span>
    </div>
    <div class="vp-adv-help__tags">
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
interface Emits {
  (e: "insert", keyword: string): void
}

const emit = defineEmits<Emits>()

interface SyntaxItem {
  keyword: string
  label: string
  desc: string
}

const syntaxList: SyntaxItem[] = [
  { keyword: "ext:", label: "扩展名", desc: "ext:pdf — 筛选 PDF 文件" },
  { keyword: "size:", label: "文件大小", desc: "size:>100mb — 大于 100MB" },
  { keyword: "date:", label: "修改日期", desc: "datemodified:today — 今天修改" },
  { keyword: "attrib:", label: "文件属性", desc: "attrib:H — 隐藏文件" },
  { keyword: "child:", label: "子文件", desc: "child:*.md — 包含 md 文件的文件夹" },
  { keyword: "parent:", label: "父目录", desc: "parent:D:\\docs — 指定父目录" },
  { keyword: "type:", label: "类型", desc: "type:folder — 仅文件夹" },
  { keyword: "dupe:", label: "重复文件", desc: "dupe: — 查找重复文件" },
  { keyword: "empty:", label: "空目录", desc: "empty: — 查找空文件夹" },
  { keyword: "len:", label: "路径长度", desc: "len:>260 — 路径超长文件" },
  { keyword: "|", label: "OR 或", desc: ".jpg|.png — 图片文件" },
  { keyword: "!", label: "NOT 非", desc: "!ext:tmp — 排除临时文件" },
  { keyword: "\"\"", label: "精确匹配", desc: "\"exact name\" — 精确名称" },
  { keyword: "\\ ", label: "空格转义", desc: "\\ 转义空格字符" },
]

const insertSyntax = (keyword: string) => {
  emit("insert", keyword)
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;

$vp-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;

.vp-adv-help {
  padding: 8px 16px;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px dashed var(--b3-border-color);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  &__label {
    font-size: 11px;
    font-weight: 600;
    color: $brand-orange;
  }

  &__hint {
    font-size: 10px;
    color: var(--b3-theme-on-surface);
    opacity: 0.35;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    font-size: 11px;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);

    code {
      font-family: $vp-mono;
      font-size: 11px;
      font-weight: 600;
      color: $brand-orange;
    }

    span {
      font-size: 10px;
      opacity: 0.55;
    }

    &:hover {
      border-color: $brand-orange;
      background: rgba($brand-orange, 0.06);

      span {
        opacity: 0.8;
      }
    }
  }
}
</style>
