/**
 * 封面生成器 Composable
 * 根据标题 + 关键字 + 风格，纯代码生成 HTML 封面（无 AI 依赖）
 */
import type {
  CoverGenerationConfig,
  CoverGenerationStatus,
  CoverSizePreset,
  CoverStylePreset,
  StyleColors,
  StyleDefinition,
} from "../types"
import { ref } from "vue"

/** 封面字体族常量（避免每次 buildCoverHtml 重新定义） */
const COVER_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'

// 尺寸预设
export const COVER_SIZE_PRESETS: CoverSizePreset[] = [
  { label: "微信公众号 (900×383)", width: 900, height: 383 },
  { label: "头条封面 (1280×720)", width: 1280, height: 720 },
  { label: "小红书 (1080×1440)", width: 1080, height: 1440 },
  { label: "知乎 (1920×1080)", width: 1920, height: 1080 },
  { label: "博客横幅 (1200×630)", width: 1200, height: 630 },
  { label: "正方形 (1080×1080)", width: 1080, height: 1080 },
]

// ============================================================
// 私有：标签样式构建器（替代 getBaseTagStyles + getColoredTagStyles）
// ============================================================

/** 生成 .tag 基础样式（5 风格共享的 tag 颜色循环） */
function _tagCommon(mode: string): string {
  if (mode === "minimal" || mode === "chinese") {
    return [
      `.tag { background:transparent !important; border-radius:4px !important; letter-spacing:1px; }`,
      `.tag:nth-child(5n+1) { color:#e74c3c !important; border:1.5px solid #e74c3c50; }`,
      `.tag:nth-child(5n+2) { color:#27ae60 !important; border-color:#27ae6050; }`,
      `.tag:nth-child(5n+3) { color:#2980b9 !important; border-color:#2980b950; }`,
      `.tag:nth-child(5n+4) { color:#e67e22 !important; border-color:#e67e2250; }`,
      `.tag:nth-child(5n+5) { color:#8e44ad !important; border-color:#8e44ad50; }`,
    ].join("\n    ")
  }
  if (mode === "tech") {
    return [
      `.tag { border-radius:3px !important; letter-spacing:1px; text-transform:uppercase; }`,
      `.tag:nth-child(5n+1) { color:#e74c3c !important; border:1px solid #e74c3c50; box-shadow:0 0 12px #e74c3c30, inset 0 0 6px #e74c3c10; background:#e74c3c15 !important; }`,
      `.tag:nth-child(5n+2) { color:#27ae60 !important; border-color:#27ae6050; box-shadow:0 0 12px #27ae6030, inset 0 0 6px #27ae6010; background:#27ae6015 !important; }`,
      `.tag:nth-child(5n+3) { color:#2980b9 !important; border-color:#2980b950; box-shadow:0 0 12px #2980b930, inset 0 0 6px #2980b910; background:#2980b915 !important; }`,
      `.tag:nth-child(5n+4) { color:#e67e22 !important; border-color:#e67e2250; box-shadow:0 0 12px #e67e2230, inset 0 0 6px #e67e2210; background:#e67e2215 !important; }`,
      `.tag:nth-child(5n+5) { color:#8e44ad !important; border-color:#8e44ad50; box-shadow:0 0 12px #8e44ad30, inset 0 0 6px #8e44ad10; background:#8e44ad15 !important; }`,
    ].join("\n    ")
  }
  if (mode === "drawio") {
    return `.tag { border-radius:3px !important; }`
  }
  // magazine
  return `.tag { border-radius:2px !important; font-style:italic; background:transparent !important; padding:4px 14px !important; letter-spacing:0.5px; }`
}

/** 生成需要颜色上下文的 .tag 差异样式（drawio/magazine 需 c.titleColor） */
function _tagColored(mode: string, c: StyleColors): string {
  if (mode === "drawio") {
    return [
      `.tag:nth-child(5n+1) { color:${c.titleColor} !important; background:#e74c3c08 !important; border:1px solid #e74c3c25; border-left:3px solid #e74c3c; }`,
      `.tag:nth-child(5n+2) { border-left-color:#27ae60; background:#27ae6008 !important; border-color:#27ae6025; }`,
      `.tag:nth-child(5n+3) { border-left-color:#2980b9; background:#2980b908 !important; border-color:#2980b925; }`,
      `.tag:nth-child(5n+4) { border-left-color:#e67e22; background:#e67e2208 !important; border-color:#e67e2225; }`,
      `.tag:nth-child(5n+5) { border-left-color:#8e44ad; background:#8e44ad08 !important; border-color:#8e44ad25; }`,
    ].join("\n    ")
  }
  if (mode === "magazine") {
    return [
      `.tag:nth-child(5n+1) { color:${c.titleColor} !important; border-bottom:2px solid #e74c3c; }`,
      `.tag:nth-child(5n+2) { border-bottom-color:#27ae60; }`,
      `.tag:nth-child(5n+3) { border-bottom-color:#2980b9; border-bottom-width:3px; }`,
      `.tag:nth-child(5n+4) { border-bottom-color:#e67e22; }`,
      `.tag:nth-child(5n+5) { border-bottom-color:#8e44ad; border-bottom-style:dotted; }`,
    ].join("\n    ")
  }
  return ""
}

// ============================================================
// 封面风格注册表（单一数据源：colors + decorHtml + buildDecorCss 三位一体）
// ============================================================

export const COVER_STYLE_REGISTRY: StyleDefinition[] = [
  {
    id: "minimal",
    label: "极简",
    description: "白底大字、黑色标题、简洁装饰线",
    colors: { bg: "#ffffff", titleColor: "#1a1a1a", subtitleColor: "#666666", accent: "#e74c3c", accentAlt: "#c0392b" },
    decorHtml: `<div class="decor-diamond"></div><div class="decor-circle"></div><div class="decor-circle-sm"></div><div class="decor-line-l"></div><div class="decor-line-r"></div><div class="decor-dots"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: radial-gradient(circle, ${c.accent}04 1px, transparent 1px); background-size:32px 32px; background-position: -16px -16px; }
    body::before { content:""; position:absolute; top:0; left:0; right:0; height:5px; background:linear-gradient(90deg, ${c.accent}, ${c.accentAlt}, ${c.accent}); }
    body::after { content:""; position:absolute; bottom:52px; left:50%; transform:translateX(-50%); width:48px; height:48px; border:2px solid ${c.accent}30; border-radius:50%; }
    .content::before { content:""; position:absolute; top:50%; left:7%; width:2px; height:35%; transform:translateY(-50%); background:linear-gradient(to bottom, transparent, ${c.accent}25, transparent); }
    .content::after { content:""; position:absolute; top:50%; right:7%; width:2px; height:35%; transform:translateY(-50%); background:linear-gradient(to bottom, transparent, ${c.accent}25, transparent); }
    h1 { position:relative; padding-bottom:18px; }
    h1::after { content:""; position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:50px; height:3px; background:${c.accent}; border-radius:2px; }
    .decor-diamond { position:absolute; top:18%; right:16%; width:100px; height:100px; border:1.5px solid ${c.accent}12; transform:rotate(45deg); }
    .decor-circle { position:absolute; top:10%; right:8%; width:200px; height:200px; border-radius:50%; background:radial-gradient(circle, ${c.accent}08 0%, transparent 70%); }
    .decor-circle-sm { position:absolute; bottom:22%; left:10%; width:60px; height:60px; border-radius:50%; background:${c.accent}06; }
    .decor-line-l { position:absolute; bottom:16%; left:5%; width:70px; height:1px; background:${c.accent}; opacity:0.25; }
    .decor-line-r { position:absolute; top:16%; right:5%; width:50px; height:1px; background:${c.accent}; opacity:0.2; }
    .decor-dots { position:absolute; bottom:12%; right:12%; width:60px; height:60px; background-image:radial-gradient(circle, ${c.accent}18 1.5px, transparent 1.5px); background-size:12px 12px; }
    ${_tagCommon("minimal")}
    .tag:nth-child(5n+5) { border-style:dashed; }
    .category-badge { background:transparent !important; color:${c.accent} !important; border:1.5px solid ${c.accent}60; border-radius:4px !important; font-weight:500; }
    .title-sep { border-top-style:solid; border-top-color:${c.accent}18; width:60px; }`
    },
  },
  {
    id: "tech",
    label: "科技",
    description: "深色背景、霓虹线条、青色强调",
    colors: { bg: "#0a0a0a", titleColor: "#ffffff", subtitleColor: "#888888", accent: "#00ffff", accentAlt: "#00cc99" },
    decorHtml: `<div class="decor-scan"></div><div class="decor-scan s2"></div><div class="decor-corner tl"></div><div class="decor-corner tr"></div><div class="decor-corner bl"></div><div class="decor-corner br"></div><div class="decor-node n1"></div><div class="decor-node n2"></div><div class="decor-node n3"></div><div class="decor-node n4"></div><div class="decor-node n5"></div><div class="decor-data-line"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: linear-gradient(rgba(0,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.03) 1px, transparent 1px); background-size:40px 40px; }
    body::before { content:""; position:absolute; top:28px; left:28px; right:28px; bottom:28px; border:1px solid rgba(0,255,255,0.1); }
    body::after { content:""; position:absolute; top:0; right:0; width:350px; height:350px; background:radial-gradient(circle, ${c.accent}12 0%, transparent 70%); }
    .content::before { content:"/*"; position:absolute; top:8%; left:6%; font-size:48px; color:${c.accent}10; font-family:"SF Mono","Consolas",monospace; }
    .content::after { content:"*/"; position:absolute; bottom:8%; right:6%; font-size:48px; color:${c.accent}10; font-family:"SF Mono","Consolas",monospace; }
    h1 { text-shadow:0 0 40px ${c.accent}20; }
    .decor-scan { position:absolute; left:0; right:0; height:1px; background:linear-gradient(90deg, transparent, ${c.accent}20, transparent); }
    .decor-scan { top:28%; }
    .decor-scan.s2 { top:68%; background:linear-gradient(90deg, transparent, ${c.accentAlt}15, transparent); }
    .decor-corner { position:absolute; width:20px; height:20px; border-color:${c.accent}30; border-style:solid; }
    .decor-corner.tl { top:36px; left:36px; border-width:1px 0 0 1px; }
    .decor-corner.tr { top:36px; right:36px; border-width:1px 1px 0 0; }
    .decor-corner.bl { bottom:36px; left:36px; border-width:0 0 1px 1px; }
    .decor-corner.br { bottom:36px; right:36px; border-width:0 1px 1px 0; }
    .decor-node { position:absolute; border-radius:50%; background:${c.accent}; box-shadow:0 0 8px ${c.accent}60; }
    .decor-node.n1 { top:14%; left:14%; width:8px; height:8px; }
    .decor-node.n2 { top:20%; right:18%; width:5px; height:5px; opacity:0.7; }
    .decor-node.n3 { bottom:22%; left:22%; width:6px; height:6px; opacity:0.5; }
    .decor-node.n4 { top:45%; right:10%; width:4px; height:4px; opacity:0.6; }
    .decor-node.n5 { bottom:35%; left:12%; width:7px; height:7px; opacity:0.5; }
    .decor-data-line { position:absolute; top:15%; bottom:15%; right:8%; width:1px; background:linear-gradient(to bottom, transparent, ${c.accent}12 20%, ${c.accent}12 80%, transparent); }
    .decor-data-line::before { content:""; position:absolute; top:20%; left:-2px; width:5px; height:5px; border-radius:50%; background:${c.accent}; box-shadow:0 0 6px ${c.accent}40; }
    .decor-data-line::after { content:""; position:absolute; bottom:25%; left:-2px; width:5px; height:5px; border-radius:50%; background:${c.accentAlt}; box-shadow:0 0 6px ${c.accentAlt}40; }
    ${_tagCommon("tech")}
    .category-badge { background:${c.accentAlt}18 !important; color:${c.accentAlt} !important; border:1px solid ${c.accentAlt}50; border-radius:3px !important; box-shadow:0 0 10px ${c.accentAlt}25; font-family:"SF Mono","Fira Code","Consolas",monospace; text-transform:uppercase; letter-spacing:2px; }
    .title-sep { border-top-color:${c.accent}35; width:100px; box-shadow:0 0 6px ${c.accent}20; }`
    },
  },
  {
    id: "magazine",
    label: "杂志",
    description: "大标题排版、分栏布局、衬线字体",
    colors: { bg: "#faf8f5", titleColor: "#1a1a1a", subtitleColor: "#555555", accent: "#c0392b", accentAlt: "#e74c3c" },
    decorHtml: `<div class="decor-topline"></div><div class="decor-block"></div><div class="decor-block b2"></div><div class="decor-ring"></div><div class="decor-ring r2"></div><div class="decor-bar"></div><div class="decor-pageno"></div><div class="decor-dot-row"></div>`,
    buildDecorCss(c) {
      return `
    body::before { content:""; position:absolute; top:0; left:0; width:42%; height:100%; background:linear-gradient(180deg, ${c.accentAlt}05 0%, ${c.accent}03 100%); }
    body::after { content:""; position:absolute; bottom:0; left:42%; right:0; height:6px; background:${c.accent}; }
    .content::before { content:""; position:absolute; top:8%; right:8%; width:120px; height:120px; border:3px solid ${c.accent}15; border-radius:50%; }
    .content::after { content:""; position:absolute; bottom:16%; left:3%; width:60px; height:2px; background:${c.accentAlt}; }
    .decor-topline { position:absolute; top:0; left:42%; right:0; height:3px; background:linear-gradient(90deg, ${c.accent}, ${c.accentAlt}60, transparent); }
    .decor-block { position:absolute; top:38%; left:3%; width:30%; height:24%; background:${c.accent}05; }
    .decor-block.b2 { top:65%; left:6%; width:18%; height:8%; background:${c.accentAlt}06; }
    .decor-ring { position:absolute; bottom:10%; right:6%; width:80px; height:80px; border:2px solid ${c.accent}12; border-radius:50%; }
    .decor-ring.r2 { bottom:8%; right:14%; width:40px; height:40px; border-color:${c.accentAlt}15; }
    .decor-bar { position:absolute; top:4%; right:4%; width:4px; height:45%; background:linear-gradient(to bottom, ${c.accent}18, transparent); }
    .decor-pageno { position:absolute; bottom:28px; right:36px; width:32px; height:32px; border:1px solid ${c.accent}20; border-radius:50%; }
    .decor-dot-row { position:absolute; top:46%; right:3%; width:6px; height:6px; border-radius:50%; background:${c.accent}18; box-shadow:0 14px 0 ${c.accent}12, 0 28px 0 ${c.accent}08; }
    .content { padding-left:46% !important; padding-right:12% !important; }
    h1 { font-family:"Georgia","Noto Serif SC",serif !important; letter-spacing:-0.5px; position:relative; }
    h1::before { content:""; position:absolute; top:-16px; left:0; width:30px; height:3px; background:${c.accent}; }
    ${_tagCommon("magazine")}
    ${_tagColored("magazine", c)}
    .category-badge { background:transparent !important; color:${c.accentAlt} !important; border:1px solid ${c.accentAlt}30; border-radius:2px !important; font-family:"Georgia","Noto Serif SC",serif; font-style:italic; letter-spacing:1px; }
    .title-sep { border-top-style:double; border-top-color:${c.accent}22; width:70px; }`
    },
  },
  {
    id: "drawio",
    label: "导图",
    description: "白底蓝边、网格辅助线、架构图风格",
    colors: { bg: "#f5f6f8", titleColor: "#1a1a2e", subtitleColor: "#546e7a", accent: "#1565c0", accentAlt: "#0d47a1" },
    decorHtml: `<div class="decor-grid"></div><div class="decor-corner tl"></div><div class="decor-corner tr"></div><div class="decor-corner bl"></div><div class="decor-corner br"></div><div class="decor-connector c1"></div><div class="decor-connector c2"></div><div class="decor-node-a"></div><div class="decor-node-b"></div><div class="decor-crosshair"></div><div class="decor-label-box"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: radial-gradient(circle, ${c.accent}12 1px, transparent 1px); background-size:20px 20px; }
    body::before { content:""; position:absolute; top:10px; left:10px; right:10px; bottom:10px; border:2px solid ${c.accent}18; border-radius:2px; }
    body::after { content:""; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, ${c.accent}, ${c.accentAlt}80, ${c.accent}); }
    .content::before { content:""; position:absolute; top:7%; left:4%; width:16px; height:16px; border:2px solid ${c.accent}30; border-radius:1px; }
    .content::after { content:""; position:absolute; bottom:7%; right:4%; width:16px; height:16px; border:2px solid ${c.accent}30; border-radius:1px; }
    .decor-corner { position:absolute; width:18px; height:18px; border-color:${c.accent}22; border-style:solid; }
    .decor-corner.tl { top:18px; left:18px; border-width:1px 0 0 1px; }
    .decor-corner.tr { top:18px; right:18px; border-width:1px 1px 0 0; }
    .decor-corner.bl { bottom:18px; left:18px; border-width:0 0 1px 1px; }
    .decor-corner.br { bottom:18px; right:18px; border-width:0 1px 1px 0; }
    .decor-grid { position:absolute; inset:0; background-image:linear-gradient(${c.accent}05 1px, transparent 1px), linear-gradient(90deg, ${c.accent}05 1px, transparent 1px); background-size:60px 60px; }
    .decor-connector { position:absolute; height:1px; background:${c.accent}20; transform-origin:left center; }
    .decor-connector.c1 { top:25%; left:10%; width:120px; transform:rotate(-15deg); border-top:1px dashed ${c.accent}25; }
    .decor-connector.c2 { top:60%; right:12%; width:90px; transform:rotate(12deg); border-top:1px dashed ${c.accent}20; }
    .decor-node-a { position:absolute; top:18%; left:24%; width:10px; height:10px; border-radius:50%; background:${c.accent}20; border:2px solid ${c.accent}40; }
    .decor-node-b { position:absolute; bottom:22%; right:20%; width:12px; height:12px; border-radius:2px; background:${c.accentAlt}15; border:1.5px solid ${c.accentAlt}35; }
    .decor-crosshair { position:absolute; top:14%; right:18%; width:24px; height:24px; }
    .decor-crosshair::before { content:""; position:absolute; top:50%; left:0; right:0; height:1px; background:${c.accent}18; }
    .decor-crosshair::after { content:""; position:absolute; left:50%; top:0; bottom:0; width:1px; background:${c.accent}18; }
    .decor-label-box { position:absolute; top:12%; left:8%; padding:4px 10px; border:1px solid ${c.accent}20; border-radius:2px; }
    h1 { border-bottom:2px solid ${c.accent}22; padding-bottom:14px; }
    ${_tagCommon("drawio")}
    ${_tagColored("drawio", c)}
    .category-badge { background:${c.accent} !important; color:#fff !important; border-radius:3px !important; font-family:"SF Mono","Consolas",monospace; letter-spacing:1px; }
    .title-sep { border-top-style:solid; border-top-color:${c.accent}30; width:90px; height:1px; border-top-width:1px; }`
    },
  },
  {
    id: "chinese",
    label: "国风",
    description: "暖色宣纸底、水墨深色标题、朱红点缀",
    colors: { bg: "#f5e6d3", titleColor: "#2c1810", subtitleColor: "#5a3e2b", accent: "#c0392b", accentAlt: "#e74c3c" },
    decorHtml: `<div class="decor-seal"></div><div class="decor-seal s2"></div><div class="decor-ink"></div><div class="decor-ink i2"></div><div class="decor-line-v"></div><div class="decor-line-v v2"></div><div class="decor-mountain"></div><div class="decor-cloud"></div><div class="decor-cloud c2"></div><div class="decor-wave"></div>`,
    buildDecorCss(c) {
      return `
    body { background-color:#f5e6d3; background-image: linear-gradient(${c.accent}05 1px, transparent 1px), linear-gradient(90deg, ${c.accent}05 1px, transparent 1px); background-size:60px 60px; }
    body::before { content:""; position:absolute; top:14px; left:14px; width:44px; height:44px; border-top:2px solid ${c.accent}22; border-left:2px solid ${c.accent}22; }
    body::after { content:""; position:absolute; bottom:14px; right:14px; width:44px; height:44px; border-bottom:2px solid ${c.accent}22; border-right:2px solid ${c.accent}22; }
    .content::before { content:""; position:absolute; right:7%; top:8%; width:40px; height:40px; border:1.5px solid ${c.accentAlt}35; transform:rotate(45deg); }
    .content::after { content:""; position:absolute; left:8%; bottom:10%; width:90px; height:1px; background:linear-gradient(90deg, ${c.accent}30, transparent); }
    h1 { font-weight:900 !important; position:relative; }
    h1::after { content:""; position:absolute; bottom:-8px; left:50%; transform:translateX(-50%); width:40px; height:2px; background:${c.accentAlt}30; border-radius:1px; }
    .decor-seal { position:absolute; right:10%; bottom:12%; width:52px; height:52px; border:2px solid ${c.accentAlt}45; color:${c.accentAlt}45; font-size:14px; display:flex; align-items:center; justify-content:center; transform:rotate(15deg); }
    .decor-seal::after { content:"印"; font-family:"KaiTi","STKaiti","楷体",serif; }
    .decor-seal.s2 { right:7%; bottom:20%; width:32px; height:32px; border-color:${c.accentAlt}25; opacity:0.6; transform:rotate(-8deg); }
    .decor-seal.s2::after { content:"鉴"; font-size:10px; }
    .decor-ink { position:absolute; top:12%; right:16%; width:120px; height:120px; border-radius:50%; background:radial-gradient(ellipse at 40% 40%, ${c.accent}08, transparent 70%); }
    .decor-ink.i2 { top:auto; bottom:8%; right:auto; left:10%; width:80px; height:80px; background:radial-gradient(ellipse at 50% 50%, ${c.accentAlt}06, transparent 65%); }
    .decor-line-v { position:absolute; right:4%; top:22%; width:1px; height:54%; background:linear-gradient(to bottom, transparent, ${c.accent}12, transparent); }
    .decor-line-v.v2 { right:auto; left:5%; top:20%; height:40%; background:linear-gradient(to bottom, transparent, ${c.accentAlt}10, transparent); }
    .decor-mountain { position:absolute; bottom:0; left:0; right:0; height:28%; background:linear-gradient(135deg, transparent 25%, ${c.accent}04 25%, ${c.accent}04 35%, transparent 35%, transparent 55%, ${c.accentAlt}03 55%, ${c.accentAlt}03 65%, transparent 65%); clip-path:polygon(0% 100%, 15% 45%, 30% 70%, 45% 30%, 60% 60%, 75% 35%, 90% 55%, 100% 40%, 100% 100%); }
    .decor-cloud { position:absolute; top:10%; left:12%; width:90px; height:24px; background:${c.accent}06; border-radius:12px; }
    .decor-cloud::before { content:""; position:absolute; top:-10px; left:18px; width:30px; height:16px; background:${c.accent}05; border-radius:8px; }
    .decor-cloud.c2 { top:8%; left:auto; right:20%; width:60px; height:16px; opacity:0.6; }
    .decor-cloud.c2::before { top:-7px; left:12px; width:20px; height:10px; }
    .decor-wave { position:absolute; bottom:20%; left:0; right:0; height:2px; background:repeating-linear-gradient(90deg, ${c.accent}10 0px, ${c.accent}10 8px, transparent 8px, transparent 16px); }
    ${_tagCommon("chinese")}
    .tag:nth-child(5n+4) { border-style:dashed; }
    .tag:nth-child(5n+5) { font-weight:bold; }
    .category-badge { background:${c.accentAlt}15 !important; color:${c.accentAlt} !important; border:1px solid ${c.accentAlt}40; border-radius:3px !important; font-family:"KaiTi","STKaiti","楷体",serif; letter-spacing:3px; }
    .title-sep { border-top-color:${c.accentAlt}25; width:100px; height:1px; border-top-width:1px; }`
    },
  },
]

/** 风格预设列表（从注册表派生 label + description） */
export const COVER_STYLE_PRESETS: CoverStylePreset[] = COVER_STYLE_REGISTRY.map(s => ({
  id: s.id,
  label: s.label,
  description: s.description,
}))

// ============================================================
// 封面 HTML 构建
// ============================================================

/** 构建完整封面 HTML（纯代码，无 AI） */
function buildCoverHtml(config: CoverGenerationConfig): string {
  const style = COVER_STYLE_REGISTRY.find(s => s.id === config.styleId) ?? COVER_STYLE_REGISTRY[0]
  const c = style.colors
  const titleSize = Math.max(48, Math.floor(config.width / 15))
  const subtitleSize = Math.max(20, Math.floor(config.width / 40))
  const padding = Math.max(40, Math.floor(config.width / 20))
  const titleText = config.title?.trim() || "无标题"

  // 分类挂饰
  const categoryBadge = config.category?.trim()
    ? `\n    <span class="category-badge">${config.category.trim()}</span>`
    : ""

  // 关键字标签
  let tagsBlock = ""
  if (config.keywords?.trim()) {
    const tagList = config.keywords.trim().split(/\s+/).filter(Boolean)
    const tagsHtml = tagList.map((kw) => `<span class="tag">${kw}</span>`).join("\n      ")
    tagsBlock = `\n    <div class="tags">${tagsHtml}</div>`
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${config.width}px; height: ${config.height}px; overflow: hidden;
    background-color: ${c.bg}; font-family: ${COVER_FONT_FAMILY};
    position: relative;
  }
  .content {
    position: relative; z-index: 2;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; text-align: center; padding: ${padding}px;
  }
  h1 {
    font-size: ${titleSize}px; font-weight: 700; color: ${c.titleColor};
    line-height: 1.3; max-width: 90%;
  }
  .title-row {
    display: flex; align-items: flex-start; justify-content: center;
    flex-wrap: wrap; gap: 12px; max-width: 90%;
  }
  .title-row h1 { max-width: none; }
  .category-badge {
    display: inline-block; padding: 3px 12px; border-radius: 12px;
    background: ${c.accent}; color: #fff; font-size: ${Math.max(13, subtitleSize - 4)}px;
    letter-spacing: 2px; white-space: nowrap; flex-shrink: 0;
    margin-top: ${Math.max(4, Math.floor(titleSize * 0.08))}px;
  }
  .title-sep {
    width: 80px; height: 0;
    margin: 18px auto 0 auto;
    border-top: 2px dashed ${c.accent}30;
  }
  .tags {
    margin-top: 18px; display: flex; flex-wrap: wrap; justify-content: center;
    max-width: 90%; gap: 6px;
  }
  .tag {
    display: inline-block; padding: 6px 18px; border-radius: 20px;
    background: ${c.accent}; color: #fff; font-size: ${subtitleSize}px;
  }
  .watermark {
    position: absolute; bottom: ${Math.max(16, Math.floor(padding / 3))}px; left: ${Math.max(16, Math.floor(padding / 3))}px;
    font-size: ${Math.max(11, subtitleSize - 8)}px; color: ${c.subtitleColor}; opacity: 0.35;
    z-index: 3; letter-spacing: 2px;
  }
  .decor-layer { position: absolute; inset: 0; z-index: 1; pointer-events: none; }

  /* === 风格装饰 === */
  ${style.buildDecorCss(c)}
</style>
</head>
<body>
  <div class="decor-layer">${style.decorHtml}</div>
  <div class="content">
    <div class="title-row">
      <h1>${titleText}</h1>${categoryBadge}
    </div>
    <div class="title-sep"></div>${tagsBlock}
  </div>
  <span class="watermark">${config.watermark || ""}</span>
</body>
</html>`
}

// ============================================================
// Composable
// ============================================================

export function useCoverGenerator() {
  const coverHtml = ref("")
  const generationStatus = ref<CoverGenerationStatus>("idle")
  const errorMessage = ref("")
  const currentConfig = ref<CoverGenerationConfig>({
    title: "",
    category: "",
    keywords: "",
    watermark: "叫我少年",
    width: 1200,
    height: 630,
    styleId: "minimal",
  })

  function generateCover(config?: Partial<CoverGenerationConfig>): void {
    if (config) {
      Object.assign(currentConfig.value, config)
    }

    if (!currentConfig.value.title.trim()) {
      errorMessage.value = "请输入文章标题"
      generationStatus.value = "error"
      return
    }

    generationStatus.value = "generating"
    errorMessage.value = ""

    try {
      coverHtml.value = buildCoverHtml(currentConfig.value)
      generationStatus.value = "done"
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "封面生成失败"
      errorMessage.value = msg
      generationStatus.value = "error"
    }
  }

  function reset(): void {
    coverHtml.value = ""
    generationStatus.value = "idle"
    errorMessage.value = ""
    currentConfig.value = {
      title: "",
      category: "",
      keywords: "",
      watermark: "叫我少年",
      width: 1200,
      height: 630,
      styleId: "minimal",
    }
  }

  return {
    coverHtml,
    generationStatus,
    errorMessage,
    currentConfig,
    generateCover,
    reset,
    COVER_SIZE_PRESETS,
    COVER_STYLE_PRESETS,
  }
}
