---
name: 新增共享组件 Textarea
overview: 参考 PrimeVue Textarea，在 src/components/ 新增独立的多行文本域共享组件 Textarea.vue（四档尺寸 + label/hint/error + autoResize 自动增高 + variant 描边/实底 + fluid 占满宽），配套 SCSS、组件预览清单与文档计数同步；Input.vue 的 type="textarea" 保持不动。
todos:
  - id: fetch-primevue-api
    content: 用 [mcp:Context7] 查询 PrimeVue Textarea 官方 API 并产出与本项目命名的字段对照表
    status: completed
  - id: create-textarea-component
    content: 新建 src/components/Textarea.vue，实现 props/emits/expose、FormField 包裹与 autoResize 算法
    status: completed
    dependencies:
      - fetch-primevue-api
  - id: create-textarea-styles
    content: 新建 src/components/styles/Textarea.scss，实现描边/实底两档与四档尺寸及状态样式
    status: completed
    dependencies:
      - create-textarea-component
  - id: create-preview-data
    content: 新建 previewData/textarea.ts 预览清单并接入 previewData/index.ts
    status: completed
    dependencies:
      - create-textarea-component
  - id: sync-docs
    content: 同步 AGENTS.md 五处计数与清单表、README.md 与 componentPreview/README.md 计数及能力说明
    status: completed
    dependencies:
      - create-preview-data
  - id: arch-compliance-review
    content: 用 [skill:universal-arch-skill] 审查新组件的样式分离、设计 Token 与命名合规性并修复待修项
    status: completed
    dependencies:
      - create-textarea-styles
  - id: verify-static-checks
    content: 执行 npx tsc --noEmit 与 read_lints 核验，并输出用户侧 lint 与预览面板目视回归清单
    status: completed
    dependencies:
      - arch-compliance-review
      - sync-docs
---

