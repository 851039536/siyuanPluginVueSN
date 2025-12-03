import { Plugin } from 'siyuan';
import { showMessage } from 'siyuan';

export function registerVideo(plugin: Plugin) {
  console.log('视频功能模块初始化');
  
  // 添加快捷键：Ctrl+Alt+V 打开视频管理器
  plugin.addCommand({
    langKey: 'videoManager',
    hotkey: '⌃⌥V',
    callback: () => {
      openVideoManager(plugin);
    }
  });
  
  // 添加右键菜单
  plugin.eventBus.on('click-blockicon', (event: any) => {
    const { detail } = event;
    if (detail.type === 'video') {
      // 处理视频相关操作
      showMessage('视频功能已触发', 2000, 'info');
    }
  });
  
}

/**
 * 打开视频管理器
 */
export function openVideoManager(_plugin: Plugin) {
  // 触发全局事件，由主插件处理
  window.dispatchEvent(new CustomEvent('openVideoManager'));
  showMessage('打开视频管理器', 2000, 'info');
}

/**
 * 获取视频分类选项
 */
export async function getVideoCategories(): Promise<string[]> {
  // 从 localStorage 读取，如果没有则返回默认值
  try {
    const saved = localStorage.getItem('video-categories')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('读取视频分类失败:', error)
  }
  return ['默认分类', '教程', '演示', '其他']
}

/**
 * 保存视频分类选项
 */
export async function saveVideoCategories(categories: string[]): Promise<void> {
  try {
    localStorage.setItem('video-categories', JSON.stringify(categories))
  } catch (error) {
    console.error('保存视频分类失败:', error)
    throw error
  }
}

/**
 * 上传视频文件到data/video目录
 */
export async function uploadVideoFile(
  plugin: Plugin,
  file: File,
  category?: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // 生成文件名
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^\w\d.-]/g, '_')}`;
    const filePath = `video/${fileName}`;
    
    // 读取文件内容
    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as ArrayBuffer;
          // 保存文件到插件数据目录
          // 注意：plugin.saveData 只接受 2 个参数
          await plugin.saveData(filePath, content);
          
          // 保存视频元数据
          const metadata = {
            name: file.name,
            path: filePath,
            category: category || '默认分类',
            size: file.size,
            type: file.type,
            uploadTime: new Date().toISOString()
          };
          
          const metadataPath = 'video/metadata.json';
          let metadataList = [];
          try {
            const existing = await plugin.loadData(metadataPath);
            if (existing) {
              metadataList = JSON.parse(existing);
            }
          } catch (e) {
            // 文件不存在或解析失败，创建新列表
          }
          
          metadataList.push(metadata);
          await plugin.saveData(metadataPath, JSON.stringify(metadataList, null, 2));
          
          resolve({ success: true, path: filePath });
        } catch (error) {
          console.error('视频上传失败:', error);
          resolve({ success: false, error: '文件保存失败' });
        }
      };
      
      reader.onerror = () => {
        resolve({ success: false, error: '文件读取失败' });
      };
      
      reader.readAsArrayBuffer(file);
    });
  } catch (error) {
    console.error('视频上传失败:', error);
    return { success: false, error: '上传过程出错' };
  }
}

/**
 * 获取视频列表
 */
export async function getVideoList(plugin: Plugin): Promise<any[]> {
  try {
    const metadataPath = 'video/metadata.json';
    const metadata = await plugin.loadData(metadataPath);
    if (metadata) {
      return JSON.parse(metadata);
    }
    return [];
  } catch (error) {
    return [];
  }
}
