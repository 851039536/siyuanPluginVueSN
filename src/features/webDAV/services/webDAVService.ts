import type { WebDAVConfig, WebDAVFile } from '../types'

export class WebDAVService {
  private static instance: WebDAVService

  static getInstance(): WebDAVService {
    if (!WebDAVService.instance) {
      WebDAVService.instance = new WebDAVService()
    }
    return WebDAVService.instance
  }

  async testConnection(config: WebDAVConfig): Promise<boolean> {
    if (!config.serverUrl || !config.username) {
      return false
    }

    try {
      const url = new URL(config.serverUrl)
      const response = await fetch(url.toString(), {
        method: 'PROPFIND',
        headers: {
          'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
          'Depth': '0',
          'Content-Type': 'application/xml'
        }
      })

      return response.ok || response.status === 207
    } catch {
      return false
    }
  }

  async fetchFileList(config: WebDAVConfig, path?: string): Promise<WebDAVFile[]> {
    if (!config.serverUrl || !config.username) {
      console.warn('[WebDAV] 缺少服务器地址或用户名')
      return []
    }

    try {
      const serverUrl = new URL(config.serverUrl)
      const basePath = path || config.basePath || '/'

      // 正确构建完整 URL
      let fullUrl: URL
      if (basePath.startsWith('/')) {
        // 相对路径以斜杠开头，拼接到服务器 URL 后面
        fullUrl = new URL(serverUrl.origin + basePath)
      } else {
        // 其他情况作为相对路径处理
        fullUrl = new URL(basePath, serverUrl.origin + serverUrl.pathname)
      }

      const response = await fetch(fullUrl.toString(), {
        method: 'PROPFIND',
        headers: {
          'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
          'Depth': '1',
          'Content-Type': 'application/xml'
        }
      })

      if (response.ok || response.status === 207) {
        const text = await response.text()

        // 打印部分响应内容用于调试
        if (text.length > 0) {
        }

        const files = this.parseWebDAVResponse(text)

        if (files.length === 0 && text.length > 0) {
          console.warn('[WebDAV] 警告：响应不为空但未解析到文件，可能XML格式有问题')
        }

        return files
      } else {
        console.warn('[WebDAV] 获取文件列表失败:', response.status)
        return []
      }
    } catch (error) {
      console.error('[WebDAV] 获取文件列表异常:', error)
      return []
    }
  }

  parseWebDAVResponse(xml: string): WebDAVFile[] {
    const files: WebDAVFile[] = []

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')

      // 查找所有 response 元素（支持不同命名空间）
      const responses = doc.querySelectorAll('response, d\\:response, *')

      for (let i = 0; i < responses.length; i++) {
        const response = responses[i]

        // 获取 href（支持多种命名空间）
        const hrefElement = response.querySelector('href, d\\:href, D\\:href')
        const href = hrefElement?.textContent || ''

        if (!href || href.trim() === '') continue

        // 跳过根路径响应
        if (href === '/' || href.endsWith('/')) {
          const name = href.split('/').filter(Boolean).pop()
          if (!name) continue
        }

        // 获取属性信息
        const propElement = response.querySelector('prop, d\\:prop, D\\:prop')
        let size = 0
        let lastModified = ''
        let isDirectory = false

        if (propElement) {
          const contentLength = propElement.querySelector('getcontentlength, d\\:getcontentlength, D\\:getcontentlength')
          const lastModifiedEl = propElement.querySelector('getlastmodified, d\\:getlastmodified, D\\:getlastmodified')
          const resourceType = propElement.querySelector('resourcetype, d\\:resourcetype, D\\:resourcetype')

          if (contentLength) {
            size = parseInt(contentLength.textContent || '0', 10)
          }
          if (lastModifiedEl) {
            lastModified = lastModified.textContent || ''
          }
          if (resourceType) {
            // 检查是否是 collection（目录）
            isDirectory = resourceType.querySelector('collection, d\\:collection, D\\:collection') !== null
          }
        }

        // 提取文件名
        const name = this.extractFileName(href)

        if (name && !name.startsWith('.')) {
          files.push({
            name,
            path: href,
            isDirectory,
            size,
            lastModified
          })
        }
      }
    } catch (error) {
      console.error('[WebDAV] 解析XML失败:', error)
    }

    return files
      .filter(f => f.name)
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
  }

  async downloadFile(config: WebDAVConfig, file: WebDAVFile): Promise<Blob | null> {
    if (!config.serverUrl || !config.username || file.isDirectory) {
      return null
    }

    try {
      const serverUrl = new URL(config.serverUrl)

      // 构建文件的完整 URL
      const fileUrl = new URL(file.path, serverUrl.origin + serverUrl.pathname)

      const response = await fetch(fileUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`)
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        return blob
      } else {
        return null
      }
    } catch (error) {
      console.error('[WebDAV] 下载文件异常:', error)
      return null
    }
  }

  downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  private extractFileName(href: string): string {
    try {
      // 尝试解码 URL 编码的文件名
      const decoded = decodeURIComponent(href)
      const parts = decoded.split('/').filter(Boolean)
      const name = parts.pop() || ''
      return name
    } catch {
      const parts = href.split('/').filter(Boolean)
      return parts.pop() || href
    }
  }
}

export const webDAVService = WebDAVService.getInstance()
