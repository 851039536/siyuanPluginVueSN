// src/features/floatingToolbar/core/barcode.spec.ts — 条形码输入校验与参数钳制的行为断言
//
// 用例边界均以 JsBarcode 3.12 的实测行为为准（见下），而非凭文档推测：
//   - 非法输入**不抛异常**，仅回调 valid(false) 并留下空白画布
//   - CODE128 仅支持 ASCII（中文等非 ASCII 会通过 valid(false) 被拒）
//   - CODE39 接受小写字母（内部转大写），仅字符集之外的值非法
//   - EAN13 接受 12 位（自动补校验位）与 13 位（校验位需正确）
//   - ITF14 接受 13 位与 14 位
import { describe, expect, it } from "vitest"
import {
  BARCODE_FORMATS,
  BARCODE_HEIGHT_RANGE,
  BARCODE_WIDTH_RANGE,
  clampBarcodeOptions,
  validateBarcodeInput,
} from "./barcode"

describe("validateBarcodeInput — 空值", () => {
  it("空串与纯空白一律判 empty（与格式无关）", () => {
    for (const format of ["CODE128", "CODE39", "EAN13", "ITF14"] as const) {
      expect(validateBarcodeInput(format, "")).toBe("empty")
      expect(validateBarcodeInput(format, "   ")).toBe("empty")
      expect(validateBarcodeInput(format, "\t\n")).toBe("empty")
    }
  })

  it("前后空白不影响判定（内部先 trim）", () => {
    expect(validateBarcodeInput("CODE128", "  Hello-123  ")).toBeNull()
    expect(validateBarcodeInput("EAN13", "  123456789012  ")).toBeNull()
  })
})

describe("validateBarcodeInput — CODE128", () => {
  it("放行任意 ASCII", () => {
    expect(validateBarcodeInput("CODE128", "Hello-123")).toBeNull()
    expect(validateBarcodeInput("CODE128", "a-z_0-9")).toBeNull()
    expect(validateBarcodeInput("CODE128", "!@#$%^&*()")).toBeNull()
    expect(validateBarcodeInput("CODE128", "tab\tchar")).toBeNull()
  })

  it("拒绝非 ASCII（中文/全角/组合符），因 JsBarcode 会判 valid=false", () => {
    expect(validateBarcodeInput("CODE128", "中文内容")).toBe("unsupported-chars")
    expect(validateBarcodeInput("CODE128", "Hello~世界")).toBe("unsupported-chars")
    expect(validateBarcodeInput("CODE128", "e\u0301")).toBe("unsupported-chars")
    expect(validateBarcodeInput("CODE128", "ＡＢＣ")).toBe("unsupported-chars")
  })

  it("放行长文本（CODE128 无长度上限）", () => {
    expect(validateBarcodeInput("CODE128", "A".repeat(300))).toBeNull()
  })
})

describe("validateBarcodeInput — CODE39", () => {
  it("放行数字、大写字母与允许的符号", () => {
    expect(validateBarcodeInput("CODE39", "ABC-123")).toBeNull()
    expect(validateBarcodeInput("CODE39", "A.B$C/D+E%F")).toBeNull()
    expect(validateBarcodeInput("CODE39", "A B")).toBeNull()
  })

  it("放行小写字母（JsBarcode 内部转大写，实测合法）", () => {
    expect(validateBarcodeInput("CODE39", "abc")).toBeNull()
  })

  it("拒绝字符集之外的值", () => {
    expect(validateBarcodeInput("CODE39", "AB@C")).toBe("unsupported-chars")
    expect(validateBarcodeInput("CODE39", "AB_C")).toBe("unsupported-chars")
    expect(validateBarcodeInput("CODE39", "中文")).toBe("unsupported-chars")
  })
})

describe("validateBarcodeInput — EAN13", () => {
  it("放行 12 位与 13 位纯数字", () => {
    expect(validateBarcodeInput("EAN13", "123456789012")).toBeNull()
    expect(validateBarcodeInput("EAN13", "1234567890128")).toBeNull()
  })

  it("拒绝位数不符（11/14 位）", () => {
    expect(validateBarcodeInput("EAN13", "12345678901")).toBe("ean13-format")
    expect(validateBarcodeInput("EAN13", "12345678901234")).toBe("ean13-format")
  })

  it("拒绝含非数字字符", () => {
    expect(validateBarcodeInput("EAN13", "12345678901a")).toBe("ean13-format")
    expect(validateBarcodeInput("EAN13", "1234-5678901")).toBe("ean13-format")
  })

  it("13 位校验位错误交由 JsBarcode 的 valid 回调兜底（此处不拦）", () => {
    // 前置校验只看位数与字符集：校验位数学正确性由库判定
    expect(validateBarcodeInput("EAN13", "1234567890123")).toBeNull()
  })
})

describe("validateBarcodeInput — ITF14", () => {
  it("放行 13 位与 14 位纯数字", () => {
    expect(validateBarcodeInput("ITF14", "1234567890123")).toBeNull()
    expect(validateBarcodeInput("ITF14", "12345678901231")).toBeNull()
  })

  it("拒绝位数不符（12/15 位）", () => {
    expect(validateBarcodeInput("ITF14", "123456789012")).toBe("itf14-format")
    expect(validateBarcodeInput("ITF14", "123456789012345")).toBe("itf14-format")
  })

  it("拒绝含非数字字符", () => {
    expect(validateBarcodeInput("ITF14", "12345678901a3")).toBe("itf14-format")
  })
})

describe("BARCODE_FORMATS", () => {
  it("四项格式齐备且 JsBarcode 标识唯一", () => {
    const values = BARCODE_FORMATS.map((f) => f.value)
    expect(values).toEqual(["CODE128", "CODE39", "EAN13", "ITF14"])
    expect(new Set(values).size).toBe(values.length)
  })

  it("每项都带非空 hint", () => {
    for (const format of BARCODE_FORMATS) {
      expect(format.hint.length).toBeGreaterThan(0)
    }
  })
})

describe("clampBarcodeOptions", () => {
  it("范围内的值原样保留", () => {
    expect(clampBarcodeOptions({ width: 2, height: 80, displayValue: true })).toEqual({
      width: 2,
      height: 80,
      displayValue: true,
    })
  })

  it("越界值收敛到边界", () => {
    expect(clampBarcodeOptions({ width: 99, height: 999, displayValue: true })).toEqual({
      width: BARCODE_WIDTH_RANGE.max,
      height: BARCODE_HEIGHT_RANGE.max,
      displayValue: true,
    })
    expect(clampBarcodeOptions({ width: 0, height: 0, displayValue: false })).toEqual({
      width: BARCODE_WIDTH_RANGE.min,
      height: BARCODE_HEIGHT_RANGE.min,
      displayValue: false,
    })
  })

  it("非有限值回落为下限（否则会画出 0 宽/NaN 尺寸）", () => {
    // NaN / ±Infinity 都不是有意义的尺寸：一律取安全下限，
    // 不因为是「超大值」就取上限 —— 上限同样不是用户意图
    expect(clampBarcodeOptions({ width: Number.NaN, height: Number.POSITIVE_INFINITY, displayValue: true })).toEqual({
      width: BARCODE_WIDTH_RANGE.min,
      height: BARCODE_HEIGHT_RANGE.min,
      displayValue: true,
    })
    expect(clampBarcodeOptions({ width: Number.NEGATIVE_INFINITY, height: Number.NaN, displayValue: true })).toEqual({
      width: BARCODE_WIDTH_RANGE.min,
      height: BARCODE_HEIGHT_RANGE.min,
      displayValue: true,
    })
  })

  it("displayValue 强制转布尔", () => {
    const result = clampBarcodeOptions({
      width: 2,
      height: 80,
      displayValue: 0 as unknown as boolean,
    })
    expect(result.displayValue).toBe(false)
  })

  it("不修改入参（纯函数）", () => {
    const input = { width: 99, height: 999, displayValue: true }
    clampBarcodeOptions(input)
    expect(input).toEqual({ width: 99, height: 999, displayValue: true })
  })
})
