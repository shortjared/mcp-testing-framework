export interface IConfig {
  model: string
}

export interface IApiProvider {
  config?: IConfig
  apiUrl?: string
  apiKey: string
  createMessage(systemPrompt: string, message: string): Promise<string>
}
