/**
 * 条形码生成 - 格式定义与输入校验
 *
 * 与二维码（qrcode 库对输入来者不拒）不同，条形码各格式都有严格的字符集与长度约束。
 * JsBarcode 对非法输入**不抛异常**，只是回调 `valid(false)` 并直接返回，
 * 结果是画布保持空白 —— 若不加前置校验，用户会看到一片空白且仍能「复制/下载」出空图。
 * 因此这里把校验独立成纯函数，在渲染前拦截，并把失败原因以**错误码**（而非文案）返回，
 * 由视图层映射到 i18n 文案。
 */

/** 条形码格式标识（与 JsBarcode 的 `format` 取值一致） */
export type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "ITF14"

/** 二维码 / 条形码的码类型 */
export type CodeType = "qrcode" | "barcode"

/** 校验失败原因的错误码 */
export type BarcodeErrorCode =
  | "empty"
  | "ean13-format"
  | "itf14-format"
  | "unsupported-chars"

/** 单个条形码格式的元数据（下拉选项与渲染参数共用） */
export interface BarcodeFormatMeta {
  /** JsBarcode 格式标识 */
  value: BarcodeFormat
  /** 允许的输入提示（用于 placeholder 与文档，非校验逻辑） */
  hint: string
}

/**
 * 支持的条形码格式（顺序即下拉框展示顺序，CODE128 最通用故置首）
 *
 * 选型理由：CODE128（全 ASCII、密度最高，日常首选）、CODE39（工业/资产标签常见）、
 * EAN13（商品零售标准）、ITF14（物流外箱标准）。
 */
export const BARCODE_FORMATS: readonly BarcodeFormatMeta[] = [
  { value: "CODE128", hint: "任意 ASCII 字符，如 Hello-123" },
  { value: "CODE39", hint: "数字、大写字母与 - . $ / + % 空格" },
  { value: "EAN13", hint: "12 或 13 位数字（13 位时校验位需正确）" },
  { value: "ITF14", hint: "13 或 14 位数字" },
] as const

/** 仅数字 */
const DIGITS_ONLY = /^\d+$/

/**
 * CODE39 允许的字符集
 *
 * ⚠️ JsBarcode 的 CODE39 实现**接受小写字母**（内部自动转大写），
 * 故这里放行 `a-z`；仅 `A-Z 0-9` 与 `- . $ / + % 空格` 之外的字符才判非法。
 */
const CODE39_ALLOWED = /^[A-Z0-9\-. $/+%]+$/i

/**
 * CODE128 允许的字符集
 *
 * JsBarcode 的 CODE128 仅支持 ASCII（0x00–0x7F）。实测中文等非 ASCII 字符会
 * `valid(false)`，故此处显式拦截，避免用户只看到空白画布。
 */
// eslint-disable-next-line no-control-regex
const ASCII_ONLY = /^[\u0000-\u007F]+$/

/**
 * 校验条形码输入是否可被指定格式编码
 *
 * @param format 目标格式
 * @param content 用户输入内容（调用方应传原始输入，本函数自行 trim 以对齐 JsBarcode 行为）
 * @returns 可编码时返回 `null`；否则返回对应的错误码
 */
export function validateBarcodeInput(
  format: BarcodeFormat,
  content: string,
): BarcodeErrorCode | null {
  // 各分支统一按 trim 后的内容判定：前后空白不应让格式校验失败
  // （CODE128/CODE39 的空格是合法字符，但纯空白输入无意义，按 empty 处理）
  const value = (content ?? "").trim()

  if (!value) {
    return "empty"
  }

  switch (format) {
    case "EAN13":
      // 12 位：JsBarcode 自动补校验位；13 位：校验位必须正确（交 JsBarcode 判定）
      if (!DIGITS_ONLY.test(value) || (value.length !== 12 && value.length !== 13)) {
        return "ean13-format"
      }
      return null

    case "ITF14":
      if (!DIGITS_ONLY.test(value) || (value.length !== 13 && value.length !== 14)) {
        return "itf14-format"
      }
      return null

    case "CODE39":
      if (!CODE39_ALLOWED.test(value)) {
        return "unsupported-chars"
      }
      return null

    case "CODE128":
      if (!ASCII_ONLY.test(value)) {
        return "unsupported-chars"
      }
      return null

    default:
      // 类型上不可达；保守放行交由 JsBarcode 处理
      return null
  }
}

/**
 * 条形码渲染选项（与 JsBarcodeOptions 的子集对应，便于单测与视图层共用）
 */
export interface BarcodeRenderOptions {
  width: number
  height: number
  displayValue: boolean
}

/** 条形码参数的可调范围（滑块与钳制共用，避免 UI 与逻辑两处硬编码） */
export const BARCODE_WIDTH_RANGE = { min: 1, max: 4, step: 0.5 } as const
export const BARCODE_HEIGHT_RANGE = { min: 40, max: 160, step: 10 } as const

/**
 * 把渲染参数钳制到合法范围
 *
 * 滑块的取值本就在范围内，但参数可能来自持久化配置或外部传入，
 * 越界值会让 JsBarcode 画出异常尺寸（如 0 宽）甚至报错，故统一收敛。
 *
 * @param options 待钳制的渲染参数
 * @returns 钳制后的新对象（纯函数，不改入参）
 */
export function clampBarcodeOptions(
  options: BarcodeRenderOptions,
): BarcodeRenderOptions {
  const clamp = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

  return {
    width: clamp(
      options.width,
      BARCODE_WIDTH_RANGE.min,
      BARCODE_WIDTH_RANGE.max,
      BARCODE_WIDTH_RANGE.min,
    ),
    height: clamp(
      options.height,
      BARCODE_HEIGHT_RANGE.min,
      BARCODE_HEIGHT_RANGE.max,
      BARCODE_HEIGHT_RANGE.min,
    ),
    displayValue: Boolean(options.displayValue),
  }
}
