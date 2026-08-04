---
name: everythingSearch-空文件夹筛选
overview: 为 everythingSearch 功能增加"空文件夹"筛选开关：开启后搜索仅显示空文件夹，并自动排除系统关键路径下的结果，防止误删系统文件导致系统异常。
todos:
  - id: extend-options-types
    content: 在 types/index.ts 与 types/storage.ts 中为 SearchOptions 增加 emptyFoldersOnly 字段及默认值
    status: completed
  - id: add-system-path-guard
    content: 在 api.ts 实现 SYSTEM_ROOT_DIRS 常量与 isSystemPath 系统路径判断纯函数
    status: completed
  - id: add-ui-switch
    content: 在 SearchOptions.vue 新增「空文件夹」开关并补充中英文 i18n 键，用 [skill:codex-ui-style-guide] 校验风格合规
    status: completed
    dependencies:
      - extend-options-types
  - id: integrate-search-logic
    content: "在 index.vue 的 handleSearch 中拼接 empty: 查询语法并在结果中过滤系统路径空文件夹"
    status: completed
    dependencies:
      - add-system-path-guard
      - add-ui-switch
---

## 用户需求

为 everythingSearch（Everything 本地搜索）功能增加「空文件夹筛选」能力：

- 在搜索选项中新增「空文件夹」开关，开启后仅显示空文件夹（使用 Everything 的 `empty:` 搜索语法）
- 搜索结果**自动排除系统关键目录**下的空文件夹（如 `\Windows\`、`\Program Files\`、`\ProgramData\` 等），防止用户误删系统文件导致系统异常
- 仅负责筛选展示，不新增批量删除能力，删除沿用现有逐条删除按钮

## 核心功能

- 搜索选项区新增「空文件夹」Switch 开关，即时生效并持久化到插件存储
- 开启后搜索查询自动追加  `empty:` 语法，仅匹配空文件夹
- 结果返回后过滤掉系统关键目录下的空文件夹（盘符无关的一级目录匹配）
- 中英文双语 i18n 文案补齐

## 技术栈

沿用项目现有技术栈：Vue 3 + TypeScript + SCSS（Codex UI 风格），通过 Everything HTTP API 搜索，TypedStorage 持久化选项。不引入新依赖。

## 实现方案

### 1. 数据层（类型与默认值）

- `src/features/everythingSearch/types/index.ts`：`SearchOptions` 接口新增 `emptyFoldersOnly: boolean`
- `src/features/everythingSearch/types/storage.ts`：`DEFAULT_OPTIONS` 新增 `emptyFoldersOnly: false`
- 依赖 `TypedStorage.loadOrDefault()` 的自动合并机制，存量用户无需数据迁移即可获得默认值

### 2. 系统路径保护工具函数

- `src/features/everythingSearch/api.ts` 新增模块级常量 `SYSTEM_ROOT_DIRS`（小写一级目录名列表：`windows`、`program files`、`program files (x86)`、`programdata`、`$recycle.bin`、`system volume information`、`recovery`、`boot`、`perflogs` 等）与纯函数 `isSystemPath(fullPath: string): boolean`
- 实现方式：正则 `/^[a-zA-Z]:\\([^\\]+)\\/` 提取盘符后的一级目录名并小写比对常量列表——盘符无关（可同时保护系统盘与非系统盘上的系统目录），且避免误伤 `D:\mywindows\` 这类用户目录
- 纯字符串判断，无文件系统 I/O，不会因系统文件访问引发异常

### 3. UI 层（开关 + i18n）

- `src/features/everythingSearch/components/SearchOptions.vue`：行1 开关组新增「空文件夹」Switch（`size="xsmall"`，与现有开关一致），emit `update:options('emptyFoldersOnly', $event)`，开关标签上方加中文 HTML 注释
- `src/i18n/zh_CN/everythingSearch.json`：新增 `emptyFolders: "空文件夹"`
- `src/i18n/en_US/everythingSearch.json`：新增 `emptyFolders: "Empty folders"`
- 沿用现有 `handleOptionUpdate` 机制，开关变更后自动触发即时重搜（有搜索词时）

### 4. 逻辑集成

- `src/features/everythingSearch/index.vue` 的 `handleSearch()`：
- `options.emptyFoldersOnly` 开启时，query 追加  `empty:`（与现有 `size:` 过滤拼接逻辑保持一致）
- 结果返回后过滤：`results.filter((item) => !(options.emptyFoldersOnly && item.type === "folder" && isSystemPath(getFullPath(item))))`，仅空文件夹筛选模式下排除系统路径，不影响其他搜索模式的既有行为
- 大小过滤与空文件夹同时开启时（`empty:` + `size:>`）可能无结果，属合理语义，不做特殊处理

## 性能与可靠性

- 过滤为 O(n) 线性扫描 + 单次正则解析，结果上限 `maxResults`（默认 100 条），开销可忽略
- 无新增 I/O、无新增日志、无定时器，不引入资源生命周期问题
- 系统路径过滤仅为展示层保护，删除操作仍走现有 `trashItem`（回收站），双重保障下不会因系统文件导致系统异常

## 目录结构

```
src/features/everythingSearch/
├── types/
│   ├── index.ts                    # [MODIFY] SearchOptions 新增 emptyFoldersOnly 字段
│   └── storage.ts                  # [MODIFY] DEFAULT_OPTIONS 新增 emptyFoldersOnly: false
├── api.ts                          # [MODIFY] 新增 SYSTEM_ROOT_DIRS 常量 + isSystemPath() 纯函数
├── components/
│   └── SearchOptions.vue           # [MODIFY] 行1 开关组新增「空文件夹」Switch
└── index.vue                       # [MODIFY] handleSearch() 拼接 empty: 语法 + 结果过滤系统路径
src/i18n/
├── zh_CN/everythingSearch.json     # [MODIFY] 新增 emptyFolders 键
└── en_US/everythingSearch.json     # [MODIFY] 新增 emptyFolders 键
```

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：修改 SearchOptions.vue（新增开关）时校验 Codex UI 风格合规性（Switch 尺寸、i18n 模板注释、事件命名 camelCase、SCSS 提取与 Token 使用）
- 预期结果：新增开关组件与相关样式完全符合项目 Codex UI 规范，无硬编码尺寸/字体违规