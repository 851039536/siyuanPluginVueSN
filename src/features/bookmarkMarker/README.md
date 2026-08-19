# 书签标记

根据文档书签内容在文件树中显示颜色标记，支持自定义规则、图标和显示模式。

## 功能

- 按书签名精确/前缀/包含匹配规则，为文件树节点与文档标题区添加徽章或行样式
- 规则支持文字标签、仅图标、图标+背景、字体背景四种显示模式，可调透明度
- 书签名支持多标签输入（回车或逗号快捷添加），内置预设 emoji 图标
- 周期性自动刷新书签数据，MutationObserver 监听文件树与 protyle 变更

## 容错与健壮性

- 非法 hex 颜色回退为透明，避免生成 `rgba(NaN,...)` 无效样式
- 规则归一化时过滤空书签名与无书签名的空规则，避免 `contains` 模式误匹配
- `startAutoUpdate` 带防御性清理，防止异常路径下重复 interval

## 目录

- `index.ts` — Manager：设置加载、开关/规则变更调度，挂载 `__bookmarkMarker`
- `modules/BookmarkMarker.ts` — 书签查询缓存、DOM/protyle 标记应用（通用遍历与 apply/remove 复用）
- `composables/useBookmarkMarkerSettings.ts` — 设置面板状态与持久化
- `components/RuleItem.vue` — 单条规则编辑器（标签/颜色/模式/透明度/匹配）
- `types/` — 类型定义、DOM 常量与 TypedStorage 存储槽
- `utils.ts` — hex 转换、规则归一化、匹配、标记创建等纯工具函数
