# docs 索引

本目录的文档分三类，**状态决定位置**：

| 目录 | 放什么 | 判据 |
|---|---|---|
| `docs/参考/` | **长期技术参考**：API 用法、组件用法、规范、设计参考 | 内容与当前代码一致、仍被引用；会随代码更新 |
| `docs/` 根 | **未完成的计划 / 待办** | 有明确未做项，做完即归档；清单见下方「活跃文档」 |
| `docs/completed/` | **已归档**：审查报告、已失效的实现文档、已作废方向 | 结论已执行完 / 描述的实现已被重构替代；不再更新 |

> 与规则分片的关系：根目录的 `AGENTS.md` / `AGENTS_API.md` / `AGENTS_STYLE.md` / `AGENTS_ARCH.md` /
> `AGENTS_BUILD.md` / `AGENTS_I18N.md` 是**长期规则**，不适用本索引的归档规则，原地维护。
> 功能模块的 `src/features/*/README.md` 同样原地维护，不迁入 docs。

**当前 `docs/` 根下的活跃文档**：
- [plugin-persistence-audit.md](plugin-persistence-audit.md)（持久化审计：资产清单、写放大、SQLite 迁移 P0/P1、缺陷清单；状态：本轮修复项已落地，迁移待下一轮）

## 一、参考文档（`docs/参考/`，9 份）

| 文件 | 主题 | 被谁引用 |
|---|---|---|
| [ai-api-usage.md](参考/ai-api-usage.md) | **唯一** AI 调用参考：`aiApi.ts` 入口、标准/流式/思考模式/RAG/多轮、调用方清单 | `AGENTS.md`、`AGENTS_API.md`（共 8 处），强制规则要求新 AI 功能必须遵循 |
| [token-shorthand.md](参考/token-shorthand.md) | SCSS 设计 Token **短名体系**（`$s-*`/`$r-*`/`$t-*`…）与旧长名完整映射表 | `src/components/kit/variables.scss` 文件头；迁移旧名的唯一依据 |
| [mobile-ui-density.md](参考/mobile-ui-density.md) | 移动端密度与触摸目标：GitHub/Primer 依据、桌面→移动数值表、伪元素命中区与断点约束 | `AGENTS_STYLE.md` § 移动端密度与触摸目标；`rssReader/README.md` |
| [思源笔记 API 使用.md](参考/思源笔记%20API%20使用.md) | 思源内核 API（公开/未公开）、请求响应约定、写入文件等用例 | 功能开发查内核接口时 |
| [floating-toolbar-development.md](参考/floating-toolbar-development.md) | 浮动工具栏模块架构（动态注册、功能项管理、`src/features/floatingToolbar/`） | — |
| [IconWrapper.README.md](参考/IconWrapper.README.md) | `IconWrapper` 图标组件用法（封装 `@iconify/vue`、样式与错误处理） | — |
| [斜杠命令说明.md](参考/斜杠命令说明.md) | 斜杠命令模块（`src/commands/`）与已支持命令清单 | — |
| [codex-ui-reference.html](参考/codex-ui-reference.html) | Codex UI 视觉参考页（静态 HTML，供截图/对照） | — |
| [persistence.md](参考/persistence.md) | 持久化规范：分层判据、槽位命名与生命周期、存储注册表、备份还原契约、一次性迁移、新增槽位 checklist | `AGENTS.md` § 持久化规范（强制） |

## 二、归档文档（`docs/completed/`，16 份）

前 11 份为 2026-10-28 提交 `caec10a5`「chore(docs): 清理过期审查报告并归档参考文档至参考目录」删除的审查报告，
2026-11-01 从 git 历史恢复——**原因是代码/README 仍在引用它们**（引用点已改为指向本目录）；
后 5 份是执行完成后按规则 2 归档的审查/计划文档（2026-11-05 至 2026-11-09）。

| 文件 | 主题 | 引用点 |
|---|---|---|
| [gitPush-memory-cpu-review.md](completed/gitPush-memory-cpu-review.md) | gitPush 内存/CPU 专项审查（P0-3 轮询风暴等） | `gitPush/README.md` ×2 + 源码注释 6 处 |
| [super-panel-code-review.md](completed/super-panel-code-review.md) | 超级面板代码审查（P1-1 密钥丢失、P2-1 加密风暴等） | `superPanel` 组件注释 ×4 |
| [sqlite-persistence-review.md](completed/sqlite-persistence-review.md) | SQLite 持久化迁移与实测数据 | `AGENTS.md` § SQLite 存储规范 |
| [everything-search-redundancy-review.md](completed/everything-search-redundancy-review.md) | everywhereSearch 冗余与安全整改 | `everythingSearch/README.md` |
| [component-preview-memory-diagnosis.md](completed/component-preview-memory-diagnosis.md) | 组件预览面板内存异常诊断 | `componentPreview/README.md` |
| [script-launcher-code-review.md](completed/script-launcher-code-review.md) | 脚本启动器代码审查 | — |
| [rss-reader-code-review.md](completed/rss-reader-code-review.md) | RSS 阅读器代码审查 | — |
| [bookmark-marker-component-audit.md](completed/bookmark-marker-component-audit.md) | 书签标记组件审计 | `bookmarkMarker/README.md` |
| [ai-content-generator-component-audit.md](completed/ai-content-generator-component-audit.md) | AI 内容生成组件审计（含验收清单） | `aiContentGenerator/README.md` |
| [ai-content-generator-skills-merge-review.md](completed/ai-content-generator-skills-merge-review.md) | AI 技能合并专项审查 | `aiContentGenerator/README.md` |
| [highlight-feature.md](completed/highlight-feature.md) | 双击高亮功能实现（**描述的实现已于 `7ac8100c` 并入 `generalSettings/components/HighlightSettings.vue`**） | — |
| [mobile-dock-compatibility-plan.md](completed/mobile-dock-compatibility-plan.md) | 侧边栏 Dock 移动端兼容计划与执行记录（P0–P3 已落地，P4 真机回归由用户执行） | 无源码引用；规则落在 `DESKTOP_ONLY_FEATURE_IDS`、`.vp-dock-panel` 与各功能 README「平台支持」 |
| [DOC-FIX-PLAN-2026-11-01.md](completed/DOC-FIX-PLAN-2026-11-01.md) | 文档缺陷修复（DOC-1 `AGENTS_STYLE.md` Token 短名迁移、DOC-2 注释路径、DOC-4 分片指引；DOC-3 明确不恢复） | `AGENTS.md` § 文档规范「Token 名真源」、[token-shorthand.md](参考/token-shorthand.md) |
| [持久化治理与统一数据管理面板.md](completed/持久化治理与统一数据管理面板.md) | 持久化治理实施记录（Phase 0–4 落地：规则文档、注册表与审计、基础设施修复、`storageManager` 面板；Phase 5 SQLite 迁移按约定未执行） | [plugin-persistence-audit.md](plugin-persistence-audit.md) §4、`AGENTS.md` § 持久化规范、[persistence.md](参考/persistence.md) |
| [gitPush-accordion-review.md](completed/gitPush-accordion-review.md) | gitPush 手风琴模式审查与实施记录（整行列表/键盘可达/变更徽章/草稿保留 + E1/E3/E4/E5/B6/B7） | 无源码引用；行为约定落在 `src/features/gitPush/README.md` 卡片布局条目 |
| [gitPush-detailed-mode-review.md](completed/gitPush-detailed-mode-review.md) | gitPush 详细模式审查与实施记录（网格几何/操作栏位置/分支折叠/刷新节流/页签高度/紧凑密度；E2/E3 等未做） | 无源码引用；行为约定落在 `src/features/gitPush/README.md` 卡片布局条目 |

**源码注释里的旧路径**：`src/features/gitPush/*.ts|vue`（6 处）、`src/features/superPanel/*.vue`（4 处）等
仍写着 `docs/xxx-review.md`。这些是纯文本引用（不是可点链接），**本轮未改源码**；
需要查时按上表的文件名到 `docs/completed/` 下取。

## 三、未恢复台账（仍可从 git 取回）

同一批次删除、且**当前无任何引用**的 10 份，未恢复（避免重新堆积）。需要时用：
`git show caec10a5^:docs/<文件名> > docs/completed/<文件名>`

| 文件名 | 行数 | 推测主题 |
|---|---|---|
| `hardcode-audit.md` | 894 | 硬编码值全量审计 |
| `shared-component-usage-audit.md` | 666 | 共享组件使用审计 |
| `s3-file-manager-redundancy-review.md` | 535 | S3 文件管理器冗余审查 |
| `disk-browser-redundancy-review.md` | 358 | 磁盘浏览器冗余审查 |
| `i18n-split-implementation.md` | 358 | i18n 拆分实施记录 |
| `resource-manager-redundancy-review.md` | 325 | 资源管理器冗余审查 |
| `s3-file-manager-fallback-audit.md` | 317 | S3 回退链路审计 |
| `gitPush-query-scheduling-review.md` | 270 | gitPush 查询调度审查 |
| `compile-time-type-assertion.md` | 257 | 编译期类型断言方案 |
| `codeblock-styles-conflict-review.md` | 144 | 代码块样式冲突审查 |

更早删除的四批（共 10 份，已被后续实现覆盖）：`8243bb7c`（2026-10-19，gitPush 分项审查 4 份 +
`shortcut-refactor-spec.md` + `statusBar-redundancy-review.md`）、`4fee391a`（2026-09-09，2 份）、
`a18c4794`（2026-05-27，`SETTINGS_GUIDE.md`）、`a4786fa0`（2026-05-26，`primevue的组件参考.md`）。
取回方式同上，把 `caec10a5^` 换成对应提交的父提交（`<sha>^`）。

## 四、文档缺陷台账（已清零）

> 修复过程与验收脚本见 [completed/DOC-FIX-PLAN-2026-11-01.md](completed/DOC-FIX-PLAN-2026-11-01.md)，
> 本表只记状态。**新增缺陷按同样格式登记，修完把状态改为「已修（日期）」，不要在这里补方案细节。**

| ID | 缺陷（一句话） | 状态 |
|---|---|---|
| DOC-1 | `AGENTS_STYLE.md` 设计 Token 名 100% 失效（60 个未定义名） | ✅ 已修（2026-11-06，全量迁移短名制，旧名 0 残留） |
| DOC-2 | `variables.scss` 文件头注释的 `docs/token-shorthand.md` 路径失效 | ✅ 已修（2026-11-06） |
| DOC-3 | 10 份被删除的审查报告未归档（本文件第三节台账） | 台账已建，**不计划恢复**（明确不做） |
| DOC-4 | `AGENTS_BUILD.md` 要求登记审查报告但原无命名/归档约定 | ✅ 已修（2026-11-06，补分片指引） |

## 五、强制规则（2026-11-01 起生效）

1. **位置由状态决定**：`docs/参考/` = 仍准确的长期参考；`docs/` 根 = 未完成的计划/待办；
   `docs/completed/` = 已完成/已失效/已作废。**新建计划默认放 `docs/` 根**，不得预先放进 `completed/`。
2. **归档 ≠ 删除**。文档失效时用 `git mv` 移入 `docs/completed/`，文件头加
   `> **归档说明（日期）**：为什么归档 + 被什么替代 + 是否还有效`。**禁止**直接 `rm`——
   本次 10 份报告被删后仍有 23 处引用，就是反例。
3. **归档前先查引用**：`grep -rn "docs/<文件名>"` 确认没有代码/README 依赖；有依赖的必须先改引用
   （改完复检断链），或先恢复再归档。
4. **一个结论只写一处**：同一份清单/流程/数字不在多处重复，引用写 `见 xxx.md §y`。
   规则分片（`AGENTS_*.md`）负责规则，`docs/` 负责背景与记录，两者不互相抄。
5. **增删改必须同步本文索引**。新增 docs 文档、归档、恢复，都要更新对应表格。
6. **审查报告命名**：`<模块>-<类型>.md`（类型：`review` 审查 / `audit` 审计 / `diagnosis` 诊断），
   放 `docs/` 根，处理完后按第 2 条归档。

## 六、写作约定

- 文档头写清：日期、审查/描述对象（具体到文件）、依据、方式（静态走查 or 实测）。
- 涉及结论的必须给证据定位（文件:行号 或 命令输出），行号要带版本/提交基线。
- 未验证的结论标"未验证"，不得写成事实。
