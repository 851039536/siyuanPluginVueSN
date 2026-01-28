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
  private currentProvider: string = 'tongyi';
  private currentModel: string = 'qwen-plus';
  private apiKey: string = '';
  private customApiEndpoint: string = '';

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    // 从插件配置中初始化API配置
    const settings = (plugin as any).settings;
    this.currentProvider = settings.aiApiProvider || 'tongyi';
    this.currentModel = settings.aiModel || 'qwen-plus';
    this.apiKey = settings.aiApiKey || 'sk-fae27cc50015409fb2524b0970d3f0b0';
    this.customApiEndpoint = settings.aiCustomEndpoint || '';
  }

  /**
   * 更新API配置（由超级面板调用）
   */
  public updateApiConfig(provider: string, model: string, apiKey: string, customEndpoint: string) {
    this.currentProvider = provider;
    this.currentModel = model;
    this.apiKey = apiKey;
    this.customApiEndpoint = customEndpoint;
  }

  /**
   * 获取API Key
   */
  private getApiKey(): string {
    return this.apiKey || 'sk-fae27cc50015409fb2524b0970d3f0b0';
  }

  /**
   * 初始化单词查询功能
   */
  public init() {
    this.addDock();
  }

  /**
   * 添加单词查询 Dock 到右侧边栏
   */
  private addDock() {
    const self = this;
    this.plugin.addDock({
      config: {
        position: 'RightTop',
        size: { width: 360, height: 0 },
        icon: 'iconLanguage', // 使用语言图标
        title: (this.plugin.i18n as any).wordQuery?.title || '单词查询',
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
              plugin: self.plugin,
              onQuery: async (word: string) => {
                return await self.queryWord(word);
              },
              onTranslate: async (text: string, sourceLang: string, targetLang: string) => {
                return await self.translateText(text, sourceLang, targetLang);
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
    return /^[\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF\s\-.,;:!?'"()（）【】《》《""''']+$/.test(text);
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

    try {
      // 根据输入类型构建不同的提示词
      const prompt = this.buildPrompt(word);
      const response = await this.callAPI(prompt);

      if (response) {
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
      // 对于混合输入或其他情况，尝试智能判断
      const hasChinese = /[\u4e00-\u9fa5]/.test(word);
      const hasEnglish = /[a-zA-Z]/.test(word);

      if (hasChinese && !hasEnglish) {
        // 主要为中文，按中文处理
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
      } else if (hasEnglish && !hasChinese) {
        // 主要为英文，按英文处理
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
      } else {
        // 混合内容，智能判断主语言
        return `请为词语 "${word}" 生成详细信息，分析该词语的语言类型，如果是英文，请提供中文释义；如果是中文，请提供英文翻译。

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
- 智能判断主要语言类型
- 只输出格式化内容，不要有其他说明文字`;
      }
    }
  }

  /**
   * 调用API
   */
  private async callAPI(prompt: string): Promise<string> {
    switch (this.currentProvider) {
      case 'tongyi':
        return await this.callTongyiAPI(prompt);
      case 'openai':
        return await this.callOpenAIAPI(prompt);
      case 'deepseek':
        return await this.callDeepSeekAPI(prompt);
      case 'custom':
        return await this.callCustomAPI(prompt);
      default:
        throw new Error(`不支持的API供应商: ${this.currentProvider}`);
    }
  }

  /**
   * 调用通义千问API
   */
  private async callTongyiAPI(prompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    const apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    const requestBody = {
      model: this.currentModel || 'qwen-plus',
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

    const response = await fetch(apiUrl, {
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
   * 调用OpenAI API
   */
  private async callOpenAIAPI(prompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    const requestBody = {
      model: this.currentModel || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的多语言教学助手，擅长提供单词的详细释义、音标、谐音和例句。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      throw new Error('OpenAI API返回数据格式错误');
    }
  }

  /**
   * 调用DeepSeek API
   */
  private async callDeepSeekAPI(prompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    const requestBody = {
      model: this.currentModel || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的多语言教学助手，擅长提供单词的详细释义、音标、谐音和例句。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      throw new Error('DeepSeek API返回数据格式错误');
    }
  }

  /**
   * 调用自定义API
   */
  private async callCustomAPI(prompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    const apiUrl = this.customApiEndpoint;

    if (!apiUrl) {
      throw new Error('自定义API端点未设置');
    }

    // 尝试使用通用的OpenAI兼容格式
    const requestBody = {
      model: this.currentModel || 'default',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的多语言教学助手，擅长提供单词的详细释义、音标、谐音和例句。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`自定义API请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // 尝试多种响应格式
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else if (data.output && data.output.text) {
      return data.output.text;
    } else if (data.text) {
      return data.text;
    } else if (data.content) {
      return data.content;
    } else {
      throw new Error('自定义API返回数据格式错误');
    }
  }

  /**
   * 翻译文本
   * @param text - 要翻译的文本
   * @param sourceLang - 源语言
   * @param targetLang - 目标语言
   */
  public async translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (!text) {
      showMessage(this.plugin.i18n.noTextToTranslate || '请输入要翻译的文本', 3000, 'error');
      return '';
    }

    showMessage('🌐 正在翻译...', 2000, 'info');

    try {
      const prompt = this.buildTranslatePrompt(text, sourceLang, targetLang);
      const response = await this.callAPI(prompt);

      if (response) {
        showMessage('✓ 翻译完成', 2000, 'info');
        return response;
      } else {
        showMessage('翻译失败，请重试', 3000, 'error');
        return '';
      }
    } catch (error) {
      console.error('Translation error:', error);
      const errorMsg = error.message || '未知错误';
      showMessage('🚫 翻译失败: ' + errorMsg, 5000, 'error');
      return '';
    }
  }

  /**
   * 构建翻译提示词
   */
  private buildTranslatePrompt(text: string, sourceLang: string, targetLang: string): string {
    const langNames: Record<string, string> = {
      'auto': '自动检测',
      'zh': '中文',
      'en': '英文',
      'ja': '日文',
      'ko': '韩文',
      'fr': '法文',
      'de': '德文',
      'es': '西班牙文'
    };

    const sourceName = langNames[sourceLang] || sourceLang;
    const targetName = langNames[targetLang] || targetLang;

    if (sourceLang === 'auto') {
      return `请将以下文本翻译成${targetName}，保持原文的格式和语气，只输出翻译结果，不要有任何解释或说明：

${text}`;
    } else {
      return `请将以下${sourceName}文本翻译成${targetName}，保持原文的格式和语气，只输出翻译结果，不要有任何解释或说明：

${text}`;
    }
  }

  /**
   * 销毁功能
   */
  public destroy() {
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

  return query;
}
