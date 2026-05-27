/// <reference types="vite/client" />

// 声明 .md?raw 导入类型
declare module "*.md?raw" {
  const content: string
  export default content
}

// 声明 .md 导入类型
declare module "*.md" {
  const content: string
  export default content
}

declare module "diff-match-patch" {
  class DiffMatchPatch {
    diff_main(text1: string, text2: string): Array<[number, string]>
    diff_cleanupSemantic(diffs: Array<[number, string]>): void
    patch_make(text1: string, diffs: Array<[number, string]>): any[]
    patch_apply(patches: any[], text: string): [string, boolean[]]
  }
  export default DiffMatchPatch
}
