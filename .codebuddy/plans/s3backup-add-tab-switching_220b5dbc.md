---
name: s3backup-add-tab-switching
overview: 为 S3Backup 面板增加 Tab 页切换，将 S3 配置移到独立"配置"Tab，备份相关功能保留在"备份"Tab。
todos:
  - id: add-tab-bar-template
    content: 在 index.vue 模板中新增 Tab 栏 HTML 结构，将 S3 配置 section 移出 settings-container，用 v-if 拆分"备份"和"配置"两个内容区
    status: completed
  - id: add-active-tab-ref
    content: 在 index.vue 脚本中新增 activeTab ref（默认 'backup'），确保 Tab 切换逻辑就绪
    status: completed
    dependencies:
      - add-tab-bar-template
  - id: add-tab-scss
    content: 在 styles/index.scss 中新增 .s3-tab-bar 和 .s3-tab-btn 样式（含 active 底部指示条），参考 toolCollection 模式
    status: completed
  - id: add-i18n-keys
    content: 在 zh_CN 和 en_US 的 s3Backup.json 中新增 backupTab / configTab 翻译键，运行 pnpm i18n:verify
    status: completed
  - id: verify-lint
    content: 运行 pnpm lint 验证所有修改无错误
    status: completed
    dependencies:
      - add-tab-bar-template
      - add-active-tab-ref
      - add-tab-scss
      - add-i18n-keys
---

## 用户需求

为 s3Backup 模块增加 Tab 页面切换，把 S3 配置移到独立的"配置"Tab 页。

## 核心功能

- 在面板头部下方新增 Tab 切换栏，包含"备份"和"配置"两个标签
- 默认显示"备份"Tab，包含工作区信息、备份模式、备份进度、手动备份、自动备份设置、本地备份历史、S3 备份列表
- 点击"配置"Tab 切换到 S3ConfigForm 独立页面，S3 配置以卡片形式独立展示
- 活跃 Tab 底部有主题色指示条（参考 toolCollection 的 `.tab-btn.active::after` 模式）

## 技术方案

### 实现策略

在 `index.vue` 模板中，头部下方插入 tab 栏，将原有 `.settings-container` 拆分为两个 `v-if` 条件渲染块。脚本层仅新增一个 `activeTab` ref，无需修改任何现有方法或数据流。

### 模板改造

```html
<!-- 头部不变 -->
<div class="s3-backup-header">...</div>

<!-- 新增 Tab 栏 -->
<div class="s3-tab-bar">
  <button class="s3-tab-btn" :class="{ active: activeTab === 'backup' }" @click="activeTab = 'backup'">
    {{ i18n.backupTab || "备份" }}
  </button>
  <button class="s3-tab-btn" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">
    {{ i18n.configTab || "配置" }}
  </button>
</div>

<!-- Tab: 备份（原有 7 个 card-section，去掉 S3 配置 section） -->
<div v-if="activeTab === 'backup'" class="settings-container">
  <!-- 工作区信息、备份模式、进度、手动备份、自动备份、本地备份、S3备份列表 -->
</div>

<!-- Tab: 配置（仅 S3ConfigForm 包裹 card-section） -->
<div v-if="activeTab === 'config'" class="settings-container">
  <section class="card-section config-section">
    <S3ConfigForm ... />
  </section>
</div>
```

### SCSS 新增样式

参考 toolCollection 的 `.tool-collection-tabs` / `.tab-btn` 模式，新增：

- `.s3-tab-bar` — flex row, gap 0, border-bottom, flex-shrink 0, padding
- `.s3-tab-btn` — transparent bg, font-size-sm, cursor pointer, transition 0.15s
- `.s3-tab-btn.active` — color: primary, `::after` 底部 2px 蓝色指示条

### 关键决策

- `activeTab` 仅影响 UI 渲染层，不使用 `v-show` 以避免组件初始化开销
- Tab 切换不触发任何数据重载或请求，原 `onMounted` 中所有逻辑保持一次执行
- 复用已有 `.settings-container` + `.card-section` 样式，无需新建容器类

## 文件变更清单

```
src/features/s3Backup/
├── index.vue                    # [MODIFY] 模板拆分 + 新增 activeTab ref (±20 行)
├── styles/
│   └── index.scss               # [MODIFY] 新增 .s3-tab-bar / .s3-tab-btn 样式块
└── [i18n]
    ├── zh_CN/s3Backup.json      # [MODIFY] 新增 backupTab / configTab
    └── en_US/s3Backup.json      # [MODIFY] 新增 backupTab / configTab
```