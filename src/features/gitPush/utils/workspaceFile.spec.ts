// src/features/gitPush/utils/workspaceFile.spec.ts — 工作区文件分类与图标映射单元测试
import { describe, expect, it } from "vitest"
import {
  classifyWorkspaceFile,
  workspaceFileIcon,
} from "./workspaceFile"

describe("classifyWorkspaceFile", () => {
  it("图片扩展名（大小写不敏感）归类为 image", () => {
    expect(classifyWorkspaceFile("assets/logo.PNG")).toBe("image")
    expect(classifyWorkspaceFile("a/b/photo.jpeg")).toBe("image")
  })

  it("Markdown 归类为 markdown", () => {
    expect(classifyWorkspaceFile("README.md")).toBe("markdown")
    expect(classifyWorkspaceFile("docs/guide.markdown")).toBe("markdown")
  })

  it("其余（含 svg / 无扩展名）按文本处理", () => {
    expect(classifyWorkspaceFile("src/a.ts")).toBe("text")
    expect(classifyWorkspaceFile("icon.svg")).toBe("text")
    expect(classifyWorkspaceFile("LICENSE")).toBe("text")
  })
})

describe("workspaceFileIcon", () => {
  it("按扩展名映射图标", () => {
    expect(workspaceFileIcon("src/App.vue")).toBe("mdi:vuejs")
    expect(workspaceFileIcon("src/a.ts")).toBe("mdi:language-typescript")
    expect(workspaceFileIcon("README.md")).toBe("mdi:language-markdown")
  })

  it("特殊文件名优先于扩展名", () => {
    expect(workspaceFileIcon("Dockerfile")).toBe("mdi:docker")
    expect(workspaceFileIcon("package.json")).toBe("mdi:npm")
  })

  it("未知类型回落通用文件图标；点号开头的文件名不算扩展名", () => {
    expect(workspaceFileIcon("a.unknownext")).toBe("mdi:file-outline")
    expect(workspaceFileIcon(".editorconfig")).toBe("mdi:file-outline")
  })
})
