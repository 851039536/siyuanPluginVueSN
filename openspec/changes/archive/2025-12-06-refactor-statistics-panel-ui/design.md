# 设计文档: StatisticsPanel.vue 重构

## 架构决策

### 1. 配置管理
在 `src/config/settings.ts` 中添加新的配置项：
```typescript
interface PluginSettings {
  // 现有配置...
  statisticsTheme: 'default' | 'github'  // 统计面板主题风格
}
```

默认值：`'default'`

### 2. 主题切换实现
- 使用Vue的响应式数据管理主题状态
- 通过CSS类切换实现视觉风格变更
- 使用思源API (`plugin.saveData`/`plugin.loadData`) 进行持久化

### 3. UI简化策略

#### 移除的组件
1. **热门标签云** (`.tag-cloud-section`)
   - 移除整个section
   - 移除相关的数据获取逻辑
   - 移除相关样式

2. **最近活跃文档** (`.recent-docs-section`)
   - 移除整个section
   - 移除相关的数据获取逻辑
   - 移除相关样式

#### 保留的核心功能
1. 顶部卡片统计（主要和次要统计）
2. 扩展统计卡片（今日新增、今日修改、平均字数）
3. 视图模式切换
4. 图表展示（柱状图和数据列表）

### 4. GitHub风格设计

#### 色彩方案
- **默认风格**：保持现有的渐变色设计
- **GitHub风格**：
  - 背景：`var(--b3-theme-background)`
  - 卡片背景：`var(--b3-theme-surface)`
  - 边框：`var(--b3-border-color)`
  - 文字：`var(--b3-theme-on-background)`
  - 强调色：`#0969da` (GitHub蓝色)

#### 视觉元素
- 移除渐变背景，使用纯色和边框
- 调整阴影效果，使其更扁平
- 使用GitHub风格的圆角（6px）
- 优化间距和对齐

### 5. 主题切换UI

在统计面板顶部添加主题切换按钮：
```vue
<div class="theme-switcher">
  <button @click="toggleTheme" class="theme-toggle-btn">
    {{ currentTheme === 'default' ? '🌈' : '🐙' }}
    {{ currentTheme === 'default' ? '默认' : 'GitHub' }}
  </button>
</div>
```

## 数据流

1. 组件初始化时，从设置中加载 `statisticsTheme`
2. 用户点击主题切换按钮
3. 更新本地响应式状态
4. 调用思源API保存新设置
5. CSS类动态切换，UI实时更新

## 测试策略

1. **功能测试**：
   - 主题切换按钮可点击
   - 切换后视觉风格正确变化
   - 刷新页面后主题设置保持

2. **视觉测试**：
   - 默认风格：与原版一致
   - GitHub风格：符合GitHub设计规范
   - 在明暗主题下均可正常显示

3. **兼容性测试**：
   - 桌面端
   - 移动端
   - Web端

## 文件变更清单

### 修改文件
1. `src/features/statistics/StatisticsPanel.vue`
   - 移除热门标签云HTML和样式
   - 移除最近活跃文档HTML和样式
   - 添加主题切换按钮
   - 添加主题切换逻辑
   - 添加GitHub风格CSS

2. `src/config/settings.ts`
   - 添加 `statisticsTheme` 配置项

### 可选修改
3. `src/features/statistics/Statistics.ts`
   - 如果需要，可移除 `getTopTags` 和 `getRecentDocs` 调用
   - 保持代码整洁

## 向后兼容性

- 为现有用户自动应用默认主题
- 如果数据库中没有 `statisticsTheme` 设置，使用默认值 `'default'`
- 不影响其他插件功能
