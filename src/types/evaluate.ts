export interface IModelResponse {
  passed: boolean
  response?: any
  error?: string
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

export interface IExpectedOutput {
  serverName: string
  toolName: string
  parameters: Record<string, string>
}

export interface ITestCase {
  prompt: string
  expectedOutput: IExpectedOutput
}

export interface IMcpServer {
  name: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

export interface IMcpTestingFrameworkConfig {
  testRound?: number
  passThreshold?: number
  concurrencyLimit?: number
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
