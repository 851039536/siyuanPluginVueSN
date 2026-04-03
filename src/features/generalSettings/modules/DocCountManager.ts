/**
 * 笔记本文档数统计管理器
 * 用于在笔记本列表中显示文档数量，并支持右键菜单查看文件夹文档数
 */
export class DocCountManager {
  private updateTimer: number | null = null
  private contextMenuObserver: MutationObserver | null = null
  private updateInterval = 3600000 // 默认1小时

  /**
   * 启动文档数统计功能
   */
  public start(): void {
    this.setBoxCount()
    this.startAutoUpdate()
    this.observeContextMenu()
  }

  /**
   * 停止文档数统计功能
   */
  public stop(): void {
    this.stopAutoUpdate()
    this.stopContextMenuObserver()
    this.clearAllCounts()
  }

  /**
   * 设置更新间隔
   */
  public setUpdateInterval(interval: number): void {
    this.updateInterval = interval
    if (this.updateTimer) {
      this.stopAutoUpdate()
      this.startAutoUpdate()
    }
  }

  /**
   * 给笔记本添加文档数
   */
  private async setBoxCount(): Promise<void> {
    const boxes = document.querySelectorAll('ul[data-url]')
    for (const box of boxes) {
      const response = await this.query(
        `SELECT count(*) as count FROM blocks where box = '${(box as HTMLElement).dataset.url}' and type = 'd';`
      )
      if (!response[0] || !response[0]['count']) continue
      
      const count = response[0]['count']
      const li = box.querySelector('li[data-type="navigation-root"]')
      if (!li) continue
      
      const boxText = li.querySelector('span.b3-list-item__text')
      if (!boxText) continue
      
      const text = boxText.textContent?.replace(/\s*\(\d+\)$/, '') || ''
      boxText.textContent = text + ` (${count})`
    }
  }

  /**
   * 启动自动更新定时器
   */
  private startAutoUpdate(): void {
    this.updateTimer = window.setInterval(() => {
      this.setBoxCount()
    }, this.updateInterval)
  }

  /**
   * 停止自动更新定时器
   */
  private stopAutoUpdate(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }

  /**
   * 监听右键菜单，动态显示文件夹的文档数
   */
  private observeContextMenu(): void {
    const treeSelector = this.isMobile() ? '#sidebar .b3-list--mobile' : '.sy__file'
    
    this.whenElementExist(treeSelector).then((fileTree) => {
      if (!fileTree) return

      const onMenuShow = async (event: Event) => {
        const target = event.target as HTMLElement
        const currLi = target.closest<HTMLElement>(
          'li.b3-list-item:not([data-type="navigation-root"],[data-count="0"])'
        )
        if (!currLi) return

        // 关闭上次的菜单，防止2个菜单冲突
        document.body.click()

        this.whenElementExist('button[data-id="rename"]').then(async (renameBtn) => {
          if (!renameBtn) return
          
          const html = `<button data-id="docNums" class="b3-menu__item"><svg class="b3-menu__icon " style=""><use xlink:href="#iconList"></use></svg><span class="b3-menu__label">显示文档数</span></button>`
          renameBtn.insertAdjacentHTML('afterend', html)
          
          const docNumBtn = renameBtn.parentElement?.querySelector<HTMLButtonElement>('button[data-id="docNums"]')
          if (!docNumBtn) return
          
          docNumBtn.onclick = async () => {
            const nodeId = currLi.dataset.nodeId
            if (!nodeId) return
            
            const response = await this.query(
              `SELECT count(*) as count FROM blocks where path like '%/${nodeId}%' and type = 'd' and id != '${nodeId}';`
            )
            if (!response[0] || !response[0]['count']) {
              document.body.click()
              return
            }
            
            const count = response[0]['count']
            const boxText = currLi.querySelector('span.b3-list-item__text')
            if (!boxText) return
            
            const text = boxText.textContent?.replace(/\s*\(\d+\)$/, '') || ''
            boxText.textContent = text + ` (${count})`
            document.body.click()
          }
        })
      }

      if (this.isMobile()) {
        // 监听手机版更多按钮被单击
        fileTree.addEventListener('touchend', (event: Event) => {
          const target = event.target as HTMLElement
          if (target.closest('span[data-type="more-file"]')) {
            onMenuShow(event)
          }
        })
      } else {
        // 监听桌面版更多按钮被单击
        fileTree.addEventListener('mouseup', (event: Event) => {
          const target = event.target as HTMLElement
          if (target.closest('span[data-type="more-file"]')) {
            onMenuShow(event)
          }
        })
        // 监听文档树右键事件
        fileTree.addEventListener('contextmenu', onMenuShow)
      }
    })
  }

  /**
   * 停止右键菜单观察器
   */
  private stopContextMenuObserver(): void {
    if (this.contextMenuObserver) {
      this.contextMenuObserver.disconnect()
      this.contextMenuObserver = null
    }
  }

  /**
   * 清除所有文档数显示
   */
  private clearAllCounts(): void {
    const boxTexts = document.querySelectorAll('span.b3-list-item__text')
    boxTexts.forEach((text) => {
      const content = text.textContent
      if (content) {
        text.textContent = content.replace(/\s*\(\d+\)$/, '')
      }
    })
  }

  /**
   * 查询SQL函数
   */
  private async query(sql: string): Promise<any[]> {
    const result = await this.fetchSyncPost('/api/query/sql', { stmt: sql })
    if (result.code !== 0) {
      console.error('查询数据库出错', result.msg)
      return []
    }
    return result.data
  }

  /**
   * 发送同步POST请求
   */
  private async fetchSyncPost(url: string, data: any, returnType: 'json' | 'text' = 'json'): Promise<any> {
    const init: RequestInit = {
      method: 'POST',
    }
    if (data) {
      if (data instanceof FormData) {
        init.body = data
      } else {
        init.body = JSON.stringify(data)
      }
    }
    try {
      const res = await fetch(url, init)
      const res2 = returnType === 'json' ? await res.json() : await res.text()
      return res2
    } catch (e: any) {
      console.log(e)
      return returnType === 'json' ? { code: e.code || 1, msg: e.message || '', data: null } : ''
    }
  }

  /**
   * 判断是否为移动端
   */
  private isMobile(): boolean {
    return !!document.getElementById('sidebar')
  }

  /**
   * 等待元素出现
   */
  private whenElementExist(selector: string, node?: Element): Promise<Element | null> {
    return new Promise((resolve) => {
      const check = () => {
        const el = (node || document).querySelector(selector)
        if (el) resolve(el)
        else requestAnimationFrame(check)
      }
      check()
    })
  }
}
