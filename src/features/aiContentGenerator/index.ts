/**
 * AI信息生成功能模块
 * 支持自定义对话配置、Markdown格式输出、上下文配置
 */
import { Plugin, showMessage } from 'siyuan';
import { createApp, h } from 'vue';
// @ts-ignore
import AIContentGeneratorPanel from './AIContentGeneratorPanel.vue';

/**
 * 生成选项接口
 */
export interface GenerateOptions {
  userInput: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  context?: string;
  onChunk?: (chunk: string) => void; // 流式输出回调（修复问题2：支持打字机效果）
}

/**
 * AI内容生成类
 */
export class AIContentGenerator {
  private plugin: Plugin;
  private currentProvider: string = 'tongyi';
  private apiKey: string = '';
  private customApiEndpoint: string = '';

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    // 从插件配置中初始化API配置
    const settings = (plugin as any).settings;
    this.currentProvider = settings.aiApiProvider || 'tongyi';
    this.apiKey = settings.aiApiKey || '';
    this.customApiEndpoint = settings.aiCustomEndpoint || '';
  }

  /**
   * 更新API配置（由超级面板调用）
   */
  public updateApiConfig(provider: string, apiKey: string, customEndpoint: string) {
    this.currentProvider = provider;
    this.apiKey = apiKey;
    this.customApiEndpoint = customEndpoint;
    console.log('AI Content Generator API配置已更新:', { provider, customEndpoint });
  }

  /**
   * 获取API Key
   */
  private getApiKey(): string {
    return this.apiKey || '';
  }

  /**
   * 获取自定义API端点
   */
  private getCustomApiEndpoint(): string {
    return this.customApiEndpoint;
  }

  /**
   * 初始化AI内容生成功能
   */
  public init() {
    this.addDock();
    console.log('AI内容生成模块已初始化');
  }

  /**
   * 添加AI内容生成 Dock 到右侧边栏
   */
  private addDock() {
    const self = this;
    this.plugin.addDock({
      config: {
        position: 'RightTop',
        size: { width: 400, height: 0 },
        icon: 'iconSparkles', // 使用思源内置的AI/魔法图标
        title: this.plugin.i18n.aiContentGenerator || 'AI信息生成',
        show: false,
      },
      data: {},
      type: 'ai-content-generator-dock',
      init: (dock: any) => {
        // 创建 Vue 应用
        const container = document.createElement('div');
        container.style.height = '100%';
        container.style.overflow = 'hidden';

        const app = createApp({
          setup() {
            return () => h(AIContentGeneratorPanel, {
              i18n: self.plugin.i18n,
              onGenerate: async (options: GenerateOptions) => {
                return await self.generateContent(options);
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
   * 生成内容
   */
  public async generateContent(options: GenerateOptions): Promise<string> {
    if (!options.userInput) {
      showMessage(this.plugin.i18n.enterInput || '请输入内容', 3000, 'error');
      return '';
    }

    showMessage('🤖 AI正在生成内容...', 2000, 'info');

    try {
      const response = await this.callAPI(options);

      if (response) {
        showMessage('✓ 生成完成', 2000, 'info');
        return response;
      } else {
        showMessage('生成失败，请重试', 3000, 'error');
        return '';
      }
    } catch (error) {
      console.error('AI content generation error:', error);
      const errorMsg = (error as Error).message || '未知错误';
      showMessage('🚫 生成失败: ' + errorMsg, 5000, 'error');
      throw error;
    }
  }

  /**
   * 构建完整的提示词
   */
  private buildFullPrompt(options: GenerateOptions): string {
    let fullPrompt = options.userInput;

    // 如果有上下文，添加到提示词中
    if (options.context) {
      fullPrompt = `上下文信息:
${options.context}

用户问题:
${options.userInput}`;
    }

    return fullPrompt;
  }

  /**
   * 调用API
   */
  private async callAPI(options: GenerateOptions): Promise<string> {
    switch (this.currentProvider) {
      case 'tongyi':
        return await this.callTongyiAPI(options);
      case 'openai':
        return await this.callOpenAIAPI(options);
      case 'deepseek':
        return await this.callDeepSeekAPI(options);
      case 'custom':
        return await this.callCustomAPI(options);
      default:
        throw new Error(`不支持的API供应商: ${this.currentProvider}`);
    }
  }

  /**
   * 调用通义千问API（修复问题2：支持流式输出）
   */
  private async callTongyiAPI(options: GenerateOptions): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('请先在超级面板中配置API密钥');
    }

    const apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    const fullPrompt = this.buildFullPrompt(options);

    const requestBody = {
      model: 'qwen-plus',
      input: {
        messages: [
          {
            role: 'system',
            content: options.systemPrompt
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ]
      },
      parameters: {
        temperature: options.temperature,
        top_p: 0.8,
        max_tokens: options.maxTokens,
        incremental_output: true // 启用流式输出
      }
    };

    // 如果有onChunk回调，使用流式输出（修复问题2）
    if (options.onChunk) {
      return await this.callTongyiStreamAPI(apiUrl, apiKey, requestBody, options.onChunk);
    }

    // 否则使用普通请求
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
      throw new Error(`通义千问API请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // 解析响应
    if (data.output && data.output.text) {
      return data.output.text;
    } else if (data.output && data.output.choices && data.output.choices.length > 0) {
      return data.output.choices[0].message.content;
    } else if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      throw new Error('API返回数据格式错误');
    }
  }

  /**
   * 调用通义千问流式API（修复问题2）
   */
  private async callTongyiStreamAPI(
    apiUrl: string,
    apiKey: string,
    requestBody: any,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // 添加SSE参数
    const sseRequestBody = {
      ...requestBody,
      parameters: {
        ...requestBody.parameters,
        result_format: 'message', // 使用message格式
        incremental_output: true  // 启用增量输出（非常重要，修复问题2）
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-SSE': 'enable' // 启用SSE
      },
      body: JSON.stringify(sseRequestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`通义千问流式API请求失败: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一行作为缓冲

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue;

          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);

            // 解析通义千问的SSE格式（修复问题2：正确处理增量输出）
            let content = '';
            if (json.output?.choices?.[0]?.message?.content) {
              content = json.output.choices[0].message.content;
            } else if (json.output?.text) {
              content = json.output.text;
            }

            if (content) {
              // 因为启用了incremental_output=true，每次返回的就是增量内容
              // 直接调用onChunk，不需要计算差值（修复问题2）
              onChunk(content);
              fullContent += content;
            }
          } catch (e) {
            console.error('解析SSE数据失败:', e, 'line:', line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }

  /**
   * 调用OpenAI API
   */
  private async callOpenAIAPI(options: GenerateOptions): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('请先在超级面板中配置API密钥');
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    const fullPrompt = this.buildFullPrompt(options);

    const requestBody = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: options.systemPrompt
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens
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
  private async callDeepSeekAPI(options: GenerateOptions): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('请先在超级面板中配置API密钥');
    }

    const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    const fullPrompt = this.buildFullPrompt(options);

    const requestBody = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: options.systemPrompt
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens
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
  private async callCustomAPI(options: GenerateOptions): Promise<string> {
    const apiKey = this.getApiKey();
    const apiUrl = this.customApiEndpoint;

    if (!apiUrl) {
      throw new Error('自定义API端点未设置');
    }

    const fullPrompt = this.buildFullPrompt(options);

    // 使用通用的OpenAI兼容格式
    const requestBody = {
      model: 'default',
      messages: [
        {
          role: 'system',
          content: options.systemPrompt
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens
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
   * 销毁功能
   */
  public destroy() {
    console.log('AI内容生成模块已销毁');
  }
}

/**
 * 注册AI内容生成模块
 */
export function registerAIContentGenerator(plugin: Plugin) {
  const generator = new AIContentGenerator(plugin);
  generator.init();

  // 保存实例到插件对象中，以便在其他地方使用
  (plugin as any).__aiContentGenerator = generator;

  console.log('AI内容生成模块已注册');
  return generator;
}
