/**
 * 视频加密/解密工具
 * 支持单重和双重压缩加密
 */

/**
 * 从密码派生加密密钥
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordData,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const salt = encoder.encode("siyuan-video-encryption-salt-v1");

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * 压缩数据（使用 CompressionStream）
 */
async function compressData(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.buffer as ArrayBuffer]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
  const compressedBlob = await new Response(compressedStream).blob();
  return new Uint8Array(await compressedBlob.arrayBuffer());
}

/**
 * 解压数据（使用 DecompressionStream）
 */
async function decompressData(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.buffer as ArrayBuffer]).stream();
  const decompressedStream = stream.pipeThrough(
    new DecompressionStream("gzip"),
  );
  const decompressedBlob = await new Response(decompressedStream).blob();
  return new Uint8Array(await decompressedBlob.arrayBuffer());
}

/**
 * 加密数据
 */
async function encryptData(
  data: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  const key = await deriveKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data.buffer as ArrayBuffer,
  );

  // 组合 IV 和加密数据
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  return combined;
}

/**
 * 解密数据
 */
async function decryptData(
  data: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  const key = await deriveKey(password);
  const iv = data.slice(0, 12);
  const encryptedData = data.slice(12);

  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedData,
  );

  return new Uint8Array(decryptedData);
}

/**
 * 加密视频文件（仅压缩，无需密码）
 * @param videoData 视频文件数据
 * @param doubleCompress 是否使用双重压缩（默认单重）
 * @returns 加密后的数据
 */
export async function encryptVideo(
  videoData: Uint8Array,
  doubleCompress: boolean = false,
): Promise<Uint8Array> {
  try {
    let processedData = videoData;

    // 第一次压缩
    processedData = await compressData(processedData);

    // 如果启用双重压缩，再压缩一次
    if (doubleCompress) {
      processedData = await compressData(processedData);
    }

    // 添加文件头标识（1字节：0x01=单重，0x02=双重）
    const header = new Uint8Array([doubleCompress ? 0x02 : 0x01]);
    const result = new Uint8Array(header.length + processedData.length);
    result.set(header, 0);
    result.set(processedData, header.length);

    return result;
  } catch (error) {
    throw new Error("视频加密失败: " + (error as Error).message);
  }
}

/**
 * 解密视频文件（无需密码，自动解密）
 * @param encryptedData 加密的视频数据
 * @returns 解密后的原始视频数据
 */
export async function decryptVideo(
  encryptedData: Uint8Array,
): Promise<Uint8Array> {
  try {
    // 读取文件头
    const header = encryptedData[0];
    const isDoubleCompressed = header === 0x02;
    const dataWithoutHeader = encryptedData.slice(1);

    // 直接解压（无需密码）
    let processedData = dataWithoutHeader;

    // 解压（如果是双重压缩，需要解压两次）
    if (isDoubleCompressed) {
      processedData = await decompressData(processedData);
    }
    processedData = await decompressData(processedData);

    return processedData;
  } catch (error) {
    throw new Error("视频解密失败: 文件损坏");
  }
}

/**
 * 判断文件是否为加密视频
 */
export function isEncryptedVideo(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith(".sn") || lowerName.endsWith(".sn2");
}

/**
 * 获取原始文件名（去除 .sn 或 .sn2 后缀）
 */
export function getOriginalFileName(encryptedFileName: string): string {
  const lowerName = encryptedFileName.toLowerCase();
  if (lowerName.endsWith(".sn2")) {
    return encryptedFileName.slice(0, -4); // 移除 .sn2
  }
  if (lowerName.endsWith(".sn")) {
    return encryptedFileName.slice(0, -3); // 移除 .sn
  }
  return encryptedFileName;
}

/**
 * 获取加密文件名（添加 .sn 或 .sn2 后缀）
 */
export function getEncryptedFileName(
  originalFileName: string,
  doubleCompress: boolean,
): string {
  return originalFileName + (doubleCompress ? ".sn2" : ".sn");
}
