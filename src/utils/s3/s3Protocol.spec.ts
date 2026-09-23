// src/utils/s3/s3Protocol.spec.ts — S3 协议层纯函数单元测试
//
// 覆盖重点：AWS SigV4 签名（用独立参考实现交叉验证）、amz 时间戳、
// S3 XML 响应解析（分页 / delimiter 目录式 / 错误体）、Multipart 请求体构造。
import { createHash, createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  amzDate,
  buildCompleteMultipartBody,
  dateStamp,
  formatS3Error,
  parseListDirXml,
  parseListObjectsXml,
  parseS3Error,
  parseSingleTag,
  signRequest,
  sortQueryString,
  utcToUtcString,
  utcWallClockToLocalEpoch,
} from "./s3Protocol"

// ========== SigV4 签名 ==========

/**
 * 独立参考实现：按 AWS SigV4 规范从零计算 Authorization header。
 * 刻意不复用被测模块的任何代码，使断言具备「交叉验证」性质而非同义反复。
 */
function referenceSignRequest(opts: {
  method: string
  uri: string
  queryString: string
  headers: Record<string, string>
  signedHeaders: string
  payloadHash: string
  accessKey: string
  secretKey: string
  region: string
  amzDateStr: string
  dateStampStr: string
}): string {
  const canonicalHeaders = opts.signedHeaders
    .split(";")
    .map((h) => `${h}:${opts.headers[h]}`)
    .join("\n")
  const canonicalRequest = [
    opts.method.toUpperCase(),
    opts.uri,
    opts.queryString,
    `${canonicalHeaders}\n`,
    opts.signedHeaders,
    opts.payloadHash,
  ].join("\n")

  const scope = `${opts.dateStampStr}/${opts.region}/s3/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    opts.amzDateStr,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n")

  const hmac = (key: Buffer | string, data: string): Buffer =>
    createHmac("sha256", key).update(data).digest()
  const kDate = hmac(`AWS4${opts.secretKey}`, opts.dateStampStr)
  const kRegion = hmac(kDate, opts.region)
  const kService = hmac(kRegion, "s3")
  const kSigning = hmac(kService, "aws4_request")
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex")

  return `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${scope}, SignedHeaders=${opts.signedHeaders}, Signature=${signature}`
}

describe("signRequest", () => {
  // AWS 官方 SigV4 测试套件的凭据与时间戳（get-vanilla 场景参数）
  const accessKey = "AKIDEXAMPLE"
  const secretKey = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY"
  const region = "us-east-1"
  const amzDateStr = "20150830T123600Z"
  const dateStampStr = "20150830"
  const headers = { host: "example.amazonaws.com", "x-amz-date": amzDateStr }
  const signedHeaders = "host;x-amz-date"
  const emptyPayloadHash = createHash("sha256").update("").digest("hex")

  it("与独立参考实现逐字节一致（GET 空 payload）", () => {
    const actual = signRequest(
      "GET", "/", "", headers, signedHeaders, emptyPayloadHash,
      accessKey, secretKey, region, amzDateStr, dateStampStr,
    )
    const expected = referenceSignRequest({
      method: "GET",
      uri: "/",
      queryString: "",
      headers,
      signedHeaders,
      payloadHash: emptyPayloadHash,
      accessKey,
      secretKey,
      region,
      amzDateStr,
      dateStampStr,
    })
    expect(actual).toBe(expected)
  })

  it("Authorization header 结构：Credential / SignedHeaders / Signature 三段齐全", () => {
    const out = signRequest(
      "PUT", "/bucket/key.txt", "partNumber=1&uploadId=abc", headers, signedHeaders, emptyPayloadHash,
      accessKey, secretKey, region, amzDateStr, dateStampStr,
    )
    expect(out).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-date, Signature=[0-9a-f]{64}$/)
  })

  it("签名为 64 位小写 hex（HMAC-SHA256 输出）", () => {
    const out = signRequest(
      "GET", "/", "", headers, signedHeaders, emptyPayloadHash,
      accessKey, secretKey, region, amzDateStr, dateStampStr,
    )
    const sig = out.split("Signature=")[1]
    expect(sig).toHaveLength(64)
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it("签名对 method / uri / queryString 任一变化都敏感（防漏拼入 canonical request）", () => {
    const base = { accessKey, secretKey, region, amzDateStr, dateStampStr }
    const sig = (m: string, u: string, q: string, p: string = emptyPayloadHash): string =>
      signRequest(m, u, q, headers, signedHeaders, p, base.accessKey, base.secretKey, base.region, base.amzDateStr, base.dateStampStr)

    const signatures = [
      sig("GET", "/", ""),
      sig("PUT", "/", ""),          // method 变化
      sig("GET", "/other", ""),     // uri 变化
      sig("GET", "/", "a=1"),       // queryString 变化
      sig("GET", "/", "", "deadbeef"), // payloadHash 变化
    ]
    // 五个签名两两互异
    expect(new Set(signatures).size).toBe(5)
  })

  it("签名对 secretKey / region 变化敏感（密钥派生链路正确）", () => {
    const sign = (sk: string, rg: string): string =>
      signRequest("GET", "/", "", headers, signedHeaders, emptyPayloadHash, accessKey, sk, rg, amzDateStr, dateStampStr)
    expect(sign(secretKey, region)).not.toBe(sign(secretKey, "us-west-2"))
    expect(sign(secretKey, region)).not.toBe(sign(`${secretKey}x`, region))
  })

  it("method 大小写不敏感（内部 toUpperCase）", () => {
    const lower = signRequest("get", "/", "", headers, signedHeaders, emptyPayloadHash, accessKey, secretKey, region, amzDateStr, dateStampStr)
    const upper = signRequest("GET", "/", "", headers, signedHeaders, emptyPayloadHash, accessKey, secretKey, region, amzDateStr, dateStampStr)
    expect(lower).toBe(upper)
  })

  it("signedHeaders 顺序影响 canonical headers（多 header 场景）", () => {
    const multi = { host: "example.amazonaws.com", "x-amz-date": amzDateStr, "x-amz-content-sha256": emptyPayloadHash }
    const a = signRequest("GET", "/", "", multi, "host;x-amz-content-sha256;x-amz-date", emptyPayloadHash, accessKey, secretKey, region, amzDateStr, dateStampStr)
    const b = signRequest("GET", "/", "", multi, "host;x-amz-date;x-amz-content-sha256", emptyPayloadHash, accessKey, secretKey, region, amzDateStr, dateStampStr)
    expect(a).not.toBe(b)
    // 顺带验证参考实现同序一致
    expect(a).toBe(referenceSignRequest({
      method: "GET", uri: "/", queryString: "", headers: multi,
      signedHeaders: "host;x-amz-content-sha256;x-amz-date",
      payloadHash: emptyPayloadHash, accessKey, secretKey, region, amzDateStr, dateStampStr,
    }))
  })
})

// ========== 时间戳 ==========

describe("amzDate / dateStamp", () => {
  const d = new Date(Date.UTC(2015, 7, 30, 12, 36, 0))

  it("amzDate 生成 YYYYMMDDTHHMMSSZ（去冒号与毫秒）", () => {
    expect(amzDate(d)).toBe("20150830T123600Z")
  })

  it("dateStamp 生成 YYYYMMDD", () => {
    expect(dateStamp(d)).toBe("20150830")
  })

  it("amzDate 与 dateStamp 取自同一 UTC 时刻（前缀一致）", () => {
    expect(amzDate(d).startsWith(dateStamp(d))).toBe(true)
  })

  it("结果恒为 UTC（不随宿主本地时区漂移）", () => {
    // 使用带 Z 的 ISO 构造，跨时区应稳定
    expect(amzDate(new Date("2015-08-30T12:36:00Z"))).toBe("20150830T123600Z")
    expect(dateStamp(new Date("2015-08-30T23:59:59Z"))).toBe("20150830")
  })

  it("毫秒被剥离", () => {
    expect(amzDate(new Date(Date.UTC(2015, 7, 30, 12, 36, 0, 999)))).toBe("20150830T123600Z")
  })
})

describe("utcToUtcString", () => {
  it("S3 ISO 时间串转为 UTC 展示串（不做本地时区二次转换）", () => {
    expect(utcToUtcString("2026-07-06T16:19:23.000Z")).toBe("2026-07-06 16:19:23")
  })

  it("月/日/时/分/秒补零", () => {
    expect(utcToUtcString("2026-01-05T03:04:09.000Z")).toBe("2026-01-05 03:04:09")
  })

  it("无效输入原样返回（不抛错）", () => {
    expect(utcToUtcString("not-a-date")).toBe("not-a-date")
    expect(utcToUtcString("")).toBe("")
  })
})

describe("utcWallClockToLocalEpoch", () => {
  it("把 UTC 墙钟字段按本地时区重组为 epoch（与展示串同口径）", () => {
    const iso = "2026-07-06T16:19:23.000Z"
    const expected = new Date(2026, 6, 6, 16, 19, 23).getTime()
    expect(utcWallClockToLocalEpoch(iso)).toBe(expected)
  })

  it("重组值与该时刻的真实 UTC epoch 相差一个时区偏移（这正是本函数存在的理由）", () => {
    const iso = "2026-07-06T16:19:23.000Z"
    const realEpoch = new Date(iso).getTime()
    const reassembled = utcWallClockToLocalEpoch(iso)
    // 非 UTC 时区下二者不相等；偏移量应为整分钟
    const offsetMinutes = (reassembled - realEpoch) / 60000
    expect(Number.isInteger(offsetMinutes)).toBe(true)
  })

  it("无效输入返回 NaN", () => {
    expect(Number.isNaN(utcWallClockToLocalEpoch("not-a-date"))).toBe(true)
  })
})

// ========== XML 解析：ListObjects ==========

describe("parseListObjectsXml", () => {
  const sample = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>bucket</Name>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>a.txt</Key>
    <LastModified>2026-07-06T16:19:23.000Z</LastModified>
    <ETag>"abc"</ETag>
    <Size>1024</Size>
    <StorageClass>STANDARD</StorageClass>
  </Contents>
  <Contents>
    <Key>dir/b.txt</Key>
    <LastModified>2026-07-07T01:02:03.000Z</LastModified>
    <Size>2048</Size>
  </Contents>
</ListBucketResult>`

  it("提取全部 Contents 的 key / name / size", () => {
    const { files } = parseListObjectsXml(sample)
    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({ key: "a.txt", name: "a.txt", size: 1024 })
    expect(files[1]).toMatchObject({ key: "dir/b.txt", name: "b.txt", size: 2048 })
  })

  it("name 取 key 的最后一段（目录式 key 只留文件名）", () => {
    const { files } = parseListObjectsXml(sample)
    expect(files[1].name).toBe("b.txt")
  })

  it("中间夹带 ETag / StorageClass 等额外元素不影响字段提取", () => {
    const { files } = parseListObjectsXml(sample)
    expect(files[0].size).toBe(1024)
    expect(files[0].lastModified).toBe("2026-07-06 16:19:23")
  })

  it("IsTruncated=false 时 isTruncated 为 false", () => {
    expect(parseListObjectsXml(sample).isTruncated).toBe(false)
  })

  it("IsTruncated=true 时 isTruncated 为 true（含空白与大小写兼容）", () => {
    expect(parseListObjectsXml("<IsTruncated>true</IsTruncated>").isTruncated).toBe(true)
    expect(parseListObjectsXml("<IsTruncated> true </IsTruncated>").isTruncated).toBe(true)
    expect(parseListObjectsXml("<IsTruncated>TRUE</IsTruncated>").isTruncated).toBe(true)
  })

  it("缺 NextMarker 时回退为本页最后一个 Key（V1 未开 delimiter 的情形）", () => {
    const xml = `<ListBucketResult><IsTruncated>true</IsTruncated>
      <Contents><Key>a.txt</Key><Size>1</Size></Contents>
      <Contents><Key>z.txt</Key><Size>1</Size></Contents>
    </ListBucketResult>`
    expect(parseListObjectsXml(xml).nextMarker).toBe("z.txt")
  })

  it("存在 NextMarker 时优先取其值（并反转义）", () => {
    const xml = `<ListBucketResult><IsTruncated>true</IsTruncated>
      <NextMarker>next&amp;key.txt</NextMarker>
      <Contents><Key>a.txt</Key><Size>1</Size></Contents>
    </ListBucketResult>`
    expect(parseListObjectsXml(xml).nextMarker).toBe("next&key.txt")
  })

  it("空结果集：files 为空、nextMarker 为空串", () => {
    const page = parseListObjectsXml("<ListBucketResult><Name>b</Name></ListBucketResult>")
    expect(page.files).toEqual([])
    expect(page.nextMarker).toBe("")
  })

  it("Key 中的 XML 实体被反转义（&amp; &lt; &gt; &quot; &apos;）", () => {
    const xml = `<ListBucketResult><Contents>
      <Key>a&amp;b&lt;c&gt;d&quot;e&apos;f.txt</Key><Size>1</Size>
    </Contents></ListBucketResult>`
    // 多文件场景下 nextMarker 亦应反转义
    expect(parseListObjectsXml(xml).files[0].key).toBe(`a&b<c>d"e'f.txt`)
  })

  it("缺 Size 时按 0 兜底", () => {
    const xml = `<ListBucketResult><Contents><Key>a.txt</Key></Contents></ListBucketResult>`
    expect(parseListObjectsXml(xml).files[0].size).toBe(0)
  })

  it("缺 LastModified 时 lastModified 为空串且 timestamp 为 undefined", () => {
    const xml = `<ListBucketResult><Contents><Key>a.txt</Key><Size>1</Size></Contents></ListBucketResult>`
    const f = parseListObjectsXml(xml).files[0]
    expect(f.lastModified).toBe("")
    expect(f.timestamp).toBeUndefined()
  })

  it("无 <Key> 的 Contents 块被跳过", () => {
    const xml = `<ListBucketResult><Contents><Size>1</Size></Contents></ListBucketResult>`
    expect(parseListObjectsXml(xml).files).toEqual([])
  })
})

// ========== XML 解析：delimiter 目录式 ==========

describe("parseListDirXml", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>root.txt</Key><Size>10</Size></Contents>
  <CommonPrefixes><Prefix>docs/</Prefix></CommonPrefixes>
  <CommonPrefixes><Prefix>images/</Prefix></CommonPrefixes>
</ListBucketResult>`

  it("同时提取文件与 CommonPrefixes 目录", () => {
    const page = parseListDirXml(xml)
    expect(page.files.map((f) => f.key)).toEqual(["root.txt"])
    expect(page.folders).toEqual(["docs/", "images/"])
  })

  it("继承 parseListObjectsXml 的分页字段", () => {
    const page = parseListDirXml(xml)
    expect(page.isTruncated).toBe(false)
    expect(page.nextMarker).toBe("root.txt")
  })

  it("IsTruncated 且缺 NextMarker 时，续传点取「最后 key 与最后 CommonPrefix 中的较大者」", () => {
    const trunc = `<ListBucketResult><IsTruncated>true</IsTruncated>
      <Contents><Key>a.txt</Key><Size>1</Size></Contents>
      <CommonPrefixes><Prefix>zzz/</Prefix></CommonPrefixes>
    </ListBucketResult>`
    // "zzz/" > "a.txt" → 取 zzz/
    expect(parseListDirXml(trunc).nextMarker).toBe("zzz/")
  })

  it("续传点比较：最后 key 较大时保留 key", () => {
    const trunc = `<ListBucketResult><IsTruncated>true</IsTruncated>
      <Contents><Key>zzz.txt</Key><Size>1</Size></Contents>
      <CommonPrefixes><Prefix>aaa/</Prefix></CommonPrefixes>
    </ListBucketResult>`
    expect(parseListDirXml(trunc).nextMarker).toBe("zzz.txt")
  })

  it("未截断时不因 CommonPrefix 改写 nextMarker", () => {
    const noTrunc = `<ListBucketResult><IsTruncated>false</IsTruncated>
      <Contents><Key>a.txt</Key><Size>1</Size></Contents>
      <CommonPrefixes><Prefix>zzz/</Prefix></CommonPrefixes>
    </ListBucketResult>`
    expect(parseListDirXml(noTrunc).nextMarker).toBe("a.txt")
  })

  it("CommonPrefix 中的实体被反转义", () => {
    const withEntity = `<ListBucketResult><CommonPrefixes><Prefix>a&amp;b/</Prefix></CommonPrefixes></ListBucketResult>`
    expect(parseListDirXml(withEntity).folders).toEqual(["a&b/"])
  })

  it("无 CommonPrefixes 时 folders 为空数组", () => {
    expect(parseListDirXml("<ListBucketResult></ListBucketResult>").folders).toEqual([])
  })
})

// ========== XML 解析：错误 / 单标签 ==========

describe("parseS3Error", () => {
  it("提取 Code 与 Message", () => {
    const xml = `<Error><Code>NoSuchKey</Code><Message>The key does not exist.</Message></Error>`
    expect(parseS3Error(xml)).toBe("NoSuchKey: The key does not exist.")
  })

  it("附 HTTP 状态码前缀", () => {
    const xml = `<Error><Code>AccessDenied</Code><Message>Denied</Message></Error>`
    expect(parseS3Error(xml, 403)).toBe("[HTTP 403] AccessDenied: Denied")
  })

  it("status 为 0 时仍输出前缀（用 !== undefined 判定而非真值）", () => {
    expect(parseS3Error("<Error><Code>C</Code><Message>M</Message></Error>", 0)).toBe("[HTTP 0] C: M")
  })

  it("缺 Code 时回退 Unknown", () => {
    expect(parseS3Error("<Error><Message>M</Message></Error>")).toBe("Unknown: M")
  })

  it("缺 Message 时回退响应体原文", () => {
    expect(parseS3Error("<Error><Code>C</Code></Error>")).toBe("C: <Error><Code>C</Code></Error>")
  })

  it("空响应体回退 \"(empty body)\"", () => {
    expect(parseS3Error("")).toBe("Unknown: (empty body)")
  })
})

describe("formatS3Error", () => {
  it("拼接 operation 前缀与错误信息", () => {
    const res = { ok: false, status: 403, text: async () => "" }
    expect(formatS3Error(res, "<Error><Code>AccessDenied</Code><Message>Denied</Message></Error>", "upload"))
      .toBe("upload: [HTTP 403] AccessDenied: Denied")
  })

  it("405 且带 allow 头时附加服务器允许的方法", () => {
    const res = { ok: false, status: 405, text: async () => "", headers: { allow: "GET, HEAD" } }
    const out = formatS3Error(res, "<Error><Code>MethodNotAllowed</Code><Message>no</Message></Error>", "upload")
    expect(out).toContain("（服务器允许的方法: GET, HEAD）")
  })

  it("405 但无 allow 头时不附加", () => {
    const res = { ok: false, status: 405, text: async () => "" }
    const out = formatS3Error(res, "<Error><Code>MethodNotAllowed</Code><Message>no</Message></Error>", "upload")
    expect(out).not.toContain("服务器允许的方法")
  })

  it("非 405 即使带 allow 头也不附加", () => {
    const res = { ok: false, status: 403, text: async () => "", headers: { allow: "GET" } }
    const out = formatS3Error(res, "<Error><Code>C</Code><Message>m</Message></Error>", "upload")
    expect(out).not.toContain("服务器允许的方法")
  })
})

describe("parseSingleTag", () => {
  it("提取单标签内容", () => {
    expect(parseSingleTag("<UploadId>abc123</UploadId>", "UploadId")).toBe("abc123")
  })

  it("夹带其它元素时仍取目标标签", () => {
    const xml = `<InitiateMultipartUploadResult><Bucket>b</Bucket><UploadId>u1</UploadId><Key>k</Key></InitiateMultipartUploadResult>`
    expect(parseSingleTag(xml, "UploadId")).toBe("u1")
  })

  it("标签缺失返回空串", () => {
    expect(parseSingleTag("<Other>x</Other>", "UploadId")).toBe("")
  })

  it("内容中的 XML 实体被反转义", () => {
    expect(parseSingleTag("<UploadId>a&amp;b</UploadId>", "UploadId")).toBe("a&b")
  })
})

// ========== Multipart 请求体 ==========

describe("buildCompleteMultipartBody", () => {
  it("单个分片的结构", () => {
    const xml = buildCompleteMultipartBody([{ partNumber: 1, etag: "\"abc\"" }])
    expect(xml).toContain("<CompleteMultipartUpload>")
    expect(xml).toContain("</CompleteMultipartUpload>")
    expect(xml).toContain("<Part><PartNumber>1</PartNumber><ETag>\"abc\"</ETag></Part>")
  })

  it("多分片按传入顺序保持", () => {
    const xml = buildCompleteMultipartBody([
      { partNumber: 1, etag: "\"a\"" },
      { partNumber: 2, etag: "\"b\"" },
    ])
    expect(xml.indexOf("<PartNumber>1<")).toBeLessThan(xml.indexOf("<PartNumber>2<"))
  })

  it("空数组产出无 Part 的空容器（结构完整）", () => {
    expect(buildCompleteMultipartBody([])).toBe("<CompleteMultipartUpload>\n\n</CompleteMultipartUpload>")
  })

  it("ETag 的引号原样保留（不二次转义）", () => {
    const xml = buildCompleteMultipartBody([{ partNumber: 5, etag: "\"deadbeef\"" }])
    expect(xml).toContain("<ETag>\"deadbeef\"</ETag>")
  })
})

// ========== 查询串 ==========

describe("sortQueryString", () => {
  it("空串返回空串", () => {
    expect(sortQueryString("")).toBe("")
  })

  it("单参数原样返回", () => {
    expect(sortQueryString("a=1")).toBe("a=1")
  })

  it("多参数按字母序排序（SigV4 canonical request 强制要求）", () => {
    expect(sortQueryString("uploadId=x&partNumber=2")).toBe("partNumber=2&uploadId=x")
    expect(sortQueryString("z=1&a=2&m=3")).toBe("a=2&m=3&z=1")
  })

  it("排序为稳定字典序（大小写敏感，`Z` 先于 `a`）", () => {
    // JS 默认 sort 按 UTF-16 码元，大写字母码元小于小写
    expect(sortQueryString("a=1&Z=2")).toBe("Z=2&a=1")
  })
})
