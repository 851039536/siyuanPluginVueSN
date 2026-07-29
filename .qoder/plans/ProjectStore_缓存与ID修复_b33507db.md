# ProjectStore 缓存与 ID 修复

## 范围
仅修改 `src/features/gitPush/managers/ProjectStore.ts`。外部方法签名与返回类型不变，上层 `useProjectCrud` 无需改动（已验证其只读返回值判空/取 tags，`refreshRemotes` 整体接收对象，返回克隆对象兼容）。

## #1 缓存引用泄漏 + save 失败脏缓存（核心）

根因：写方法通过 `await this.getProjects()` 拿到 `projectsCache` 的**同一引用**，在 `save` 之前就地 mutate；save 抛错时缓存已脏且不回滚，且被 mutate 的对象通过返回值泄漏到 UI。

修复方案——引入可写副本，写操作全程基于克隆，save 成功后才失效缓存：

- 新增私有方法：
  ```ts
  /** 获取项目列表的可写浅克隆副本（写操作基于此，避免污染缓存 + save 失败时缓存变脏） */
  private async getProjectsForWrite(): Promise<GitProject[]> {
    const projects = await this.getProjects()
    return projects.map((p) => ({ ...p }))
  }
  ```
  浅克隆即可：现有所有 mutation 都是替换引用（`tags = [...]`、`categoryId =`、`starred =`、`Object.assign(project, patch)`、`applyRemotesToProject` 内的字段赋值），从不就地改嵌套数组/对象，故不共享写。

- 将以下写方法内的 `await this.getProjects()` 全部替换为 `await this.getProjectsForWrite()`：
  `addProject` / `removeProject` / `updateProjectMeta` / `toggleStar` / `appendTag` / `removeTag` / `recordLastActivity` / `refreshRemotes` / `deleteCategory`(其中 `projs`) / `moveProject`
- `addProject` 的 `projects.push(project)` 相应作用于克隆数组
- `syncGlobalTags`（只读遍历）保持用 `getProjects()` 不变
- 保持各方法结尾 `save(...)` 成功后再 `invalidateProjectCache()` 的现有顺序：save 抛错时因未触碰 `projectsCache`，缓存自动保持一致

## #2 moveProject 目标分类校验（防悬空）

当前 [moveProject](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/ProjectStore.ts#L298-L305) 不校验 categoryId 存在性，传入无效分类会让项目从所有可见分类消失。

修复：
```ts
async moveProject(projectId: string, categoryId: string): Promise<void> {
  // 目标分类不存在时不移动（UNGROUPED_ID 恒有效），维持"项目分类始终指向有效分类或未分组"不变式
  if (categoryId !== UNGROUPED_ID) {
    const cats = await this.getCategories()
    if (!cats.some((c) => c.id === categoryId)) return
  }
  const projs = await this.getProjectsForWrite()
  const p = projs.find((x) => x.id === projectId)
  if (!p || p.categoryId === categoryId) return   // 顺带幂等短路：未变化不写
  p.categoryId = categoryId
  await this.storage.projects.save(projs)
  this.invalidateProjectCache()
}
```

## #4 分类 ID 同毫秒碰撞

[addCategory](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/ProjectStore.ts#L262-L268) 用裸 `Date.now().toString()`，快速连续新增会生成重复 ID。改为复用项目 ID 的防碰撞方案：
```ts
idCounter++
const cat: ProjectCategory = { id: `${Date.now().toString(36)}-${idCounter}`, name, color, order: cats.length }
```
已存储的旧分类 ID 是不透明字符串，保持原值即可，无需迁移。

## 验证
- 由用户执行 `npx tsc --noEmit` 类型检查（按项目约定，AI 不运行 lint/build）
- 手动回归：连续新增分类 ID 唯一；移动项目到无效分类不消失；模拟 save 失败后缓存/UI 一致

## 不在本次范围
- #3(moveProject/updateCategory 幂等)：moveProject 幂等已在 #2 顺带加入；updateCategory 暂不动
- #5/#6/#7：分类缓存、detectRemotes fetch 判定、idCounter 提升为静态字段——低优先级，未纳入
