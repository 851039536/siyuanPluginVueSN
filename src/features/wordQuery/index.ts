/**
 * 单词查询功能模块
 * 使用通义大模型API查询单词释义、音标、谐音等信息
 */
import { Plugin, showMessage } from 'siyuan';
import { createApp, h } from 'vue';
// @ts-ignore
import WordQueryPanel from './WordQueryPanel.vue';

/**
 * 单词查询类
 */
export class WordQuery {
  private plugin: Plugin;
  private apiUrl: string = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  private currentApiKey: string = '';

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    // 初始化时获取API密钥
    this.currentApiKey = this.getApiKey();
  }

  /**
   * 获取API Key
   */
  private getApiKey(): string {
    // 如果已经有缓存的API密钥，直接返回
    if (this.currentApiKey) {
      return this.currentApiKey;
    }
    
    // 尝试从本地存储中获取API Key
    try {
      const savedKey = localStorage.getItem('word-query-api-key');
      if (savedKey) {
        this.currentApiKey = savedKey;
        return savedKey;
      }
    } catch (error) {
      console.error('Failed to get API key from localStorage:', error);
    }
    
    // 如果没有设置，使用默认值
    this.currentApiKey = 'sk-fae27cc50015409fb2524b0970d3f0b0';
    return this.currentApiKey;
  }
  
  /**
   * 设置API Key
   */
  public setApiKey(apiKey: string) {
    this.currentApiKey = apiKey;
  }

  /**
   * 初始化单词查询功能
   */
  public init() {
    this.addDock();
    console.log('单词查询模块已初始化');
  }

  /**
   * 添加单词查询 Dock 到右侧边栏
   */
  private addDock() {
    const self = this;
    this.plugin.addDock({
      config: {
        position: 'RightTop',
        size: { width: 320, height: 0 },
        icon: 'iconLanguage', // 使用语言图标
        title: this.plugin.i18n.wordQuery || '单词查询',
        show: false,
      },
      data: {},
      type: 'wordquery-dock',
      init: (dock: any) => {
        // 创建 Vue 应用
        const container = document.createElement('div');
        container.style.height = '100%';
        container.style.overflow = 'hidden';

        const app = createApp({
          setup() {
            return () => h(WordQueryPanel, {
              i18n: self.plugin.i18n,
              onQuery: async (word: string) => {
                return await self.queryWord(word);
              },
              onApiKeyChange: (apiKey: string) => {
                self.setApiKey(apiKey);
              }
            });
          }
        });

        app.mount(container);
        dock.element?.appendChild(container);

        // 保存应用引用，以便卸载时清理
        dock.__app = app;
        dock.__container = container;
      },
    });
  }

  /**
   * 检测是否为英文单词
   */
  private isEnglishWord(text: string): boolean {
    return /^[a-zA-Z\s-]+$/.test(text);
  }

  /**
   * 检测是否为中文
   */
  private isChinese(text: string): boolean {
    return /^[\u4e00-\u9fa5\s]+$/.test(text);
  }

  /**
   * 查询单词信息
   * @param word - 要查询的英文单词或中文词语
   */
  public async queryWord(word: string): Promise<string> {
    if (!word) {
      showMessage(this.plugin.i18n.noTextSelected || '请输入单词', 3000, 'error');
      return '';
    }

    showMessage('🔍 正在查询单词...', 2000, 'info');

    try {
      // 根据输入类型构建不同的提示词
      const prompt = this.buildPrompt(word);
      const response = await this.callTongyiAPI(prompt);
      
      if (response) {
        showMessage('✓ 查询完成', 2000, 'info');
        return response;
      } else {
        showMessage('查询失败，请重试', 3000, 'error');
        return '';
      }
    } catch (error) {
      console.error('Word query error:', error);
      const errorMsg = error.message || '未知错误';
      showMessage('🚫 查询失败: ' + errorMsg, 5000, 'error');
      return '';
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompt(word: string): string {
    // 根据输入类型选择不同的提示词
    if (this.isEnglishWord(word)) {
      return `请为英文单词 "${word}" 生成详细信息，要求：

1. 使用英式标准发音
2. 谐音使用带声调的拼音标注
3. 严格按照以下格式输出：

#### ${word}

单词：${word}
音标：[英式音标]
释义：[中文释义]
谐音：[中文谐音(使用英式自然发音,带拼音标注),如:西斯腾(xī sī téng)]
发音：[发音要点说明]
例句：[英文例句及中文翻译]

注意事项：
- 音标必须是英式音标
- 谐音要贴近实际发音，便于记忆
- 拼音必须带声调
- 发音说明要包含音节、重音、元音特点等
- 提供常用例句
- 只输出格式化内容，不要有其他说明文字`;
    } else if (this.isChinese(word)) {
      return `请为中文词语 "${word}" 生成详细信息，要求：

1. 提供英文翻译
2. 使用英式标准发音
3. 谐音使用带声调的拼音标注
4. 严格按照以下格式输出：

#### ${word}

词语：${word}
拼音：[标准拼音]
英文：[英文翻译]
释义：[中文释义]
谐音：[英文谐音，便于记忆，如:桑普(sǎmpǔ)]
发音：[发音要点说明]
例句：[中文例句及英文翻译]

注意事项：
- 英文翻译要准确自然
- 谐音要贴近实际英文发音，便于记忆
- 拼音必须带声调
- 发音说明要包含音节、重音、元音特点等
- 提供常用例句
- 只输出格式化内容，不要有其他说明文字`;
    } else {
      return `请为词语 "${word}" 生成详细信息，如果是英文，请提供中文释义；如果是中文，请提供英文翻译。

1. 使用英式标准发音（如果是英文）
2. 谐音使用带声调的拼音标注
3. 严格按照以下格式输出：

#### ${word}

词语：${word}
拼音/音标：[拼音或音标]
释义：[中文或英文释义]
谐音：[谐音记忆]
发音：[发音要点说明]
例句：[例句及翻译]

注意事项：
- 只输出格式化内容，不要有其他说明文字`;
    }
  }

  /**
   * 调用通义API
   */
  private async callTongyiAPI(prompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    const requestBody = {
      model: 'qwen-plus',
      input: {
        messages: [
          {
            role: 'system',
            content: '你是一个专业的多语言教学助手，擅长提供单词的详细释义、音标、谐音和例句。'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        temperature: 0.7,
        top_p: 0.8,
        max_tokens: 800
      }
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // 尝试多种可能的响应格式
    if (data.output && data.output.text) {
      return data.output.text;
    } else if (data.output && data.output.choices && data.output.choices.length > 0) {
      return data.output.choices[0].message.content;
    } else if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else if (data.text) {
      return data.text;
    } else if (data.content) {
      return data.content;
    } else {
      throw new Error(`API返回数据格式错误，响应结构: ${JSON.stringify(Object.keys(data))}`);
    }
  }

  /**
   * 销毁功能
   */
  public destroy() {
    console.log('单词查询模块已销毁');
  }
}

/**
 * 注册单词查询模块
 */
export function registerWordQuery(plugin: Plugin) {
  const query = new WordQuery(plugin);
  query.init();
  
  // 保存实例到插件对象中，以便在其他地方使用
  (plugin as any).__wordQuery = query;
  
  console.log('单词查询模块已注册');
  return query;
}