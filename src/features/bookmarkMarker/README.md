# 书签标记

根据文档书签内容在文件树中显示颜色标记，支持自定义规则、图标和显示模式。

## 功能

- 按书签名精确/前缀/包含匹配规则，为文件树节点与文档标题区添加徽章或行样式
- 规则支持文字标签、仅图标、图标+背景、字体背景四种显示模式，可调透明度
- 书签名支持多标签输入（回车或逗号快捷添加、空输入退格删末项），内置预设 emoji 字形
- 文字色/背景色用自绘调色板取色（思源 Electron 下原生 `input[type=color]` 不弹窗）
- 周期性自动刷新书签数据，MutationObserver 监听文件树与 protyle 变更

## 容错与健壮性

- 非法 hex 颜色回退为透明，避免生成 `rgba(NaN,...)` 无效样式；支持 `#rgb` 与 `#rrggbb` 两种写法
- 规则归一化走字段白名单 + 类型守卫，过滤空书签名与无书签名的空规则（避免 `contains` 模式误匹配）
- 书签查询失败时记录日志并跳过本轮标记应用（`cacheLoaded` 保持 `false`），异步链路不再产生 unhandled rejection
- `startAutoUpdate` 带防御性清理，防止异常路径下重复 interval；`setUpdateInterval` 等值短路
- 规则列表以**规则对象身份**作 `v-for` key，删除中间规则时不会复用子组件实例导致调色板状态错位

## 目录

```
bookmarkMarker/
├── index.ts                  # BookmarkMarkerManager：设置加载、变更调度（判别联合载荷）、挂载 __bookmarkMarker
├── index.vue                 # 设置面板：功能开关 + 规则列表 + 更新间隔
├── utils.ts                  # hex 转换、规则归一化、匹配、标记创建等纯工具函数
├── modules/
│   └── BookmarkMarker.ts     # 书签查询缓存、DOM/protyle 标记应用（通用遍历与 apply/remove 复用）
├── composables/
│   └── useBookmarkMarkerSettings.ts  # 设置面板状态与持久化
├── types/
│   ├── index.ts              # 类型、共享常量（DisplayMode / MatchMode / RulePatch / i18n 接口 / 间隔选项）
│   └── storage.ts            # TypedStorage 存储槽
├── components/
│   ├── RuleItem.vue          # 单条规则卡片：卡片壳 + 字段组装 + 效果预览
│   └── ruleItem/
│       ├── TagInputField.vue    # 书签名多标签输入（共享 Tag chips + 无边框 Input）
│       ├── IconSelectField.vue  # 图标名输入 + 预设字形网格
│       └── ModeGroupField.vue   # 通用单选分段组（显示模式 / 匹配模式共用）
└── styles/                   # index / RuleItem / RuleItemTagInput / RuleItemIconField / RuleItemModeGroup
```

## UI 层约定

### 统一使用共享组件库（`src/components/`）

| 场景 | 共享组件 |
| --- | --- |
| 关闭面板 / 添加规则 / 删除规则 / 预设字形选择 | `Button`（纯图标按钮均带 `aria-label`） |
| 更新间隔下拉 | `Select`（标签经 `label` prop 渲染，选中态与空态复用组件内置逻辑） |
| 书签名内联输入 / 图标名输入 | `Input`（chips 内嵌场景用 `borderless` 去掉边框底色） |
| 书签名 chips | `Tag`（`size="xsmall"` + `variant="primary"` + `closable`） |
| 字段行标签（8 处） | `Label`（`size="small"` + `width="70px"`） |
| 背景透明度 | `Slider`（`min=0 max=1 step=0.05` + `show-value` + `formatValue` 输出百分比） |
| 显示模式 / 匹配模式 | `ModeGroupField` → 共享 `Button` 的 `text` 外观 + `variant` 切换选中态（分组容器保留为纯布局） |
| 文字色 / 背景色 | 共享 `ColorField`（自绘 32 色调色板） |
| 图标 | `IconWrapper` + `src/config/icons.ts` 的 `IconKey` |

**合规例外**：`IconSelectField.vue` 的 `PRESET_ICONS`（39 个 emoji）是**用户可选的标记字形（业务数据）**，最终由 `createMarkerElement` 以 `textContent` 写入思源文件树/文档标题，不是插件 UI 图标；选择这些字形的**按钮本身**仍由共享 `Button` 承载（emoji 作为按钮文本内容）。

### 数据流契约（`RuleItem` ↔ `index.vue`）

规则卡片**不直接改写**父级传入的规则对象，改走双事件契约：

| 事件 | 语义 | 典型时机 |
| --- | --- | --- |
| `patch(payload)` | 父级在自有规则对象上 `Object.assign`，**仅内存生效** | 文本逐字输入、滑块拖动中 |
| `commit()` | 父级落盘 + 通知 `BookmarkMarkerManager` + 弹提示 | 输入框 blur/回车、滑块松手、调色板选色 |
| `remove()` | 父级按对象身份 `indexOf` 定位删除 | 点击卡片删除按钮 |

该契约同时消除了「滑块拖动时逐像素写盘 + 提示刷屏」。

### 文案（i18n）

- UI 文案走 `src/i18n/{zh_CN,en_US}/bookmarkMarker.json`（**扁平无前缀**键名，如 `bookmarkMarkerTitle`、`markerUpdateInterval`）
- 只改分片文件；顶层 `zh_CN.json` / `en_US.json` 由 `pnpm i18n:merge` 生成，禁止手改
- 模块 i18n 形状在 `types/index.ts` 的 `BookmarkMarkerI18n` 中声明，`index.ts` 兼容「扁平（当前）」与「嵌套 `bookmarkMarker` 子对象」两种合并结构
- **不纳入 i18n 的中文**：`console.*` 日志、规则默认值的业务语义

## 验证

```bash
pnpm lint            # ESLint 代码规范
pnpm i18n:verify     # 中英文键对齐
pnpm validate:icons  # 图标注册有效性
npx tsc --noEmit     # TypeScript 类型检查
```

人工回归要点见 `docs/bookmark-marker-component-audit.md` 的「验收清单」。
