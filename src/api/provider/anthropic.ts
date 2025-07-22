import Anthropic from '@anthropic-ai/sdk'

import { IApiProvider, IConfig } from './provider'

interface IAnthropicOptions {
  config: IConfig
}

export class AnthropicProvider implements IApiProvider {
  private _config: IConfig
  private _client: Anthropic

  public constructor(options: IAnthropicOptions) {
    this._config = options.config
    this._client = new Anthropic({
      apiKey: this.apiKey,
      maxRetries: 8, // Increased from default 2 for testing scenarios
    })
  }

  public async createMessage(
    systemPrompt: string,
    message: string,
  ): Promise<string> {
    const response = await this._client.messages.create({
      model: this._config.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
      max_tokens: 1024,
    })

    return response.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n')
  }

  public get apiKey(): string {
    return process.env.ANTHROPIC_API_KEY ?? ''
  }
}
