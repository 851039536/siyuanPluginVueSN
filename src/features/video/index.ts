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
 * 获取视频存储目录路径（默认为 data/video）
 */
export async function getVideoStoragePath(): Promise<string> {
  return 'data/video';
}

/**
 * 视频文件扩展名
 */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.m4v'];

/**
 * 判断是否为视频文件
 */
function isVideoFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * 获取文件大小
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const response = await fetch('/api/file/getFile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: filePath
      })
    });
    
    if (response.ok) {
      const blob = await response.blob();
      return blob.size;
    } else {
      console.warn('获取文件大小失败:', filePath, response.status);
    }
  } catch (error) {
    console.error('获取文件大小异常:', filePath, error);
  }
  return 0;
}

/**
 * 递归扫描目录获取所有视频文件
 */
async function scanVideoDirectory(basePath: string, currentPath: string = ''): Promise<any[]> {
  const videos: any[] = [];
  const fullPath = currentPath ? `${basePath}/${currentPath}` : basePath;
  
  try {
    // 读取目录内容
    const response = await fetch('/api/file/readDir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: fullPath
      })
    });
    
    const result = await response.json();
    
    if (result.code !== 0 || !result.data) {
      console.log('目录不存在或为空:', fullPath);
      return videos;
    }
    
    // 遍历目录内容
    for (const item of result.data) {
      const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      const itemFullPath = `${basePath}/${itemPath}`;
      
      if (item.isDir) {
        // 递归扫描子目录
        const subVideos = await scanVideoDirectory(basePath, itemPath);
        videos.push(...subVideos);
      } else if (isVideoFile(item.name)) {
        // 获取文件大小
        const size = await getFileSize(itemFullPath);
        
        // 添加视频文件
        const category = currentPath || '根目录';
        videos.push({
          name: item.name,
          path: itemFullPath,
          category: category,
          size: size,
          modTime: item.updated * 1000 || Date.now() // updated 是秒级时间戳，转换为毫秒
        });
      }
    }
  } catch (error) {
    console.error('扫描目录失败:', fullPath, error);
  }
  
  return videos;
}

/**
 * 获取视频列表（自动扫描 data/video 目录）
 */
export async function getVideoList(_plugin: Plugin): Promise<any[]> {
  try {
    const storagePath = await getVideoStoragePath();
    console.log('开始扫描视频目录:', storagePath);
    
    const videos = await scanVideoDirectory(storagePath);
    console.log('扫描完成，找到', videos.length, '个视频文件');
    
    return videos;
  } catch (error) {
    console.error('获取视频列表失败:', error);
    return [];
  }
}

/**
 * 获取所有分类（从扫描结果中提取）
 */
export async function getVideoCategories(plugin: Plugin): Promise<string[]> {
  const videos = await getVideoList(plugin);
  const categories = new Set<string>();
  
  videos.forEach(video => {
    if (video.category) {
      categories.add(video.category);
    }
  });
  
  return Array.from(categories).sort();
}

/**
 * 获取视频文件的 Blob URL（用于播放）
 */
export async function getVideoUrl(videoPath: string): Promise<string> {
  try {
    const response = await fetch('/api/file/getFile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: videoPath
      })
    });
    
    if (response.ok) {
      const blob = await response.blob();
      // 创建 Blob URL 用于视频播放
      return URL.createObjectURL(blob);
    } else {
      console.error('获取视频文件失败:', videoPath, response.status);
      return '';
    }
  } catch (error) {
    console.error('获取视频URL失败:', videoPath, error);
    return '';
  }
}
