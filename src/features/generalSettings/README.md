# 通用设置

提供综合性配置管理，是插件的核心设置中心。包含文档计数管理、高亮管理、书签标记、技能库查看、字体设置、代码块样式和折叠、列表增强样式、标题样式映射、表格样式等子模块。

## 内置字体（文档字体设置）

- **内置字体**：霞鹜文楷（LXGW WenKai）Regular，体积约 25.5MB（SIL OFL 1.1 开源协议，可自由嵌入/再分发）。
- **文件位置**：`src/features/generalSettings/assets/fonts/`，构建时经 `viteStaticCopy` 复制到插件 `assets/fonts/` 目录，并同步携带 `OFL.txt` 许可证。
- **加载方式**：`GeneralSettings.init()` 调用 `injectBuiltinFont(plugin.assetsPath)` 注入 `@font-face`，`src` 指向 `${assetsPath}/fonts/LXGWWenKai-Regular.ttf`。
- **生效条件**：在「文档字体设置」预设下拉中选择「霞鹜文楷 (LXGW WenKai)」即可，无需在系统安装字体；系统已安装同名字体时优先使用系统字体。
- **注意事项**：该字体文件较大，会显著增加插件包体积；若不再需要可删除 `assets/fonts/` 下文件，并同步移除 `vite.config.ts` 中对应的 `viteStaticCopy` target 与 `styles.ts` 的 `BUILTIN_FONT` 常量及 `injectBuiltinFont` 调用。
