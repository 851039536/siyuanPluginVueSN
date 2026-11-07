// src/features/gitPush/utils/workspaceFile.spec.ts — 工作区文件分类/图标与只读预览边界测试
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest"
import {
  classifyWorkspaceFile,
  IMAGE_PREVIEW_LIMIT,
  readWorkspaceFilePreview,
  resolveWorkspacePath,
  TEXT_PREVIEW_LIMIT,
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

describe("readWorkspaceFilePreview（真实临时目录）", () => {
  let root = ""

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "gp-workspace-files-"))
    writeFileSync(join(root, "note.md"), "# hi")
    writeFileSync(join(root, "script.ts"), "const a = 1")
    writeFileSync(join(root, "binary.bin"), Buffer.from([0x61, 0x00, 0x62]))
    writeFileSync(join(root, "big.txt"), "a".repeat(TEXT_PREVIEW_LIMIT + 10))
    writeFileSync(join(root, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    writeFileSync(join(root, "big.png"), Buffer.alloc(IMAGE_PREVIEW_LIMIT + 1))
    mkdirSync(join(root, "src", "deep"), { recursive: true })
    writeFileSync(join(root, "src", "deep", "file.txt"), "x")
  })

  afterAll(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it("文本与 Markdown：返回内容、体积且不标记截断", () => {
    const text = readWorkspaceFilePreview(root, "script.ts")
    expect(text.kind).toBe("text")
    expect(text.content).toBe("const a = 1")
    expect(text.truncated).toBe(false)
    expect(text.size).toBe("const a = 1".length)

    const md = readWorkspaceFilePreview(root, "note.md")
    expect(md.kind).toBe("markdown")
    expect(md.content).toBe("# hi")
  })

  it("嵌套路径按平台分隔符解析（git 的 / 转为本地 sep）", () => {
    const resolved = resolveWorkspacePath(root, "src/deep/file.txt")
    expect(resolved).not.toBeNull()
    expect(resolved!.endsWith(join("src", "deep", "file.txt"))).toBe(true)
    expect(readWorkspaceFilePreview(root, "src/deep/file.txt").content).toBe("x")
  })

  it("含 NUL 字节的文件判定为二进制，不返回内容", () => {
    const preview = readWorkspaceFilePreview(root, "binary.bin")
    expect(preview.kind).toBe("binary")
    expect(preview.content).toBeUndefined()
    expect(preview.size).toBe(3)
  })

  it("超过 256 KB 的文本只读前缀并标记 truncated", () => {
    const preview = readWorkspaceFilePreview(root, "big.txt")
    expect(preview.kind).toBe("text")
    expect(preview.truncated).toBe(true)
    // ASCII 1 字节/字符：内容长度恰为前缀上限
    expect(preview.content?.length).toBe(TEXT_PREVIEW_LIMIT)
    expect(preview.size).toBe(TEXT_PREVIEW_LIMIT + 10)
  })

  it("图片返回 data URL", () => {
    const preview = readWorkspaceFilePreview(root, "image.png")
    expect(preview.kind).toBe("image")
    expect(preview.dataUrl?.startsWith("data:image/png;base64,")).toBe(true)
    expect(preview.size).toBe(4)
  })

  it("超过 2 MB 的图片只返回 oversized 与体积，不生成 data URL", () => {
    const preview = readWorkspaceFilePreview(root, "big.png")
    expect(preview.kind).toBe("oversized")
    expect(preview.size).toBe(IMAGE_PREVIEW_LIMIT + 1)
    expect(preview.dataUrl).toBeUndefined()
  })

  it("文件不存在返回 missing", () => {
    expect(readWorkspaceFilePreview(root, "missing.txt").kind).toBe("missing")
  })

  it("父目录越界（../）被拒绝", () => {
    expect(resolveWorkspacePath(root, "../escape.txt")).toBeNull()
    expect(readWorkspaceFilePreview(root, "../escape.txt").kind).toBe("error")
  })

  it("绝对路径被拒绝（不得用仓库外路径预览）", () => {
    expect(resolveWorkspacePath(root, "/etc/passwd")).toBeNull()
    expect(readWorkspaceFilePreview(root, "/etc/passwd").kind).toBe("error")
  })
})
