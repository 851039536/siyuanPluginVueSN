// ============================================================
// 新增封面风格（v2 扩展：扁平 / 手绘涂鸦 / 终端 / 8bit / 漫画 / 像素 / 日式RPG）
// 与基础风格共用 tag 助手（见 coverStylesShared.ts）
// ============================================================

import type { StyleDefinition } from "./coverStylesShared"
import { tagColoredStyles, tagCommonStyles } from "./coverStylesShared"

export const NEW_COVER_STYLES: StyleDefinition[] = [
  {
    id: "flat",
    label: "扁平风",
    description: "简洁色块、无阴影、现代扁平设计",
    colors: {
      bg: "#f7f9fc",
      titleColor: "#1a1a2e",
      subtitleColor: "#5a6b85",
      accent: "#4361ee",
      accentAlt: "#7209b7",
    },
    decorHtml: `<div class="flat-circle"></div><div class="flat-bar"></div><div class="flat-dot-row"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: linear-gradient(160deg, ${c.bg} 0%, #e8edf7 100%); }
    .flat-circle { position:absolute; top:-70px; right:-70px; width:240px; height:240px; border-radius:50%; background:${c.accent}10; }
    .flat-circle::after { content:""; position:absolute; bottom:24px; left:-80px; width:120px; height:120px; border-radius:50%; background:${c.accentAlt}10; }
    .flat-bar { position:absolute; top:16%; left:-30px; width:120px; height:18px; border-radius:9px; background:${c.accent}18; transform:rotate(-8deg); }
    .flat-dot-row { position:absolute; bottom:18%; right:8%; width:80px; height:12px; background-image:radial-gradient(circle, ${c.accent}25 3px, transparent 3px); background-size:16px 12px; }
    h1 { font-weight:800 !important; }
    ${tagCommonStyles("minimal")}
    .category-badge { background:${c.accent} !important; color:#fff !important; border-radius:6px !important; font-weight:600; }
    .title-sep { border-top-color:${c.accent}25; width:70px; }`
    },
  },
  {
    id: "doodle",
    label: "手绘涂鸦风",
    description: "波浪线、虚线边框、手账感涂鸦",
    colors: {
      bg: "#fffdf6",
      titleColor: "#3b3b3b",
      subtitleColor: "#8a8a8a",
      accent: "#f59f00",
      accentAlt: "#e8590c",
    },
    decorHtml: `<div class="doodle-star"></div><div class="doodle-circle"></div><div class="doodle-squiggle"></div><div class="doodle-underline"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px); background-size:18px 18px; }
    .doodle-star { position:absolute; top:12%; right:10%; font-size:34px; color:${c.accent}; transform:rotate(12deg); }
    .doodle-star::before { content:"✦"; }
    .doodle-circle { position:absolute; bottom:16%; left:8%; width:90px; height:90px; border:2px dashed ${c.accentAlt}40; border-radius:50%; }
    .doodle-squiggle { position:absolute; top:22%; left:6%; width:110px; height:20px; border-top:3px solid ${c.accent}30; border-radius:50%; transform:rotate(-6deg); }
    .doodle-underline { position:absolute; bottom:30%; right:8%; width:70px; height:10px; border-bottom:3px solid ${c.accentAlt}25; border-radius:50%; }
    h1 { text-decoration:underline; text-decoration-style:wavy; text-decoration-color:${c.accent}50; text-underline-offset:10px; }
    ${tagCommonStyles("minimal")}
    .tag { border-style:dashed !important; }
    .category-badge { background:transparent !important; color:${c.accent} !important; border:2px dashed ${c.accent}60 !important; border-radius:8px !important; transform:rotate(-2deg); }
    .title-sep { border-top-width:2px; width:80px; }`
    },
  },
  {
    id: "terminal",
    label: "终端风",
    description: "黑底绿字、等宽字体、极客终端",
    colors: {
      bg: "#0d1117",
      titleColor: "#00ff9c",
      subtitleColor: "#8b949e",
      accent: "#00ff9c",
      accentAlt: "#ffa657",
    },
    decorHtml: `<div class="term-line t1"></div><div class="term-line t2"></div><div class="term-scan"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: linear-gradient(rgba(0,255,156,0.03) 1px, transparent 1px); background-size:100% 24px; }
    .term-line { position:absolute; font-family:"JetBrains Mono","SF Mono","Consolas",monospace; font-size:13px; color:${c.accent}; opacity:0.7; letter-spacing:0.5px; }
    .term-line.t1 { top:14%; left:7%; }
    .term-line.t1::after { content:"$ cargo run --release ▊"; }
    .term-line.t2 { bottom:18%; left:7%; }
    .term-line.t2::after { content:"❯ deploy complete"; }
    .term-scan { position:absolute; left:0; right:0; bottom:10%; height:2px; background:linear-gradient(90deg, transparent, ${c.accent}30, transparent); }
    h1 { font-family:"JetBrains Mono","SF Mono","Consolas",monospace !important; text-shadow:0 0 24px ${c.accent}40; letter-spacing:1px; }
    ${tagCommonStyles("tech")}
    .category-badge { background:${c.accentAlt}18 !important; color:${c.accentAlt} !important; border:1px solid ${c.accentAlt}50 !important; border-radius:2px !important; font-family:"JetBrains Mono","SF Mono","Consolas",monospace !important; letter-spacing:1px; }
    .title-sep { border-top-color:${c.accent}30; width:90px; }`
    },
  },
  {
    id: "8bit",
    label: "8bit",
    description: "像素方块、硬阴影、街机复古",
    colors: {
      bg: "#1a1c2c",
      titleColor: "#f4f4f4",
      subtitleColor: "#9d9d9d",
      accent: "#fcee4a",
      accentAlt: "#ef476f",
    },
    decorHtml: `<div class="pixel-block b1"></div><div class="pixel-block b2"></div><div class="pixel-block b3"></div><div class="pixel-coin"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size:32px 32px; }
    .pixel-block { position:absolute; }
    .pixel-block.b1 { top:12%; left:10%; width:24px; height:24px; background:${c.accent}; box-shadow:24px 0 0 ${c.accent}88, 48px 0 0 ${c.accent}55, 0 24px 0 ${c.accent}88, 24px 24px 0 ${c.accent}55; }
    .pixel-block.b2 { bottom:14%; right:12%; width:16px; height:16px; background:${c.accentAlt}; box-shadow:16px 0 0 ${c.accentAlt}88; }
    .pixel-block.b3 { top:26%; right:16%; width:12px; height:12px; background:#ffffff; box-shadow:12px 12px 0 ${c.accent}; }
    .pixel-coin { position:absolute; top:46%; left:14%; width:18px; height:18px; background:${c.accent}; border:3px solid ${c.accentAlt}; }
    h1 { text-shadow:4px 4px 0 ${c.accent}66; font-weight:900 !important; }
    ${tagCommonStyles("drawio")}
    .tag { border-radius:0 !important; }
    .category-badge { background:${c.accent} !important; color:#1a1c2c !important; border-radius:0 !important; font-weight:800; }
    .title-sep { border-top:3px solid ${c.accent}55; width:70px; }`
    },
  },
  {
    id: "comic",
    label: "漫画风",
    description: "半调网点、星形爆炸、漫画描边",
    colors: {
      bg: "#fff3d6",
      titleColor: "#212529",
      subtitleColor: "#868e96",
      accent: "#fa5252",
      accentAlt: "#ffd43b",
    },
    decorHtml: `<div class="comic-halftone"></div><div class="comic-burst"></div><div class="comic-line l1"></div><div class="comic-line l2"></div>`,
    buildDecorCss(c) {
      return `
    body { background-color:${c.bg}; }
    .comic-halftone { position:absolute; inset:0; background-image:radial-gradient(circle, ${c.accent}12 1.5px, transparent 1.5px); background-size:14px 14px; }
    .comic-burst { position:absolute; top:10%; right:8%; width:80px; height:80px; background:${c.accentAlt}; clip-path:polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); transform:rotate(8deg); }
    .comic-line { position:absolute; height:3px; background:${c.accent}25; }
    .comic-line.l1 { top:24%; left:4%; width:120px; transform:rotate(-8deg); }
    .comic-line.l2 { bottom:22%; right:5%; width:90px; transform:rotate(6deg); }
    h1 { position:relative; font-weight:900 !important; }
    h1::after { content:""; position:absolute; left:50%; bottom:-10px; transform:translateX(-50%); width:70%; height:6px; background:${c.accent}; border-radius:3px; }
    ${tagCommonStyles("magazine")}
    .tag { font-style:normal !important; font-weight:700; }
    .category-badge { background:${c.accent} !important; color:#fff !important; border-radius:2px !important; transform:skew(-8deg); font-weight:800; }
    .title-sep { border-top:3px solid ${c.accent}45; width:80px; }`
    },
  },
  {
    id: "pixel",
    label: "像素风",
    description: "抖动渐变、像素块拼贴、暗色像素画",
    colors: {
      bg: "#1b1b1f",
      titleColor: "#e8e8e8",
      subtitleColor: "#9aa0a6",
      accent: "#5b8def",
      accentAlt: "#ef476f",
    },
    decorHtml: `<div class="px-dither"></div><div class="px-diamond"></div><div class="px-grid"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.02) 75%), linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.02) 75%); background-size:8px 8px; background-position:0 0, 4px 4px; }
    .px-dither { position:absolute; inset:0; background-image:linear-gradient(90deg, transparent 0 5px, ${c.accent}08 5px 10px); background-size:10px 10px; opacity:0.6; }
    .px-diamond { position:absolute; bottom:16%; left:12%; width:20px; height:20px; background:${c.accentAlt}; box-shadow:-20px 0 0 ${c.accentAlt}66, 0 -20px 0 ${c.accentAlt}66, 20px 0 0 ${c.accentAlt}aa; transform:rotate(45deg); }
    .px-grid { position:absolute; top:14%; right:10%; width:24px; height:24px; background:${c.accent}; box-shadow:24px 24px 0 ${c.accent}88, 0 48px 0 ${c.accent}44; }
    h1 { text-shadow:3px 3px 0 rgba(0,0,0,0.35); font-weight:900 !important; }
    ${tagCommonStyles("drawio")}
    .tag { border-radius:0 !important; }
    .category-badge { background:${c.accent} !important; color:#fff !important; border-radius:0 !important; }
    .title-sep { border-top:3px solid ${c.accent}50; width:70px; }`
    },
  },
  {
    id: "jrpg",
    label: "日式RPG",
    description: "暗夜渐变、鎏金描边、对话窗底栏",
    colors: {
      bg: "#0b1026",
      titleColor: "#f8e9a1",
      subtitleColor: "#b8c4d9",
      accent: "#e5c15c",
      accentAlt: "#7aa2f7",
    },
    decorHtml: `<div class="jrpg-corner tl"></div><div class="jrpg-corner tr"></div><div class="jrpg-corner bl"></div><div class="jrpg-corner br"></div><div class="jrpg-dialog"></div><div class="jrpg-spark s1"></div><div class="jrpg-spark s2"></div>`,
    buildDecorCss(c) {
      return `
    body { background-image: linear-gradient(180deg, #0b1026 0%, #1b2a4a 100%); }
    .jrpg-corner { position:absolute; width:34px; height:34px; border:2px solid ${c.accent}66; }
    .jrpg-corner.tl { top:20px; left:20px; border-width:2px 0 0 2px; }
    .jrpg-corner.tr { top:20px; right:20px; border-width:2px 2px 0 0; }
    .jrpg-corner.bl { bottom:20px; left:20px; border-width:0 0 2px 2px; }
    .jrpg-corner.br { bottom:20px; right:20px; border-width:0 2px 2px 0; }
    .jrpg-dialog { position:absolute; bottom:0; left:0; right:0; height:26%; border-top:2px solid ${c.accent}55; background:linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.45)); }
    .jrpg-dialog::before { content:""; position:absolute; top:18px; left:24px; right:24px; height:2px; background:${c.accent}30; }
    .jrpg-spark { position:absolute; width:8px; height:8px; background:${c.accentAlt}; clip-path:polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
    .jrpg-spark.s1 { top:22%; right:18%; }
    .jrpg-spark.s2 { bottom:34%; left:16%; width:6px; height:6px; opacity:0.7; }
    h1 { font-weight:800 !important; letter-spacing:3px; text-shadow:0 0 30px ${c.accent}45, 0 2px 0 #000000; }
    ${tagCommonStyles("magazine")}
    .category-badge { background:transparent !important; color:${c.accent} !important; border:1px solid ${c.accent}66 !important; border-radius:2px !important; letter-spacing:2px; }
    .title-sep { border-top-color:${c.accent}50; width:80px; }`
    },
  },
]
