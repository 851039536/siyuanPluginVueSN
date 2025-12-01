# HeadingSettings 重启失效问题修复

## 问题描述
HeadingSettings.vue 中的标题居中和颜色设置在重启程序后失效。用户需要打开设置页面才能使样式生效。

## 问题原因
1. **组件懒加载**: HeadingSettings 组件只有在用户打开设置面板时才会挂载和初始化
2. **样式应用时机**: 样式只在组件内部的 `applyToDocument()` 中应用，而不是在插件启动时应用
3. **缺少启动时初始化**: 插件的 `GeneralSettings` 类没有在启动时加载和应用标题设置

## 修复方案

### 1. 在插件启动时应用标题样式
在 `src/features/generalSettings/index.ts` 的 `GeneralSettings` 类中添加 `applyHeadingStyle()` 方法：

```typescript
/**
 * 初始化通用设置功能
 */
public init() {
  this.addDock();
  this.applySavedSettings(); // 应用已保存的设置
  this.applyCodeBlockStyle(); // 应用代码块样式
  this.applyListStyle(); // 应用列表样式
  this.applyHeadingStyle(); // 应用标题样式 ✨ 新增
  console.log('通用设置模块已初始化');
}

/**
 * 应用标题样式
 */
public applyHeadingStyle() {
  try {
    const saved = localStorage.getItem('general-heading-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      this.applyHeadingStyles(settings);
      console.log('标题样式已从localStorage加载并应用:', settings);
    }
  } catch (error) {
    console.error('应用标题样式失败:', error);
  }
}
```

### 2. 实现标题样式应用逻辑
添加 `applyHeadingStyles()` 和 `generateLevelDisplayCss()` 方法，与 HeadingSettings.vue 中的逻辑保持一致：

```typescript
private applyHeadingStyles(settings: any) {
  // 创建或获取样式元素
  const style = document.getElementById('heading-colors-style') || document.createElement('style');
  style.id = 'heading-colors-style';

  // 生成颜色、层级显示、居中、标题颜色等CSS
  const colorCss = /* ... */;
  const levelCss = /* ... */;
  const centerAlignCss = /* ... */;
  const titleColorCss = /* ... */;

  style.textContent = colorCss + levelCss + centerAlignCss + titleColorCss;
  
  if (!style.parentElement) {
    document.head.appendChild(style);
  }
}
```

### 3. 组件内优化（已完成）
- 使用 `onMounted` 生命周期钩子确保 DOM 准备好
- 添加详细的日志输出便于调试
- 移除未使用的导入

## 测试步骤

1. **设置标题居中和颜色**
   - 打开通用设置 → 标题配置
   - 启用"标题居中显示"
   - 修改"文档标题颜色"为自定义颜色（如 #FF5733）
   - 可选：设置标题层级显示（如"数字标记"）
   - 可选：修改 H1-H6 的颜色

2. **保存并重启**
   - 关闭思源笔记
   - 重新打开思源笔记

3. **验证设置是否在启动时生效** ✨ 关键测试点
   - **不要打开设置面板**
   - 直接打开任意文档
   - 检查文档标题是否居中
   - 检查文档标题颜色是否为设置的颜色
   - 检查 H1-H6 标题颜色是否正确
   - 检查标题层级显示是否正确

4. **检查控制台日志**
   - 打开开发者工具（F12）
   - 在插件启动时查看控制台日志：
     - "通用设置模块已初始化"
     - "标题样式已从localStorage加载并应用: {...}"
   - 如果打开设置面板，还会看到：
     - "HeadingSettings 组件已挂载，开始加载设置"
     - "已加载设置: {...}"
     - "HeadingSettings 样式已应用"

## 技术细节

### localStorage 存储结构
```json
{
  "style": "default",
  "colors": {
    "h1": "#F39A94",
    "h2": "#F8D694",
    "h3": "#B1DCB9",
    "h4": "#AAD2FC",
    "h5": "#AC9DC0",
    "h6": "#D7D7D7"
  },
  "levelDisplay": "none",
  "customMarkers": ["1", "2", "3", "4", "5", "6"],
  "titleCenterAlign": true,
  "titleColor": "#FF5733"
}
```

### CSS 样式应用
样式通过动态创建 `<style>` 标签注入到 `<head>` 中：
```css
/* 标题居中 */
.protyle-title__input {
  text-align: center !important;
}

/* 文档标题颜色 */
.protyle-title__input {
  color: #FF5733 !important;
}
```

## 预期效果
- ✅ 设置在重启后正确加载
- ✅ 样式在插件启动时立即应用（无需打开设置面板）
- ✅ 控制台有清晰的日志输出
- ✅ 用户体验流畅，无需手动重新设置
- ✅ 标题居中、颜色、层级显示等所有设置都能在启动时生效

## 关键修复点

### 1. 布尔值加载问题
**问题**: 使用 `||` 运算符导致 `false` 值被错误处理
```typescript
// ❌ 错误：当 titleCenterAlign 为 false 时，会被正确处理，但代码不够清晰
titleCenterAlign.value = parsed.titleCenterAlign || false

// ✅ 正确：使用 ?? 空值合并运算符
titleCenterAlign.value = parsed.titleCenterAlign ?? false
```

### 2. 标题颜色应用逻辑
**问题**: 标题颜色的应用错误地依赖于居中设置
```typescript
// ❌ 错误：只有启用居中时才应用颜色
const titleColorCss = titleCenterAlign.value ? `...` : ''

// ✅ 正确：标题颜色独立于居中设置
const titleColorCss = titleColor.value ? `...` : ''
```

## 架构改进
通过这次修复，建立了更好的设置管理模式：
1. **双重应用机制**: 插件启动时应用 + 组件挂载时应用
2. **统一管理**: 所有通用设置（字体、代码块、列表、标题）都在 `GeneralSettings` 类中统一管理
3. **持久化存储**: 使用 localStorage 保存设置，确保重启后恢复
4. **即时生效**: 用户修改设置后立即应用，无需刷新页面
5. **详细日志**: 添加完整的日志输出，便于调试和问题排查
