# SuperPanel 样式文档

## 目录结构

```
styles/
├── index.scss      # 主入口文件，整合所有样式
├── variables.scss  # SCSS 变量定义
├── mixins.scss     # 可复用的 Mixins
├── feature-card.scss # 功能卡片样式
└── README.md       # 本文档
```

## 样式架构

### 1. 模块化设计
- 每个功能模块的样式独立管理
- 使用 `@use` 语法引入模块
- 避免样式冲突和重复

### 2. 变量系统
所有设计参数都提取为变量，便于统一维护：

- `$panel-width`: 面板宽度
- `$transition-*`: 动画时长
- `$z-*`: Z-index 层级
- `$btn-size-*`: 按钮尺寸
- `$spacing-*`: 间距规范

### 3. Mixins 复用
提供可复用的样式片段：

- `@mixin button-reset`: 按钮重置样式
- `@mixin scrollbar-thin`: 统一的滚动条样式
- `@mixin slide-down-animation`: 滑入动画
- `@mixin text-ellipsis`: 文本省略
- `@mixin flex-center`: 居中布局

### 4. 响应式设计
使用断点 Mixins：

```scss
@include tablet-only {
  // 平板设备样式
}

@include mobile-only {
  // 手机设备样式
}
```

### 5. 主题适配
- 使用思源主题变量
- 支持深色/浅色模式
- 高对比度模式支持
- 减少动画模式支持

## 使用指南

### 修改样式
1. 在对应的 SCSS 文件中修改
2. 变量修改在 `variables.scss`
3. 新增样式添加到对应文件或新建文件

### 新增功能样式
1. 创建新的 SCSS 文件
2. 在 `index.scss` 中引入
3. 在组件中使用 `@use` 引入

### 注意事项
- 避免内联样式
- 使用 SCSS 变量而非硬编码值
- 保持命名一致性
- 注释说明特殊样式

## 优化成果

1. **模块化**: CSS 从 Vue SFC 中提取，便于维护
2. **SCSS 特性**: 使用变量、Mixins、嵌套等特性
3. **响应式**: 完善的移动端适配
4. **主题兼容**: 深色/浅色模式支持
5. **可维护性**: 清晰的文件组织和命名规范