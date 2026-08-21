# Skills 查看器

查看和管理 AI 编程工具的 Skills 配置文件，兼容 Claude、CodeBuddy、Qoder、Trae、Opencode。通过顶部栏快捷入口或斜杠命令打开弹窗，支持全局/项目级扫描、编辑、复制到其他工具、删除。

## 目录结构

```
skillsViewer/
├── index.ts                        # 注册入口（addCommand）+ 公共 API scanSkills()
├── index.vue                       # 主弹窗薄壳（逻辑位于 composable）
├── state.ts                        # 可见性 ref + show/hide
├── utils.ts                        # 纯工具函数（formatFileSize 等）
├── composables/
│   └── useSkillsViewer.ts          # 全部状态与 CRUD 逻辑（filePath 稳定标识）
├── components/
│   ├── SkillCard.vue               # 单 Skill 卡片（展示/编辑/展开）
│   ├── DeleteConfirmModal.vue      # 删除确认弹窗
│   └── CopySkillModal.vue          # 复制到其他工具弹窗
├── types/
│   ├── index.ts                    # re-export（类型来自 @/config/aiTools）
│   └── SkillsViewerManager.ts      # Manager 类 + SkillInfo 类型
└── styles/
    ├── index.scss                  # 主弹窗样式（overlay/dialog/工具卡/列表）
    ├── SkillCard.scss              # SkillCard 样式
    ├── CopySkillModal.scss         # 复制弹窗工具选项样式
    ├── _modal.scss                 # 共享 modal 基座（两个确认弹窗共用）
    └── _mixins.scss                # 共享 mixin（sv-custom-scrollbar）
```

## 维护说明

- **AI 工具配置单一数据源**：`AIToolType` / `AIToolConfig` / `AI_TOOLS` 定义在顶层 `src/config/aiTools.ts`，skillsViewer 与 aiContentGenerator 均从此导入。新增工具只需修改该文件 + `src/config/icons.ts` 注册图标。
- **i18n 结构**：`src/i18n/{zh_CN,en_US}/skillsViewer.json` 为嵌套命名空间 `{ "skillsViewer": { ... } }`，组件内通过 `plugin.i18n.skillsViewer` 访问；改键后运行 `pnpm i18n:merge` 重新生成顶层合并 JSON。
- **稳定标识**：列表 `v-for` 的 key 与编辑/删除/复制目标均使用 `skill.filePath`（唯一标识），禁止回退到数组索引。
- **扫描 API**：`scanSkills()` 供 aiContentGenerator 通过依赖注入调用（见 `src/index.ts`），内部每次创建独立 Manager 并在 finally 中销毁。
