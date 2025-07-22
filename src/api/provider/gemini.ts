import { GoogleGenerativeAI } from '@google/generative-ai'

import { IApiProvider, IConfig } from './provider'
import { retryWithBackoff } from '../../utilities/retry-with-backoff'

interface IGeminiOptions {
  config: IConfig
}

export class GeminiProvider implements IApiProvider {
  private _config: IConfig
  private _client: GoogleGenerativeAI

  public constructor(options: IGeminiOptions) {
    this._config = options.config
    this._client = new GoogleGenerativeAI(this.apiKey)
  }

  public async createMessage(
    systemPrompt: string,
    message: string,
  ): Promise<string> {
    return retryWithBackoff(
      async () => {
        const model = this._client.getGenerativeModel({
          model: this._config.model,
        })

        const chatSession = model.startChat({
          systemInstruction: systemPrompt,
        })

        const result = await chatSession.sendMessage(message)
        const response = await result.response
        return response.text()
      },
      {
        maxRetries: 6,
        baseDelay: 2000, // Gemini can be more aggressive with rate limits
        maxDelay: 30000,
      },
    )
  }

  public get apiKey(): string {
    return process.env.GEMINI_API_KEY ?? ''
  }
}
