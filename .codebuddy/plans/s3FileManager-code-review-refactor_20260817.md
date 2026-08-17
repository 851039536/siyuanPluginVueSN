---
name: s3FileManager-code-review-refactor
overview: 对 s3FileManager 功能模块按 AGENTS 规范全面审查，修复发现的功能缺陷、冗余、规范违规与可维护性问题。
todos:
  - id: fix-logic-bugs
    content: 修复 5 处功能缺陷：downloadEntries 列表失败时进度卡 99% 与日志缺失、FmMoveCopyDialog 列表失败后误发 confirm、useEscClose 多层弹窗并发关闭、上传冲突名单重复、FmContextMenu 菜单高度估算不精确
    status: completed
  - id: fix-memory
    content: 上传逐文件顺序读取替换为并发内存保护：可配置最大并发内存（默认 2 个 Buffer），避免多文件/大文件并发 readFile 导致内存暴涨
    status: completed
    dependencies:
      - fix-logic-bugs
  - id: standardize-confirm
    content: 以项目标准对话框组件替换 4 处原生 confirm：删除确认、覆盖确认、清空日志、大文件/覆盖提示（原生 confirm 风格不一致、阻断渲染、无 i18n 语义）
    status: completed
    dependencies:
      - fix-logic-bugs
  - id: config-form-completeness
    content: FmConfigDialog 补齐 uploadTimeoutSec 字段并统一 snapshot()/导入回填的归一化；S3FileManagerI18n 类型改为嵌套结构化或保留 Record 但补齐值类型
    status: completed
    dependencies:
      - fix-logic-bugs
  - id: scss-token-compliance
    content: 替换 10 处硬编码 fallback（#22c55e、rgba(66,133,244,…)、rgba(0,0,0,.45)、transition 0.2s 等）为 $color-*/$vp-radius/$spacing-* Token，并消除重复 selected/drag-over 样式
    status: completed
    dependencies:
      - fix-logic-bugs
  - id: fix-utility-todos
    content: 处理低频/待办项：ListObjects 一致性冲突回传调用方、S3FileInfo.name 定位修复、跨操作 busy 级联禁用、下载任务的目录安全校验、空文件夹 key 集合去重说明
    status: completed
    dependencies:
      - fix-logic-bugs
  - id: verify
    content: "[已完成自动部分] 运行 pnpm i18n:verify、npx tsc --noEmit；validate:icons 仍有既有 mdi:chart-finance 问题待用户处理"
    status: completed
    content: 运行 pnpm i18n:verify、npx tsc --noEmit、pnpm validate:icons（注意既有 mdi:chart-finance 无效图标与既有 tsc 错误，不在本模块范围）
    status: completed
    dependencies:
      - standardize-confirm
      - config-form-completeness
      - scss-token-compliance
      - fix-utility-todos
