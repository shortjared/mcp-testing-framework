# MCP Testing Framework - Development Guide

## Project Overview

**MCP Testing Framework** is a powerful evaluation tool for testing MCP (Model Context Protocol) Servers across multiple AI models. The framework provides batch testing capabilities across OpenAI, Google Gemini, Anthropic, and Deepseek models, with support for custom model providers.

### Core Purpose

- **Objective MCP Server Evaluation**: Provides standardized testing methodology to measure how different LLMs understand and adapt to MCP Server definitions
- **Multi-Model Comparison**: Run identical test sets across multiple models simultaneously for horizontal comparison
- **Automated Testing**: Batch execute test cases and calculate pass rates with configurable thresholds

### Key Features

- Multi-model support (OpenAI, Gemini, Anthropic, Deepseek + custom providers)
- Batch evaluation with concurrent test execution
- Automated pass/fail determination based on expected JSON-formatted responses
- Multi-MCP Server support (stdio, SSE, HTTP transports)
- Comprehensive reporting with detailed test results
- Extensible architecture for custom model providers

## Architecture Overview

### Core Components

1. **TestManager** (`/src/core/model-context-protocol/test-manager.ts`)
   - Central orchestrator for test execution
   - Manages test rounds, concurrency, and result aggregation
   - Coordinates between MCP servers and AI model providers

2. **McpHub** (`/src/core/model-context-protocol/mcp-hub.ts`)
   - Handles MCP server connections (stdio, SSE, HTTP)
   - Manages tool discovery and schema extraction
   - Supports multiple transport types for different server configurations

3. **Provider Registry** (`/src/api/provider/registry.ts`)
   - Singleton pattern for managing AI model providers
   - Built-in providers: OpenAI, Gemini, Anthropic, Deepseek
   - Extensible system for custom provider registration

4. **Configuration System** (`/src/utilities/config.ts`)
   - YAML-based configuration with hierarchical file discovery
   - Supports test parameters, model specifications, and server definitions

### Data Flow

```
Config File → TestManager → McpHub (discovers tools) → System Prompt Generation
                ↓
Test Cases → Multiple Model Providers (concurrent) → JSON Response Parsing
                ↓
Expected Output Comparison → Pass/Fail Results → Report Generation
```

### Key Patterns

1. **Provider Pattern**: All AI models implement `IApiProvider` interface
2. **Registry Pattern**: Providers are registered and created through a central registry
3. **Concurrent Execution**: Tests run concurrently with configurable limits via `ConcurrencyController`
4. **JSON-based Responses**: Models must respond in structured JSON format for tool calls
5. **Configuration Discovery**: Searches up directory tree for `mcp-testing-framework.yaml`

## Development Commands

### Core Scripts (via package.json)

- `pnpm run build` - Build TypeScript to JavaScript (uses Heft)
- `pnpm run test` - Run test suite with Jest (via Heft)
- `pnpm run typecheck` - TypeScript type checking without compilation
- `pnpm run eslint` - Lint and fix code issues
- `pnpm run prettier` - Format code

### CLI Commands (via binary)

- `npx mcp-testing-framework init [dir] --example getting-started` - Initialize new project
- `npx mcp-testing-framework evaluate` - Run evaluation tests
- `mctest` - Short alias for the CLI

### Development Workflow

1. **Build**: Uses Microsoft's Heft build system (`@rushstack/heft`)
2. **Linting**: ESLint with Rushstack configuration + Prettier
3. **Type Checking**: Strict TypeScript with Rush Stack base configuration
4. **Testing**: Jest via Heft with Node.js rig
5. **Pre-commit**: Husky + lint-staged for automated quality checks

## Configuration Structure

### Main Config File: `mcp-testing-framework.yaml`

```yaml
# Test execution parameters
testRound: 10 # Number of test iterations per model
passThreshold: 0.8 # Minimum pass rate (0-1)
concurrencyLimit: 5 # Max concurrent test executions

# Models to evaluate (provider:model format)
modelsToTest:
  - openai:gpt-4o
  - anthropic:claude-3-opus
  - gemini:gemini-pro
  - deepseek:deepseek-chat
  - custom:my-model # Custom provider example

# Test case definitions
testCases:
  - prompt: 'Help me calculate my BMI index, my weight is 90kg, my height is 180cm'
    expectedOutput:
      serverName: 'example-server'
      toolName: 'calculate-bmi'
      parameters:
        weightKg: 90
        heightM: 1.8
  - prompt: 'Search for healthcare providers in California'
    expectedOutput:
      serverName: 'healthcare-server'
      toolName: 'search-providers'
      parameters:
        # Case insensitive comparison for state parameter
        state:
          value: 'california'
          caseInsensitive: true
        # Optional parameter with case insensitive comparison
        specialty:
          value: 'cardiology'
          optional: true
          caseInsensitive: true

# MCP Server configurations
mcpServers:
  - name: 'local-server'
    command: 'npx' # stdio transport
    args: ['-y', 'mcp-server']
    env:
      KEY: 'value'
  - name: 'remote-server'
    url: 'http://localhost:3001/sse' # SSE transport
```

### Enhanced Parameter Configuration

The framework supports enhanced parameter configuration with additional options:

#### Simple Parameters

```yaml
parameters:
  weightKg: 90
  heightM: 1.8
```

#### Enhanced Parameters with Options

```yaml
parameters:
  # Optional parameter - test passes even if model doesn't provide this
  optionalParam:
    value: 'default-value'
    optional: true

  # Case insensitive comparison - 'California', 'california', 'CALIFORNIA' all match
  state:
    value: 'california'
    caseInsensitive: true

  # Combined options - optional AND case insensitive
  category:
    value: 'medical'
    optional: true
    caseInsensitive: true
```

#### Enhanced Parameter Options

- **`optional: true`** - Parameter is not required for test to pass. If missing from model response, test continues without failure.
- **`caseInsensitive: true`** - String comparison ignores case. Works with strings, arrays of strings, and nested objects containing strings.

### Environment Variables

Required API keys (set in `.env` file):

- `OPENAI_API_KEY` - For OpenAI models
- `ANTHROPIC_API_KEY` - For Anthropic models
- `GEMINI_API_KEY` - For Google Gemini models
- `DEEPSEEK_API_KEY` - For Deepseek models
- `DEEPSEEK_API_URL` - Optional custom Deepseek endpoint

## Extending the Framework

### Adding Custom Model Providers

1. **Create Provider Class**:

```typescript
import { IApiProvider, IConfig } from 'mcp-testing-framework'

class MyCustomProvider implements IApiProvider {
  private _config: IConfig

  constructor(options: { config: IConfig }) {
    this._config = options.config
  }

  async createMessage(systemPrompt: string, message: string): Promise<string> {
    // Implement API call logic
    return response.content
  }

  get apiKey(): string {
    return process.env.MY_CUSTOM_API_KEY || ''
  }
}
```

2. **Register Provider**:

```typescript
import { registerProvider } from 'mcp-testing-framework'
registerProvider('my-custom', MyCustomProvider)
```

3. **Use in Config**:

```yaml
modelsToTest:
  - my-custom:my-model-name
```

### System Prompt Format

The framework generates system prompts that include:

- Available MCP tools with descriptions and schemas
- Required JSON response format
- Examples of proper tool usage

Models must respond in this JSON format:

```json
{
  "serverName": "server_name",
  "toolName": "tool_name",
  "parameters": {
    "parameter_name": "parameter_value"
  }
}
```

## Important File Locations

### Source Code Structure

- `/src/index.ts` - Main library exports
- `/src/run.ts` - CLI entry point
- `/src/commands/` - CLI command implementations
- `/src/core/model-context-protocol/` - Core MCP logic
- `/src/api/provider/` - AI model provider implementations
- `/src/utilities/` - Shared utilities and helpers
- `/src/types/` - TypeScript type definitions

### Built Artifacts

- `/lib/` - Compiled JavaScript output
- `/bin/mcp-testing-framework` - CLI binary entry point

### Configuration

- `/config/` - Heft build system configuration
- `/tsconfig.json` - TypeScript configuration
- `/.eslintrc.js` - ESLint configuration
- `/examples/` - Example projects and configurations

### Documentation

- `/README.md` - User-facing documentation
- `/website/` - Docusaurus documentation site
- `/CHANGELOG.md` - Version history

## Testing Strategy

The framework evaluates MCP servers by:

1. **Discovering Tools**: Connects to configured MCP servers to list available tools
2. **Generating System Prompts**: Creates comprehensive prompts with tool schemas
3. **Running Test Cases**: Executes prompts against multiple models concurrently
4. **Parsing Responses**: Expects structured JSON responses matching expected output
5. **Calculating Pass Rates**: Compares actual vs expected outputs using deep equality
6. **Generating Reports**: Creates detailed reports in `mcp-report/` directory

### Success Criteria

- Tests pass when model responses exactly match expected JSON structure
- Pass rates calculated per model per test case
- Overall success requires all test cases to meet the configured pass threshold

## Development Tips

1. **Build System**: Uses Microsoft's Heft - run `pnpm run build` for full compilation
2. **Code Style**: Follows Rushstack ESLint config with Prettier formatting
3. **Type Safety**: Strict TypeScript - ensure all types are properly defined
4. **Concurrency**: Test execution is concurrent by default - consider rate limits
5. **Error Handling**: Framework expects JSON responses - malformed responses fail tests
6. **Debugging**: Check `mcp-report/` directory for detailed test results and logs

## Common Patterns

- **Async/Await**: Heavy use of async patterns for API calls and file operations
- **Promise.all**: Concurrent execution of test batches
- **Singleton Registry**: Provider registry uses singleton pattern
- **Factory Pattern**: Provider creation through registry factory methods
- **Strategy Pattern**: Different transport strategies for MCP server connections
- **Observer Pattern**: Progress updates during test execution
