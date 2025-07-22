import OpenAI from 'openai'

import { IApiProvider, IConfig } from './provider'

interface IOpenAiOptions {
  config: IConfig
}

export class OpenAiProvider implements IApiProvider {
  private _config: IConfig
  private _client: OpenAI

  public constructor(options: IOpenAiOptions) {
    this._config = options.config
    this._client = new OpenAI({
      baseURL: this.apiUrl,
      apiKey: this.apiKey,
      maxRetries: 8, // Increased from default 2 for testing scenarios
    })
  }

  public async createMessage(
    systemPrompt: string,
    message: string,
  ): Promise<string> {
    const response = await this._client.chat.completions.create({
      model: this._config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    })
    return response.choices[0].message.content ?? ''
  }

  public get apiUrl(): string {
    return 'https://api.openai.com/v1'
  }

  public get apiKey(): string {
    return process.env.OPENAI_API_KEY ?? ''
  }
}
