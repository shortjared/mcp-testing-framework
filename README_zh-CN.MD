# MCP测试框架

使用其他语言阅读：[English](./README.MD) | 简体中文

MCP测试框架是一个强大的MCP Server评估工具。该框架支持针对OpenAI、Google Gemini、Anthropic和Deepseek等多种AI大模型进行批量测试，同时支持自定义模型。

## 动机

MCP测试框架的核心目标是帮助开发者测试和评估MCP Server。大型语言模型(LLMs)在决定何时以及如何调用工具时，严重依赖于你在MCP Server中定义的名称、描述和参数等信息。然而，评估这些定义的有效性往往是主观且难以量化的过程。本框架通过提供标准化的测试方法，使开发者能够客观衡量不同模型对MCP Server定义的理解和适应能力，从而帮助改进MCP Server的设计，提高模型调用的准确率。

## 功能特点

- **多模型支持**: 内置支持OpenAI、Google Gemini、Anthropic和Deepseek等主流大模型
- **批量评估**: 同时对多个模型运行相同测试集，方便横向对比
- **自动化测试**: 批量执行测试用例并计算通过率
- **多MCP Server支持**: 可配置多个MCP Server进行测试
- **高度可配置**: 通过配置文件自定义测试轮次、通过阈值等参数
- **自定义模型支持**: 通过代码轻松创建和注册自定义模型

## 快速开始

### 初始化项目

```bash
npx mcp-testing-framework@latest init [目标目录] --example getting-started
```

此命令将创建一个基本的MCP测试项目结构，包含示例配置文件和测试用例。

### 运行评估测试

在运行测试前我们需要确保拥有OpenAI API key，你可以去[OpenAI开发者平台](https://platform.openai.com/docs/overview)申请，并将它配置到项目下的 `.env` 文件下：

```
OPENAI_API_KEY=sk-...
```

你也可以直接运行命令，但是测试不会成功。

运行测试命令：

```bash
npx mcp-testing-framework@latest evaluate
```

此命令将根据配置文件执行测试用例，并生成测试报告保存到 `mcp-report` 目录下。

## 配置说明

项目配置通过YAML文件 `mcp-testing-framework.yaml` 定义，主要包括以下设置：

```yaml
# 每个模型测试执行的轮次数量
testRound: 10

# 测试通过的最低阈值（0-1之间的小数）
passThreshold: 0.8

# 要测试的模型列表
modelsToTest:
  - openai:gpt-4-turbo
  - gemini:gemini-pro
  - anthropic:claude-3-opus
  - deepseek:deepseek-chat
  - custom:my-model # 自定义提供者示例

# 测试用例定义
testRound: 5
passThreshold: 0.8

# 需要测试的模型列表
modelsToTest:
  - openai:gpt-4o
  - openai:gpt-4o-mini

# 测试 Cases
testCases:
  - prompt: "帮我计算一下 bmi 指数，我的重量是90kg，我的身高是180cm"
    expectedOutput:
      serverName: "example-server"
      toolName: "calculate-bmi"
      parameters:
        weightKg: 90
        heightM: 1.8

# MCP服务器配置
mcpServers:
  - name: 'mcp-server-1'
    command: 'npx'
    args: ['-y', 'mcp-server']
  - name: 'mcp-server-2'
    url: 'http://localhost:3001/sse'
```

## 支持的模型

MCP测试框架目前支持以下AI模型：

1. **OpenAI**

   - 格式: `openai:model-name`
   - 示例: `openai:gpt-4-turbo`, `openai:gpt-3.5-turbo`
   - 环境变量: `OPENAI_API_KEY`
   - 适用场景: 通用文本生成、问答和内容创作

2. **Google Gemini**

   - 格式: `gemini:model-name`
   - 示例: `gemini:gemini-pro`, `gemini:gemini-ultra`
   - 环境变量: `GEMINI_API_KEY`
   - 适用场景: 多模态理解和生成

3. **Anthropic**

   - 格式: `anthropic:model-name`
   - 示例: `anthropic:claude-3-opus`, `anthropic:claude-3-sonnet`
   - 环境变量: `ANTHROPIC_API_KEY`
   - 适用场景: 安全性高的文本生成和长上下文理解

4. **Deepseek**

   - 格式: `deepseek:model-name`
   - 示例: `deepseek:deepseek-chat`, `deepseek:deepseek-coder`
   - 环境变量: `DEEPSEEK_API_KEY`
   - 可自定义API端点: `DEEPSEEK_API_URL`（默认为官方API端点）
   - 适用场景: 代码生成和技术内容创作

5. **自定义提供者**
   - 您可以实现并注册自己的模型以支持任何API调用
   - 可以参考下面的[自定义提供者实现](#自定义提供者实现)部分

在开始使用前，需要设置所需模型的API密钥环境变量。你可以将环境变量加入到项目下 `.env` 文件中。

## 自定义模型实现

您可以通过自定义模型轻松扩展MCP测试框架。

### 1. 创建自定义模型Provider类

```typescript
import { IApiProvider, IConfig, registerProvider } from 'mcp-testing-framework'

class MyCustomProvider implements IApiProvider {
  private _config: IConfig

  constructor(options: { config: IConfig }) {
    this._config = options.config
  }

  async createMessage(systemPrompt: string, message: string): Promise<string> {
    // 在此实现您的API调用
    const response = await this._client.chat.completions.create({
      model: this._config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    })
    return response.choices[0].message.content ?? ''
  }

  get apiUrl(): string {
    return 'https://api.mycustomprovider.com/v1'
  }

  get apiKey(): string {
    return process.env.MY_CUSTOM_API_KEY || ''
  }
}
```

### 2. 注册模型Provider

```typescript
// 使用唯一名称注册
registerProvider('my-custom', MyCustomProvider)
```

### 3. 在 `mcp-testing-framework.yaml` 中配置

```yaml
modelsToTest:
  - my-custom:my-model-name
```

您也可以参考 [`examples/custom-provider`](./examples/custom-provider) 目录下的示例实现，了解如何创建自定义模型Provider。

## 贡献指南

欢迎提交问题报告和改进建议！如需贡献代码，请先fork本项目，然后提交pull request。
