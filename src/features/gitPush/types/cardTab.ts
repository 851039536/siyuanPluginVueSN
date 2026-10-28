// gitPush 卡片面板 Tab 标识（CardTabs 渲染与 ProjectCard 状态共用，避免 .ts 反向依赖 .vue）
/** 卡片面板 Tab ID（与 CardTabs 插槽名同值域） */
export type CardTabId = "worktree" | "log" | "stash" | "tag"
