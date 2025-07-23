export interface IToolExecutionResult {
  success: boolean
  content?: any
  error?: string
}

export interface IGradingResult {
  grade: 'PASS' | 'FAIL'
  reasoning: string
  finalMessage?: string
}

export interface IModelResponse {
  passed: boolean
  response?: any
  error?: string
  toolExecutionResult?: IToolExecutionResult
  gradingResult?: IGradingResult
}

export interface IEvaluateResult {
  prompt: string
  rates: number[]
  modelResponses?: Array<IModelResponse[]>
}

export interface IModelSpec {
  provider: string
  model: string
}

// Parameter configuration for enhanced optional parameter support
export interface IParameterConfig {
  value: any
  optional?: boolean
}

// Type for parameters that can be either simple values or enhanced configs
export type ParameterValue = any | IParameterConfig

export interface IExpectedToolUsage {
  serverName: string
  toolName: string
  parameters: Record<string, ParameterValue>
}

export interface IExpectedResults {
  content: string
}

export interface ITestCase {
  prompt: string
  expectedToolUsage: IExpectedToolUsage
  expectedResults?: IExpectedResults
  gradingPrompt?: string
}

// Backward compatibility - deprecated
export interface IExpectedOutput extends IExpectedToolUsage {}

export interface IMcpServer {
  name: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  headers?: Record<string, string>
}

export interface IRetryConfig {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
}

export interface IMcpTestingFrameworkConfig {
  testRound?: number
  passThreshold?: number
  concurrencyLimit?: number
  executeTools?: boolean
  gradingPrompt?: string
  retryConfig?: IRetryConfig
  modelsToTest: string[]
  testCases: ITestCase[]
  mcpServers: IMcpServer[]
}

export interface ISuiteInfo {
  name: string
  filePath: string
  config: IMcpTestingFrameworkConfig
}

export interface ISuiteResult {
  suiteInfo: ISuiteInfo
  evaluateResults: IEvaluateResult[]
  passed: boolean
  passRate: number
}

export interface IMultiSuiteResult {
  suiteResults: ISuiteResult[]
  overallPassed: boolean
  totalSuites: number
  passedSuites: number
}
