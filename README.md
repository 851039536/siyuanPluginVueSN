# 思源笔记插件开发模板 (Vite + Vue3)

基于 Vite 和 Vue3 的思源笔记插件开发模板，提供完整的插件开发工作流和功能模块示例。

## 特性

- Vue3 组件化开发
- TypeScript 类型支持
- Vite 快速构建与热重载
- 多语言支持 (中文/英文)
- 模块化功能架构
- ESLint 代码规范检查
- 自动化版本发布
- 22+ 功能模块 (超级面板、页面锁定、文档目录、图片压缩等)

## 快速开始

### 环境要求

- Node.js >= 16
- pnpm (推荐) 或 npm/yarn
- 思源笔记客户端

### 安装依赖

\`\`\`bash
pnpm install
\`\`\`

### 配置开发环境

创建 \`.env\` 文件并配置思源工作区路径：

\`\`\`env
VITE_SIYUAN_WORKSPACE_PATH=C:/Users/YourName/AppData/Roaming/SiYuan
\`\`\`

或者在 Linux/Mac 上：

\`\`\`env
VITE_SIYUAN_WORKSPACE_PATH=/home/username/.config/SiYuan
\`\`\`

### 开发模式

\`\`\`bash
pnpm dev
\`\`\`

监听构建模式会自动将插件构建到思源工作区的 \`data/plugins/siyuan-plugin-vite-vue-sn\` 目录，支持热重载。

### 生产构建

\`\`\`bash
pnpm build
\`\`\`

构建产物输出到 \`./dist\` 目录，并自动打包为 \`package.zip\`。



### 安装依赖

```bash
pnpm install
```

### 配置开发环境

创建 `.env` 文件并配置思源工作区路径：

```env
VITE_SIYUAN_WORKSPACE_PATH=C:/Users/YourName/AppData/Roaming/SiYuan
```

或者在 Linux/Mac 上：

```env
VITE_SIYUAN_WORKSPACE_PATH=/home/username/.config/SiYuan
```

### 开发模式

```bash
pnpm dev
```

监听构建模式会自动将插件构建到思源工作区的 `data/plugins/siyuan-plugin-vite-vue-sn` 目录，支持热重载。

### 生产构建

```bash
pnpm build
```

构建产物输出到 `./dist` 目录，并自动打包为 `package.zip`。

## 项目结构

```
siyuan-plugin-vite-vue-sn/
├── src/
│   ├── components/           # Vue 组件
│   │   ├── IconWrapper.vue   # 图标包装器
│   │   ├── SettingPanel.vue  # 设置面板组件
│   │   └── ui/              # UI 组件库
│   ├── commands/            # 斜杠命令
│   │   ├── DateTime.ts      # 日期时间命令
│   │   └── index.ts         # 命令统一导出
│   ├── config/              # 配置管理
│   │   ├── icons.ts         # 图标配置
│   │   └── settings.ts      # 插件配置定义与存储
│   ├── features/            # 功能模块 (22+)
│   │   ├── aiContentGenerator/     # AI 内容生成
│   │   ├── apiReference/           # API 参考面板
│   │   ├── codeImageGenerator/     # 代码截图生成器
│   │   ├── diskBrowser/            # 本地磁盘浏览器
│   │   ├── docNavigation/          # 文档层级导航
│   │   ├── encryption/             # 内容加密
│   │   ├── everythingSearch/       # Everything 搜索集成
│   │   ├── floatingBox/            # 浮动工具箱
│   │   ├── floatingToolbar/        # 浮动工具栏
│   │   ├── generalSettings/        # 通用设置
│   │   ├── highlight/              # 高亮标记
│   │   ├── imageCompressor/        # 图片压缩
│   │   ├── pageLock/               # 页面加密锁定
│   │   ├── shortcut/               # 快捷键面板
│   │   ├── statistics/             # 数据统计
│   │   ├── superPanel/             # 超级面板 (统一入口)
│   │   ├── systemMonitor/          # 系统监控
│   │   ├── tableOfContents/        # 文档目录
│   │   ├── textDiff/               # 文本差异对比
│   │   ├── unitConverter/          # 单位转换器
│   │   ├── video/                  # 视频管理
│   │   ├── wordQuery/              # 单词查询
│   │   └── index.ts                # 功能统一导出
│   ├── i18n/               # 国际化
│   │   ├── en_US.json
│   │   └── zh_CN.json
│   ├── types/              # TypeScript 类型定义
│   ├── utils/              # 工具函数
│   ├── App.vue             # 主应用组件
│   ├── api.ts              # API 封装
│   ├── index.ts            # 插件入口
│   ├── index.scss          # 全局样式
│   └── main.ts             # Vue 应用初始化
├── plugin.json             # 插件元数据
├── vite.config.ts          # Vite 构建配置
├── tsconfig.json           # TypeScript 配置
├── package.json            # 项目配置
└── README.md               # 项目文档
```

## 核心概念

### 插件入口 (src/index.ts)

插件主类继承自 `Plugin`，实现生命周期方法：

```typescript
import { Plugin } from 'siyuan'

export default class PluginSample extends Plugin {
  async onload() {
    // 插件加载时执行
    // 1. 加载配置
    // 2. 注册功能模块
    // 3. 初始化 UI
  }

  onunload() {
    // 插件卸载时执行
  }

  openSetting() {
    // 打开设置面板
  }
}
```

### 功能模块系统

所有功能模块位于 `src/features/` 目录，采用模块化架构：

1. 每个功能独立在自己的文件夹中
2. 通过 `features/index.ts` 统一导出
3. 在插件主类中根据配置注册

已实现的 22+ 功能模块：

- `superPanel`: 超级面板 - 统一功能入口
- `pageLock`: 页面加密锁定功能
- `tableOfContents`: 文档目录功能
- `imageCompressor`: 图片压缩工具
- `docNavigation`: 文档层级导航
- `shortcut`: 快捷键面板与管理
- `wordQuery`: 单词查询功能
- `generalSettings`: 通用设置面板
- `unitConverter`: 单位转换器
- `diskBrowser`: 本地磁盘浏览器
- `codeImageGenerator`: 代码截图生成器
- `aiContentGenerator`: AI 内容生成
- `statistics`: 数据统计面板
- `encryption`: 内容加密功能
- `video`: 视频管理工具
- `everythingSearch`: Everything 搜索集成
- `systemMonitor`: 系统监控面板
- `apiReference`: API 参考面板
- `highlight`: 高亮标记功能
- `floatingToolbar`: 浮动工具栏
- `floatingBox`: 浮动工具箱
- `textDiff`: 文本差异对比

### 配置管理 (src/config/settings.ts)

插件配置通过接口定义：

```typescript
export interface PluginSettings {
  enablePageLock: boolean       // 是否启用页面锁定
  enableTableOfContents: boolean // 是否启用目录功能
}
```

配置保存在思源笔记的插件数据存储中，通过 `loadSettings` 和 `saveSettings` 方法访问。

### 多语言支持

语言包位于 `src/i18n/` 目录：

- `zh_CN.json`: 中文语言包
- `en_US.json`: 英文语言包

使用方式：

```typescript
const message = this.i18n.featureName.key
```

### Vue 组件开发

使用 Vue3 单文件组件 (SFC) 开发 UI：

```vue
<template>
  <div class="my-component">
    <!-- 组件内容 -->
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
// 组件逻辑
</script>

<style scoped lang="scss">
// 组件样式
</style>
```

## 开发指南

### 添加新功能模块

1. 在 `src/features/` 下创建功能文件夹

```bash
mkdir src/features/myFeature
```

2. 创建功能实现文件 `src/features/myFeature/index.ts`

```typescript
import { Plugin } from 'siyuan'

export function registerMyFeature(plugin: Plugin) {
  console.log('注册我的功能')
  
  // 添加菜单项
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

4. 在 `src/config/settings.ts` 中添加配置项

```typescript
export interface PluginSettings {
  // ... 其他配置
  enableMyFeature: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
  // ... 其他默认值
  enableMyFeature: true,
}
```

5. 在 `src/index.ts` 的 `registerFeatures()` 方法中注册

```typescript
private registerFeatures() {
  if (this.settings.enableMyFeature) {
    console.log('注册我的功能')
    registerMyFeature(this)
  }
}
```

6. 添加多语言支持

在 `src/i18n/zh_CN.json` 和 `src/i18n/en_US.json` 中添加翻译：

```json
{
  "myFeature": {
    "title": "我的功能",
    "description": "功能描述"
  }
}
```

### 使用思源 API

项目已封装常用 API 在 `src/api.ts` 中：

```typescript
import { fetchSyncPost } from 'siyuan'

// 获取块信息
export async function getBlockInfo(id: string) {
  return await fetchSyncPost('/api/block/getBlockInfo', { id })
}

// 更新块内容
export async function updateBlock(id: string, data: string) {
  return await fetchSyncPost('/api/block/updateBlock', {
    id,
    data,
    dataType: 'markdown'
  })
}
```

### 开发设置面板

设置面板组件位于 `src/components/SettingPanel.vue`，支持可视化配置插件：

```vue
<template>
  <div class="config-panel">
    <div class="config-item">
      <label>功能开关</label>
      <input 
        type="checkbox" 
        v-model="settings.enableMyFeature"
        @change="handleSave"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  plugin: any
}>()

const settings = ref(props.plugin.settings)

const handleSave = async () => {
  await props.plugin.updateSettings(settings.value)
}
</script>
```

### 调试技巧

1. 开启开发者工具
   - Windows/Linux: `Ctrl + Shift + I`
   - macOS: `Cmd + Option + I`

2. 查看插件日志

```typescript
console.log('调试信息', data)
console.error('错误信息', error)
```

3. 使用 Vue DevTools

安装浏览器插件 Vue DevTools 可以调试 Vue 组件。

4. 热重载

开发模式下修改代码会自动重新构建，刷新思源笔记即可看到效果。

## 版本发布

### 自动发布

```bash
# 补丁版本 (0.0.1 -> 0.0.2)
pnpm release:patch

# 次版本 (0.0.1 -> 0.1.0)
pnpm release:minor

# 主版本 (0.0.1 -> 1.0.0)
pnpm release:major
```

### 手动发布

```bash
pnpm release:manual
```

发布脚本会自动：
1. 更新 `package.json` 和 `plugin.json` 中的版本号
2. 创建 Git tag
3. 构建生产版本
4. 生成 `package.zip`

## 技术栈

- 框架: Vue 3.3.8
- 构建工具: Vite 6.2.1
- 语言: TypeScript 5.0.4
- 样式: Sass 1.62.1
- 代码规范: ESLint 9.22.0
- SDK: siyuan 1.1.0
- **图标库**: @iconify/vue 5.0.0
- **Markdown**: markdown-it 14.1.0
- **视频播放器**: video.js 8.23.4
- **二维码**: qrcode 1.5.4
- **差异对比**: vue-diff 1.2.4
- **图片压缩**: browser-image-compression 2.0.2

## 常用开发命令

### 开发工作流

\`\`\`bash
# 安装依赖
pnpm install

# 启动开发模式（监听模式 + 热重载）
# 当配置了 VITE_SIYUAN_WORKSPACE_PATH 时，自动构建到思源工作区
pnpm dev

# 生产构建（输出到 ./dist 并创建 package.zip）
pnpm build
\`\`\`

### 代码质量

\`\`\`bash
# 使用 ESLint 检查代码
pnpm lint
\`\`\`

### 版本发布管理

\`\`\`bash
# 自动版本递增和打包
pnpm release:patch   # 0.0.1 -> 0.0.2
pnpm release:minor   # 0.0.1 -> 0.1.0
pnpm release:major   # 0.0.1 -> 1.0.0
pnpm release:manual  # 手动输入版本
\`\`\`

发布脚本会自动执行以下操作：
1. 更新 \`package.json\` 和 \`plugin.json\` 中的版本号
2. 创建 git 标签
3. 构建生产版本
4. 生成 \`package.zip\` 用于分发

## 开发规范

### 命名约定

- 文件名: 使用 camelCase (如 `myFeature.ts`)
- Vue 组件: 使用 PascalCase (如 `SettingPanel.vue`)
- 函数/变量: 使用 camelCase (如 `registerFeature`)
- 常量: 使用 UPPER_CASE (如 `DEFAULT_SETTINGS`)

### 目录组织

- 功能模块独立存放在 `src/features/` 下
- 通用组件放在 `src/components/` 下
- 工具函数放在 `src/utils/` 下
- 类型定义放在 `src/types/` 下
- 斜杠命令放在 `src/commands/` 下

### 代码风格

项目使用 ESLint 进行代码检查，提交前确保代码符合规范：

```bash
pnpm lint
```

## 常见问题

### Q: 热重载不生效？

A: 确保 `.env` 文件中的 `VITE_SIYUAN_WORKSPACE_PATH` 配置正确，并且思源笔记正在运行。

### Q: 插件加载失败？

A: 检查 `plugin.json` 中的 `minAppVersion` 是否与思源笔记版本匹配。

### Q: 如何禁用某个功能模块？

A: 在插件设置面板中关闭对应功能开关，或直接修改配置文件。

### Q: 构建报错？

A: 
1. 清除依赖重新安装: `rm -rf node_modules && pnpm install`
2. 检查 Node.js 版本是否 >= 16
3. 确保 TypeScript 类型定义正确

## 参考资源

- 思源笔记官网: https://b3log.org/siyuan/
- 思源笔记 API 文档: https://github.com/siyuan-note/siyuan/blob/master/API.md
- 插件开发指南: https://github.com/siyuan-note/plugin-sample
- Vue 3 文档: https://vuejs.org/
- Vite 文档: https://vitejs.dev/

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

开发愉快！🎉
