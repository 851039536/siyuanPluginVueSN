import { describe, expect, it } from "vitest"
import { parseMarkdown, sanitizeHtml } from "./mdRenderer"

describe("mdRenderer sanitization", () => {
  it("strips script tags from AI-generated markdown", () => {
    const out = parseMarkdown("hello <script>alert(1)</script> world")
    expect(out).not.toContain("<script")
  })
  it("strips onerror handlers on img", () => {
    const out = parseMarkdown('<img src=x onerror="alert(1)">')
    expect(out).not.toContain("onerror")
  })
  it("strips javascript: hrefs", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain("javascript:")
  })
  it("keeps ordinary markdown rendering", () => {
    const out = parseMarkdown("# Title\n\n**bold** text")
    expect(out).toContain("<h1")
    expect(out).toContain("<strong>")
  })
  it("keeps external links", () => {
    const out = parseMarkdown("[a](https://example.com)")
    expect(out).toContain("https://example.com")
  })
})
