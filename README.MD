# MCP Testing Framework

Read this in other languages: English | [简体中文](./README_zh-CN.MD)

MCP Testing Framework is a powerful MCP Server evaluation tool. This framework supports batch testing of various AI large models including OpenAI, Google Gemini, Anthropic, and Deepseek, as well as custom models.

## Motivation

The core goal of the MCP Testing Framework is to help developers test and evaluate MCP Servers. Large Language Models (LLMs) heavily rely on the names, descriptions, and parameter definitions in your MCP Server when deciding when and how to call tools. However, evaluating the effectiveness of these definitions is often a subjective process that is difficult to quantify. This framework provides a standardized testing methodology that enables developers to objectively measure how different models understand and adapt to MCP Server definitions, helping to improve MCP Server design and increase the accuracy of model tool calls.

## Features

- **Multi-model Support**: Built-in support for mainstream large models including OpenAI, Google Gemini, Anthropic, and Deepseek
- **Batch Evaluation**: Run the same test set on multiple models simultaneously for easy horizontal comparison
- **Automated Testing**: Batch execute test cases and calculate pass rates
- **Multi-MCP Server Support**: Configure multiple MCP servers for testing
- **Highly Configurable**: Customize test rounds, pass thresholds, and other parameters through configuration files
- **Custom Model Support**: Easily create and register custom model providers with code

## Quick Start

### Initialize Project

```bash
npx mcp-testing-framework@latest init [target directory] --example getting-started
```

This command will create a basic MCP test project structure, including sample configuration files and test cases.

### Run Evaluation Tests

Before running tests, make sure you have an OpenAI API key. You can apply for one from the [OpenAI Developer Platform](https://platform.openai.com/docs/overview) and configure it in the `.env` file in your project:

```
OPENAI_API_KEY=sk-...
```

You can also run the command directly, but the test will not succeed.

Run the test command:

```bash
npx mcp-testing-framework@latest evaluate
```

This command will execute test cases according to the configuration file and generate a test report saved in the `mcp-report` directory.

## Configuration

Project configuration is defined through the YAML file `mcp-testing-framework.yaml`, which mainly includes the following settings:

```yaml
# Number of rounds for each model test execution
testRound: 10

# Minimum threshold for passing tests (decimal between 0-1)
passThreshold: 0.8

# List of models to test
modelsToTest:
  - openai:gpt-4-turbo
  - gemini:gemini-pro
  - anthropic:claude-3-opus
  - deepseek:deepseek-chat
  - custom:my-model  # Custom provider example

# Test case definitions
testRound: 5
passThreshold: 0.8

# List of models to test
modelsToTest:
  - openai:gpt-4o
  - openai:gpt-4o-mini

# Test case definitions
testCases:
  - prompt: "Help me calculate my BMI index, my weight is 90kg, my height is 180cm"
    expectedOutput:
      serverName: "example-server"
      toolName: "calculate-bmi"
      parameters:
        weightKg: 90
        heightM: 1.8

# MCP server configuration
mcpServers:
  - name: 'mcp-server-1'
    command: 'npx'
    args: ['-y', 'mcp-server']
  - name: 'mcp-server-2'
    url: 'http://localhost:3001/sse'
```

## Supported Models

The MCP Testing Framework currently supports the following AI models:

1. **OpenAI**

   - Format: `openai:model-name`
   - Examples: `openai:gpt-4-turbo`, `openai:gpt-3.5-turbo`
   - Environment Variable: `OPENAI_API_KEY`
   - Use Cases: General text generation, Q&A, and content creation

2. **Google Gemini**

   - Format: `gemini:model-name`
   - Examples: `gemini:gemini-pro`, `gemini:gemini-ultra`
   - Environment Variable: `GEMINI_API_KEY`
   - Use Cases: Multimodal understanding and generation

3. **Anthropic**

   - Format: `anthropic:model-name`
   - Examples: `anthropic:claude-3-opus`, `anthropic:claude-3-sonnet`
   - Environment Variable: `ANTHROPIC_API_KEY`
   - Use Cases: High-safety text generation and long context understanding

4. **Deepseek**

   - Format: `deepseek:model-name`
   - Examples: `deepseek:deepseek-chat`, `deepseek:deepseek-coder`
   - Environment Variable: `DEEPSEEK_API_KEY`
   - Customizable API Endpoint: `DEEPSEEK_API_URL` (defaults to the official API endpoint)
   - Use Cases: Code generation and technical content creation

5. **Custom Models**
   - You can implement and register your own models to support any API call
   - See the [Custom Model Implementation](#custom-model-implementation) section below

Before starting, you need to set the API key environment variables for the required models. You can add these environment variables to the `.env` file in your project.

## Custom Model Implementation

You can easily extend MCP Testing Framework with your own custom models.

### 1. Create a custom model Provider class

```typescript
import { IApiProvider, IConfig, registerProvider } from 'mcp-testing-framework'

class MyCustomProvider implements IApiProvider {
  private _config: IConfig

  constructor(options: { config: IConfig }) {
    this._config = options.config
  }

  async createMessage(systemPrompt: string, message: string): Promise<string> {
    // Implement your API call here
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

### 2. Register model Provider

```typescript
// Register with a unique name
registerProvider('my-custom', MyCustomProvider)
```

### 3. Configure in `mcp-testing-framework.yaml`

```yaml
modelsToTest:
  - my-custom:my-model-name
```

You can also refer to the [`examples/custom-provider`](./examples/custom-provider) directory for an example implementation of how to create a custom model Provider.

## Contribution Guidelines

We welcome issue reports and suggestions for improvement! To contribute code, please fork this project first, then submit a pull request.
