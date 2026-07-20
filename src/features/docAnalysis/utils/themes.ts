/**
 * 发布平台主题预设 - 微信公众号排版
 */
import type { PublishTheme } from "../types/index"

const wechatTheme: PublishTheme = {
  id: "wechat",
  name: "微信公众号",
  container: {
    "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    "font-size": "15px",
    "line-height": "1.75",
    "color": "#3e3e3e",
    "background": "#ffffff",
    "padding": "20px 16px",
  },
  elements: {
    "h1": {
      "font-size": "22px",
      "font-weight": "700",
      "color": "#1a1a1a",
      "margin": "0 0 16px 0",
      "text-align": "center",
    },
    "h2": {
      "font-size": "19px",
      "font-weight": "600",
      "color": "#1a1a1a",
      "margin": "24px 0 12px 0",
      "padding-bottom": "6px",
      "border-bottom": "2px solid #07c160",
    },
    "h3": {
      "font-size": "17px",
      "font-weight": "600",
      "color": "#1a1a1a",
      "margin": "20px 0 10px 0",
      "padding-left": "10px",
      "border-left": "3px solid #07c160",
    },
    "h4": {
      "font-size": "15px",
      "font-weight": "600",
      "color": "#333",
      "margin": "16px 0 8px 0",
    },
    "p": {
      "margin": "0 0 14px 0",
      "text-align": "justify",
      "letter-spacing": "0.5px",
    },
    "a": {
      "color": "#576b95",
      "text-decoration": "none",
    },
    "strong": {
      "color": "#1a1a1a",
      "font-weight": "600",
    },
    "blockquote": {
      "padding": "10px 16px",
      "margin": "14px 0",
      "background": "#f8f8f8",
      "border-left": "4px solid #07c160",
      "color": "#666",
      "font-size": "14px",
    },
    "ul": {
      "padding-left": "24px",
      "margin": "10px 0",
    },
    "ol": {
      "padding-left": "24px",
      "margin": "10px 0",
    },
    "li": {
      "margin-bottom": "6px",
    },
    "code": {
      "background": "#f0f0f0",
      "padding": "2px 6px",
      "border-radius": "3px",
      "font-family": "Consolas, Monaco, 'Courier New', monospace",
      "font-size": "13px",
      "color": "#d14",
    },
    "pre": {
      "background": "#282c34",
      "padding": "16px",
      "margin": "14px 0",
      "border-radius": "6px",
      "overflow-x": "auto",
      "font-size": "13px",
      "line-height": "1.6",
    },
    "pre code": {
      "background": "transparent",
      "padding": "0",
      "color": "#abb2bf",
      "font-size": "13px",
    },
    "table": {
      "border-collapse": "collapse",
      "width": "100%",
      "margin": "14px 0",
      "font-size": "14px",
    },
    "th": {
      "background": "#f5f7fa",
      "padding": "10px 12px",
      "border": "1px solid #e0e0e0",
      "font-weight": "600",
      "text-align": "left",
    },
    "td": {
      "padding": "8px 12px",
      "border": "1px solid #e0e0e0",
    },
    "img": {
      "max-width": "100%",
      "border-radius": "4px",
      "display": "block",
      "margin": "10px auto",
    },
    "hr": {
      "border": "none",
      "border-top": "1px solid #e0e0e0",
      "margin": "20px 0",
    },
  },
  codeTheme: "github",
}

/** 默认主题 */
export const DEFAULT_THEME = wechatTheme

