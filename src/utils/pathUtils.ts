// 跨平台路径字符串工具（纯字符串操作，不触碰 Node path 模块）
//
// 为什么独立成文件：git 输出统一用 / 分隔（Windows 亦然），这类「按 / 切分」的
// 轻量操作在树构建与文件预览两处重复过；收敛到宿主无关的通用层，插件侧可直接复用。

/**
 * 取路径的 basename（最后一段；以最后一个 / 为准）。
 * 与 POSIX basename 的差异：不处理尾部斜杠（git 输出不会带），空串原样返回空串。
 */
export function pathBasename(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx === -1 ? path : path.slice(idx + 1)
}
