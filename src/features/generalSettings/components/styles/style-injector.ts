/**
 * HeadingSettings CSS 变量注入器
 * 替代原有的硬编码样式注入，使用 CSS 变量实现动态样式
 */

export interface HeadingSettingsStyleVars {
  // 标题颜色
  '--hs-heading-h1-color'?: string
  '--hs-heading-h2-color'?: string
  '--hs-heading-h3-color'?: string
  '--hs-heading-h4-color'?: string
  '--hs-heading-h5-color'?: string
  '--hs-heading-h6-color'?: string

  // 标题字体大小
  '--hs-h1-size'?: string
  '--hs-h2-size'?: string
  '--hs-h3-size'?: string
  '--hs-h4-size'?: string
  '--hs-h5-size'?: string
  '--hs-h6-size'?: string

  // 文档标题设置
  '--hs-title-color'?: string
  '--hs-title-font-size'?: string

  // 层级显示标记
  '--hs-level-h1'?: string
  '--hs-level-h2'?: string
  '--hs-level-h3'?: string
  '--hs-level-h4'?: string
  '--hs-level-h5'?: string
  '--hs-level-h6'?: string

  // 布局和尺寸
  '--hs-title-align'?: 'left' | 'center' | 'right'
}

/**
 * 应用 CSS 变量到指定的容器元素
 * @param container 目标容器元素
 * @param vars CSS 变量对象
 */
export function applyCSSVariables(
  container: HTMLElement,
  vars: HeadingSettingsStyleVars
): void {
  Object.entries(vars).forEach(([key, value]) => {
    if (value) {
      container.style.setProperty(key, value)
    }
  })
}

/**
 * 获取层级显示 CSS 变量映射
 */
export function getLevelDisplayVars(
  style: string,
  customMarkers: string[] = ['1', '2', '3', '4', '5', '6']
): Record<string, string> {
  const mappings: Record<string, string[]> = {
    number: ['1', '2', '3', '4', '5', '6'],
    roman: ['I', 'II', 'III', 'IV', 'V', 'VI'],
    chinese: ['一', '二', '三', '四', '五', '六'],
    chineseUpper: ['壹', '贰', '叁', '肆', '伍', '陆'],
    dots: ['•', '••', '•••', '••••', '••••••', '•••••••••'],
    emoji: ['😀', '😁', '😂', '🤣', '😊', '😎'],
    star: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐', '⭐⭐⭐⭐⭐⭐'],
    arrow: ['→', '→→', '→→→', '→→→→', '→→→→→', '→→→→→→'],
    tag: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
    bracket: ['[1]', '[2]', '[3]', '[4]', '[5]', '[6]'],
    custom: customMarkers
  }

  const levels = mappings[style] || mappings.number
  const vars: Record<string, string> = {}

  levels.forEach((label, index) => {
    const level = index + 1
    vars[`--hs-level-h${level}`] = label
  })

  return vars
}

/**
 * 动态生成标题层级显示的 CSS 变量注入
 * 使用 CSS ::after 伪元素和 data 属性
 */
export function getLevelDisplayCSS(
  style: string,
  customMarkers: string[] = ['1', '2', '3', '4', '5', '6']
): string {
  const vars = getLevelDisplayVars(style, customMarkers)

  // 生成 CSS 变量定义
  const varDefinitions = Object.entries(vars)
    .map(([key, value]) => `${key}: "${value}";`)
    .join('\n  ')

  // 使用 CSS 变量的样式规则
  return `
/* 层级显示样式 - CSS 变量方式 */
${varDefinitions ? `[data-level-style="${style}"] {\n  ${varDefinitions}\n}` : ''}

/* 新的层级显示实现 - 使用 data 属性 */
[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h1"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h1"][data-node-id] > div.h1[contenteditable]::after {
  content: "  var(--hs-level-h1)";
  font-size: 0.7em;
  opacity: 0.4;
  margin-left: 6px;
  vertical-align: middle;
}

[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h2"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h2"][data-node-id] > div.h2[contenteditable]::after {
  content: "  var(--hs-level-h2)";
  font-size: 0.7em;
  opacity: 0.4;
  margin-left: 6px;
  vertical-align: middle;
}

[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h3"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h3"][data-node-id] > div.h3[contenteditable]::after {
  content: "  var(--hs-level-h3)";
  font-size: 0.7em;
  opacity: 0.4;
  margin-left: 6px;
  vertical-align: middle;
}

[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h4"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h4"][data-node-id] > div.h4[contenteditable]::after {
  content: "  var(--hs-level-h4)";
  font-size: 0.7em;
  opacity: 0.4;
  margin-left: 6px;
  vertical-align: middle;
}

[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h5"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h5"][data-node-id] > div.h5[contenteditable]::after {
  content: "  var(--hs-level-h5)";
  font-size: 0.7em;
  opacity: 0.4;
  margin-left: 6px;
  vertical-align: middle;
}

[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h6"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
[data-level-style="${style}"] .protyle-wysiwyg div[data-subtype="h6"][data-node-id] > div.h6[contenteditable]::after {
  content: "  var(--hs-level-h6)";
  font-size: 0.7em;
  opacity: 0.4;
  margin-left: 6px;
  vertical-align: middle;
}
`.trim()
}

/**
 * 更新文档根变量（全局应用）
 */
export function updateDocumentVariables(
  colors: Record<string, string>,
  sizes: Record<string, number>,
  titleCenterAlign: boolean,
  titleColor: string,
  titleFontSize: number
): void {
  const root = document.documentElement

  // 设置颜色变量（使用透明度和混合以兼容主题）
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--hs-heading-${key}-color`, value)
  })

  // 设置字体大小变量
  Object.entries(sizes).forEach(([key, value]) => {
    root.style.setProperty(`--hs-${key}-size`, `${value}px`)
  })

  // 文档标题设置
  root.style.setProperty('--hs-title-color', titleColor)
  root.style.setProperty('--hs-title-font-size', `${titleFontSize}px`)
  root.style.setProperty('--hs-title-align', titleCenterAlign ? 'center' : 'left')
}

/**
 * 清理文档变量
 */
export function clearDocumentVariables(): void {
  const root = document.documentElement
  const vars = [
    '--hs-heading-h1-color', '--hs-heading-h2-color', '--hs-heading-h3-color',
    '--hs-heading-h4-color', '--hs-heading-h5-color', '--hs-heading-h6-color',
    '--hs-h1-size', '--hs-h2-size', '--hs-h3-size', '--hs-h4-size', '--hs-h5-size', '--hs-h6-size',
    '--hs-title-color', '--hs-title-font-size', '--hs-title-align'
  ]

  vars.forEach(v => root.style.removeProperty(v))
}

/**
 * 生成完整的样式标签（兼容旧方式，但使用 CSS 变量）
 */
export function generateDynamicStyles(
  colors: Record<string, string>,
  sizes: Record<string, number>,
  titleCenterAlign: boolean,
  titleColor: string,
  titleFontSize: number
): string {
  const cssColorVars = Object.entries(colors)
    .map(([key, value]) => `--hs-${key}-color: ${value};`)
    .join('\n    ')

  const cssSizeVars = Object.entries(sizes)
    .map(([key, value]) => `--hs-${key}-size: ${value}px;`)
    .join('\n    ')

  const titleCss = titleCenterAlign ? `
    .protyle-title__input {
      text-align: center !important;
      color: var(--hs-title-color, ${titleColor}) !important;
      font-size: var(--hs-title-font-size, ${titleFontSize}px) !important;
    }` : `
    .protyle-title__input {
      color: var(--hs-title-color, ${titleColor}) !important;
      font-size: var(--hs-title-font-size, ${titleFontSize}px) !important;
    }`

  // 使用 CSS 变量的新样式系统
  return `
/* HeadingSettings 动态样式 - 变量驱动 */
:root {
  ${cssColorVars}
  ${cssSizeVars}
  --hs-title-color: ${titleColor};
  --hs-title-font-size: ${titleFontSize}px;
}

/* 应用标题颜色 */
.protyle-wysiwyg [data-node-id].h1,
.protyle-wysiwyg .h1,
.b3-typography .h1 {
  color: var(--hs-h1-color, var(--hs-heading-h1-color)) !important;
  font-size: var(--hs-h1-size) !important;
}

.protyle-wysiwyg [data-node-id].h2,
.protyle-wysiwyg .h2,
.b3-typography .h2 {
  color: var(--hs-h2-color, var(--hs-heading-h2-color)) !important;
  font-size: var(--hs-h2-size) !important;
}

.protyle-wysiwyg [data-node-id].h3,
.protyle-wysiwyg .h3,
.b3-typography .h3 {
  color: var(--hs-h3-color, var(--hs-heading-h3-color)) !important;
  font-size: var(--hs-h3-size) !important;
}

.protyle-wysiwyg [data-node-id].h4,
.protyle-wysiwyg .h4,
.b3-typography .h4 {
  color: var(--hs-h4-color, var(--hs-heading-h4-color)) !important;
  font-size: var(--hs-h4-size) !important;
}

.protyle-wysiwyg [data-node-id].h5,
.protyle-wysiwyg .h5,
.b3-typography .h5 {
  color: var(--hs-h5-color, var(--hs-heading-h5-color)) !important;
  font-size: var(--hs-h5-size) !important;
}

.protyle-wysiwyg [data-node-id].h6,
.protyle-wysiwyg .h6,
.b3-typography .h6 {
  color: var(--hs-h6-color, var(--hs-heading-h6-color)) !important;
  font-size: var(--hs-h6-size) !important;
}

/* 标题居中和颜色 */
${titleCss}

/* 打印支持 */
@media print {
  .protyle-wysiwyg .h1,
  .protyle-wysiwyg .h2,
  .protyle-wysiwyg .h3,
  .protyle-wysiwyg .h4,
  .protyle-wysiwyg .h5,
  .protyle-wysiwyg .h6 {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`.trim()
}