# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

基于 Vite + Vue 3 + TS 构建的思源笔记插件模板。采用基于功能的模块化架构。

## 常用开发命令

### 开发工作流

```bash
# 安装依赖
pnpm install

# 启动开发模式（监听模式 + 热重载）
# 当配置了 VITE_SIYUAN_WORKSPACE_PATH 时，自动构建到思源工作区
pnpm dev

# 生产构建（输出到 ./dist 并创建 package.zip）
pnpm build
```


### 版本发布管理

```bash
# 自动版本递增和打包
pnpm release:patch   # 0.0.1 -> 0.0.2
pnpm release:minor   # 0.0.1 -> 0.1.0
pnpm release:major   # 0.0.1 -> 1.0.0
pnpm release:manual  # 手动输入版本
```

脚本自动执行：

1. 更新 package.json 和 plugin.json 版本号
2. 创建 git 标签
3. 构建生产版本
4. 生成 `package.zip` 用于分发

## 项目架构

### 高层结构

```
src/
├── features/          # 功能模块（模块化架构）
│   ├── superPanel/           # 统一入口面板，模块功能开关集成。
│   ├── tableOfContents/      # 文档目录
│   ├── docNavigation/        # 文档层级导航
│   ├── wordQuery/            # 单词查询
│   ├── generalSettings/      # 通用设置
│   ├── aiContentGenerator/   # AI 内容生成
├── components/        # 共享 Vue 组件
├── config/            # 配置管理
├── commands/          # 斜杠命令
├── api.ts             # Siyuan API 封装
├── index.ts           # 插件入口点
└── main.ts            # Vue 应用初始化
```

### 开发参考

1. `src/index.ts`：插件入口主 `PluginSample` 类继承 Siyuan 的 `Plugin`
- 生命周期：`onload()`, `onunload()`

功能模块

- 每个功能都自包含在 `src/features/[feature-name]/` 中
- 功能导出 `register[FeatureName]()` 函数
- 功能根据 `plugin.settings` 条件性注册
- 所有功能从 `src/features/index.ts` 导出

配置管理 (`src/config/settings.ts`)

- 集中式设置接口：`PluginSettings`
- 独立设置：字体、列表、标题、代码块

Vue 应用结构

- 主应用在 `src/main.ts`（Vue 初始化）
- `src/App.vue`（根组件）
- 设置面板在 `src/components/SettingPanel.vue`
- 共享组件在 `src/components/`

国际化

- 语言文件：`src/i18n/zh_CN.json` 和 `src/i18n/en_US.json`
- 通过 `plugin.i18n.featureName.key` 访问
- json 格式 功能1:{xx:xx }，功能2:{xx:xx }这个方便分类

## 必须严格执行的规范

- 功能可见性：新功能必须在超级面板：SuperPanelView.vue 中提供开关设置
- 不要直接使用 SVG 文件，可使用 @iconify/vue
- 新功能必须使用技能： frontend-components 进行组件化。
- 如果是全局样式index.scss：导入方式 @use "@/index.scss" as *;
### 品牌设计规范

本项目使用 Anthropic 官方品牌色，所有新增页面必须遵守以下规范：

#### 品牌颜色（定义在 `src/_variables.scss`）

```scss
// 主色
$brand-dark: #141413         // 主文本、深色背景
$brand-light: #faf9f5        // 浅色背景、深色上的文本

// 灰度
$brand-mid-gray: #b0aea5     // 次要元素
$brand-light-gray: #e8e6dc   // 微妙背景

// 强调色
$brand-orange: #d97757       // 主强调色（按钮、链接、错误提示）
$brand-blue: #6a9bcc         // 次强调色
$brand-green: #788c5d        // 第三强调色
```

#### 品牌字体

```scss
// 品牌字体变量 - 现代字体栈，优化中文显示
$font-heading: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
$font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
```

#### 使用指南

1. 颜色使用
   - 主按钮/操作：`$brand-orange`
   - 次要按钮/信息：`$brand-blue`
   - 成功/完成：`$brand-green`
   - 错误/警告：`$brand-orange`（非红色）
   - 文本：`$brand-dark`
   - 副文本：`$brand-mid-gray`

2. 字体使用
   - 所有标题（h1-h6、表单 label、卡片标题）：`$font-heading`
   - 正文内容、描述文本：`$font-body`

3. 示例代码

```scss
// 新组件样式示例
.my-component {
  color: $brand-dark;
  font-family: $font-body;

  h2 {
    font-family: $font-heading;
    color: $brand-orange;
  }

  .button-primary {
    background: $brand-orange;
    color: $brand-light;
  }

  .button-secondary {
    background: $brand-blue;
    color: $brand-light;
  }

  .error-message {
    background: rgba(217, 119, 87, 0.1); // 品牌橙色淡化
    color: $brand-orange;
    border: 1px solid $brand-orange;
  }
}
```

## API参考

- 工作区路径：通过 `/api/system/getConf` 获取工作区路径
- 思源 API 使用：参考 `docs/思源笔记 API 使用.md` 文档
- 数据持久化：使用 `plugin.loadData()` 和 `plugin.saveData()` 方法，避免使用 localStorage，插件生成的数据将保存在 data/storage/petal/<name>/ 目录下。

## 开发指南

### 添加新功能

1. 创建功能目录： `src/features/myFeature/`
2. 实现功能： `src/features/myFeature/index.ts`

```typescript
import { Plugin } from 'siyuan'

export function registerMyFeature(plugin: Plugin) {
  plugin.addTopBar({
    icon: 'iconSettings',
    title: plugin.i18n.myFeature.title,
    callback: () => {
      // 功能逻辑
    }
  })
}
```

3. 在 `src/features/index.ts` 中导出

```typescript
export { registerMyFeature } from './myFeature'
```

4. 添加设置： `src/config/settings.ts`

```typescript
export interface PluginSettings {
  // ... 其他设置
  enableMyFeature: boolean
}

export const DEFAULT_SETTINGS = {
  // ... 其他默认值
  enableMyFeature: true,
}
```

5. `src/index.ts` 中注册

```typescript
if (this.settings.enableMyFeature) {
  registerMyFeature(this)
}
```

6. 添加翻译： `src/i18n/zh_CN.json` 和 `src/i18n/en_US.json`

```json
{
  "myFeature": {
    "title": "我的功能",
    "description": "功能描述"
  }
}
```

## Siyuan API 集成

### API 封装 (`src/api.ts`)

常用的 Siyuan API 调用

### 插件 API 使用

```typescript
// 添加菜单项
plugin.addTopBar({
  icon: 'iconEdit',
  title: 'My Action',
  callback: () => { /* ... */ }
})

// 存储
await plugin.saveData('key', value)
const data = await plugin.loadData('key')

// 设置
plugin.openSetting()
```
### 注册右边侧栏
使用API：`plugin.addDock`

- 配置： 配置侧边栏的位置、大小、标题等。
- 数据：传递一个物品。传递的对象可以直接被API访问。`thisinit`
- init：初始化函数;在这里，你可以通过侧边栏的元素设置内部元素（所以不要用箭头函数来回调）。`this`

以下示例请参考[sy-bookmark-plus/src/index.ts](https://liuyun.io/forward?goto=https%3A%2F%2Fgithub.com%2Ffrostime%2Fsy-bookmark-plus%2Fblob%2Fmain%2Fsrc%2Findex.ts)：

```ts
this.addDock({
    type: '::dock',
    config: {
        position: 'RightBottom',
        size: {
            width: 200,
            height: 200,
        },
        icon: 'iconBookmark',
        title: 'Bookmark+'
    },
    data: {
        plugin: this,
        initBookmark: initBookmark,
    },
    init() {
        this.data.initBookmark(this.element, this.data.plugin);
    }
});

```

## 依赖

- Vue 3.3.8
- TypeScript 5.0.4
- Vite 6.2.1
- siyuan 1.1.0
- @iconify/vue

## 资源

- [Siyuan API 文档](https://github.com/siyuan-note/siyuan/blob/master/API.md)
- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [Siyuan 插件示例](https://github.com/siyuan-note/plugin-sample)
