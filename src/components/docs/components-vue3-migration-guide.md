# 共享组件库迁移到普通 Vue 3 项目（新手版）

> 这套 UI 组件库（按钮、输入框、下拉、日历、图表等 **38 个组件**）原本跑在思源笔记里。
> 本文档告诉你怎么把它搬到一个**普通 Vue 3 项目**里用。
>
> **基线**：2026-09-11，`src/components/` 共 117 个文件（38 个公开组件 + 各组件私有子目录 + `styles/` + `kit/` 支撑目录与本说明文档）。

---

## 一、两步跑通

### 第 1 步：复制整个 `src/components/` 目录

把本目录（`src/components/`）**完整复制**到目标项目里，比如放在 `src/components/`。

> ⚠️ 是整个目录，不要只挑几个 `.vue` 文件——组件之间互相引用，还有 `styles/`、`kit/` 等子目录，
> 少一个都会编译报错。放的位置也随意（`src/ui/`、`src/kit/` 都行），内部全是相对路径引用。

### 第 2 步：安装依赖

```bash
npm i vue @iconify/vue @iconify-json/mdi
npm i -D sass @vitejs/plugin-vue

# 只有用到图表组件（Chart）时才需要：
npm i chart.js vue-chartjs
```

### 完成。直接用：

```vue
<script setup lang="ts">
import Button from "./components/Button.vue"
import Input from "./components/Input.vue"
</script>

<template>
  <Input v-model="name" placeholder="你的名字" />
  <Button variant="primary" @click="save">保存</Button>
</template>
```

> 注意：因为**没有配 `@` 别名**，导入时请用相对路径（`./components/Button.vue`）。
> 想用 `@/components/...` 这种写法的话，自己在目标项目里配一个别名即可（可选，不是必须）。

---

## 二、你不需要做的事（和旧版迁移文档的区别）

| 旧版需要 | 现在为什么不用 |
|---|---|
| 另外复制 `src/_variables.scss`（设计 Token） | 已内聚为 `components/kit/variables.scss`，组件样式用相对路径引用它 |
| 另外复制 `src/config/icons.ts`（图标表） | 已内聚为 `components/kit/icons.ts` |
| 配置 `@` → `src` 的路径别名 | 组件内部已全部改为相对路径引用 |
| 在全局样式里引入一份主题桥接文件 | `kit/theme.ts` 会自动注入一套明暗默认主题（见下文"主题"） |
| 在 `main.ts` 里调用图标预加载 | `IconWrapper` 组件自己会注册 mdi 图标数据，断网也能显示 |

---

## 三、它开箱自带什么

- **38 个组件**：Avatar / Badge / Button / Card / Chart / Checkbox / ColorField / ConfirmDialog / ConfirmPopup /
  DatePicker / Divider / FormField / IconWrapper / Input / InputGroup / InputGroupAddon / Label / Listbox /
  Loader / Paginator / Panel / RadioButton / Select / Slider / SpeedDial / Splitter / SplitterPanel / Switch / Tab / TabList / TabPanel / TabPanels / Tabs / Tag / Textarea / Timeline / ToggleButton / Toolbar
- **明暗主题自动切换**：没配任何主题时给一套默认配色（跟随系统 `prefers-color-scheme`，
  也认 `[data-theme="dark"]` 和 `.dark` 两种手动挂暗色的方式）
- **图标离线可用**：mdi 图标数据随组件包内置，不请求任何外部 CDN

---

## 四、定制主题（三种方式，任选）

组件的颜色全部读 CSS 变量 `--b3-theme-*`（主色、背景、边框、错误色等 20 个）。

**方式 1（推荐）：在目标项目自己的全局样式里定义这些变量**

```css
:root {
  --b3-theme-primary: #7c3aed;   /* 你的品牌色 */
  --b3-border-color: #e5e7eb;
}
```

宿主样式永远优先于组件包内置的默认值，直接覆盖即可。

**方式 2：调用组件包提供的函数**

```ts
import { applyDefaultTheme } from "./components/kit/theme"

applyDefaultTheme({ overrides: { "b3-theme-primary": "#7c3aed" } })
```

**方式 3：直接改 `components/kit/theme.ts` 里的 `LIGHT_VARS` / `DARK_VARS` 两张表。**

> 20 个变量的名字和含义，见 `kit/theme.ts` 文件内注释（键名去掉 `--` 前缀即是）。

---

## 五、不要某个组件时怎么裁剪

| 不要的东西 | 一并删除 | 可省掉的依赖 |
|---|---|---|
| 图表 | `Chart.vue`、`styles/Chart.scss`、`chart.types.ts` | `chart.js`、`vue-chartjs` |
| 浮动按钮 | `SpeedDial.vue`、`styles/SpeedDial.scss`、`speedDial/` | — |
| 图标表瘦身 | `kit/icons.ts` 里大段"本项目功能图标"可删，**保留**文件末尾的 `COMMON_ICONS` 与 `getIconConfig()`（组件自身渲染只用到其中 15 个键：`minus` `check` `x` `close` `eye` `eyeOff` `calendar` `chevronUp` `chevronDown` `chevronLeft` `chevronRight` `chevronDoubleLeft` `chevronDoubleRight` `magnify` `plus`） | — |

> `IconWrapper.vue` 是 10 个组件的公共依赖，**不能删**。

---

## 六、常见报错对照表

| 报错 / 现象 | 原因 | 解决 |
|---|---|---|
| `Can't find stylesheet '../kit/variables.scss'` | 复制时漏了 `kit/` 目录，或把组件拍平了 | 重新整体复制 `src/components/`，保持目录结构 |
| `Failed to resolve import "./datePicker/PickerPanel.vue"` | 私有子目录（`datePicker/` `select/` `speedDial/` `paginator/` `textarea/` `timeline/` `splitter/` `tabs/` `confirm/`）没带全 | 同上 |
| `Cannot find module 'sass'` / `Preprocessor dependency "sass" not found` | 没装 sass | `npm i -D sass` |
| 图标**空白但不报错** | 没装 `@iconify-json/mdi` | `npm i @iconify-json/mdi` |
| 图标全部变成问号圆圈 | 传给 `icon` 的名字没在 `kit/icons.ts` 注册 | 用表里已有的键，或在表中补注册 |
| `SassError: Undefined variable. $color-xxx` | `kit/variables.scss` 缺失或被改坏 | 还原该文件 |
| TS 报 `Cannot find module './xxx.vue'` | 目标项目缺 `*.vue` 的类型声明 | 确认有 `src/vite-env.d.ts`（Vite 脚手架自带，内含 `declare module "*.vue"`） |
| 页面样式是亮色，系统切暗色不变 | 宿主（你的项目）自己定义了 `--b3-theme-*` 但只给了亮色值 | 补暗色值，或删掉宿主的定义让组件包默认主题接管 |

---

## 七、使用约束（与宿主无关，任何时候都要注意）

- `Select` / `DatePicker` 的下拉是**相对定位**（不是传送门挂 body）：父容器 `overflow: hidden` 会把下拉裁掉
- `FormField` 是多根组件：**控件必须写在它的默认插槽里**，写在旁边会让提示文字跑到控件上方
- `Loader` 没有 props 且高度 100%：**父容器必须给显式高度**
- `Input` / `Select` / `Textarea` 在表单里建议显式写 `size="small"`（默认就是 small，medium 偏大）
- 图标名必须是 `kit/icons.ts` 里注册过的键（如 `icon="close"`），**不能**直接写 `"mdi:close"`
- 依赖的浏览器：组件样式用了较新的 CSS 相对颜色语法（Chromium 119+ / Safari 16.4+ / Firefox 128+）

---

## 八、附：这套组件库在本仓库的位置（维护者向）

为了让"复制一个目录"成立，本仓库做了如下安排（改代码前请先看 `kit/README.md`）：

- `src/components/kit/`：`icons.ts`（图标表真源）、`variables.scss`（设计 Token 真源）、
  `theme.ts`（默认主题注入）、`iconify.ts`（mdi 离线注册）、`README.md`
- `src/_variables.scss` 与 `src/config/icons.ts`：**转发壳**（`@forward` / `export *`），
  本项目 336 处样式引用与 48 处图标引用的路径不变
- 38 个公开组件内部只用相对路径互相引用，并各带一行 `import "./kit/theme"`
- 新增图标 / Token 请改 `kit/` 里的真源文件，**不要**改两个转发壳
