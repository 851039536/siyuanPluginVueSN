/**
 * 密码箱类型定义
 */

/**
 * 密码条目
 */
export interface PasswordEntry {
  id: string          // 唯一标识
  category: string    // 类别
  name: string        // 名称
  account: string     // 账号
  password: string    // 密码
  description: string // 描述
  createdAt: number   // 创建时间
  updatedAt: number   // 更新时间
}

/**
 * 密码分类
 */
export interface PasswordCategory {
  id: string      // 分类ID
  name: string    // 分类名称
  color: string   // 分类颜色
}
