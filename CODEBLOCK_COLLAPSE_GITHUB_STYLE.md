# 代码块折叠 GitHub 风格优化

## 更新内容

已将 CodeBlockSettings.vue 的折叠效果优化为 GitHub 风格，主要改进：

### 1. 移除遮罩层
- 去掉了原来的半透明遮罩背景
- 采用更自然的渐变过渡效果

### 2. 简洁的展开按钮
- 按钮位于代码块底部中央
- 采用 GitHub 风格的简洁设计
- 包含向下箭头图标和文字提示

### 3. 优化的视觉效果
- 渐变背景从透明到实色，更加自然
- 按钮悬停效果更加细腻
- 点击展开时有平滑的动画过渡

### 4. 国际化支持
- 添加了 `expandCode` 翻译
- 中文：展开代码
- 英文：Expand Code

## 样式特点

```css
/* 渐变背景 - 70px 高度 */
background: linear-gradient(to bottom, 
  transparent 0%, 
  rgba(background, 0.7) 30%,
  rgba(background, 0.95) 70%,
  rgba(background, 1) 100%
);

/* 按钮样式 - 简洁扁平 */
padding: 5px 14px;
border: 1px solid rgba(on-surface, 0.15);
border-radius: 6px;
font-size: 12px;
```

## 交互效果

1. **悬停效果**：边框颜色加深，背景变化，轻微阴影
2. **点击效果**：按钮缩小，渐隐消失
3. **展开动画**：代码块高度平滑过渡到完整高度（0.4s）

## 使用方式

在代码块设置中：
1. 启用"代码块折叠"开关
2. 设置折叠高度（默认 400px）
3. 超过设置高度的代码块会自动显示展开按钮

## 技术实现

- 使用 CSS 渐变替代遮罩层
- SVG 图标内联，无需外部依赖
- 动画使用 cubic-bezier 缓动函数
- 支持深色/浅色主题自动适配
