import { IApiProvider, IConfig } from './provider'
import { OpenAiProvider } from './openai'
import { GeminiProvider } from './gemini'
import { AnthropicProvider } from './anthropic'
import { DeepseekProvider } from './deepseek'

export type ProviderConstructor = new (options: {
  config: IConfig
}) => IApiProvider

class ProviderRegistry {
  private static _instance: ProviderRegistry
  private _providers: Map<string, ProviderConstructor> = new Map()

  private constructor() {
    // Register built-in providers
    this.register('openai', OpenAiProvider)
    this.register('gemini', GeminiProvider)
    this.register('anthropic', AnthropicProvider)
    this.register('deepseek', DeepseekProvider)
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry._instance) {
      ProviderRegistry._instance = new ProviderRegistry()
    }
    return ProviderRegistry._instance
  }

  /**
   * Register a provider
   * @param name Provider name
   * @param providerClass Provider class
   */
  public register(name: string, providerClass: ProviderConstructor): void {
    this._providers.set(name, providerClass)
  }

  /**
   * Unregister a provider
   * @param name Provider name
   */
  public unregister(name: string): boolean {
    return this._providers.delete(name)
  }

  /**
   * Check if a provider is registered
   * @param name Provider name
   */
  public has(name: string): boolean {
    return this._providers.has(name)
  }

  /**
   * Create a provider instance
   * @param name Provider name
   * @param model Model name
   */
  public create(name: string, model: string): IApiProvider {
    const ProviderClass = this._providers.get(name)

    if (!ProviderClass) {
      throw new Error(`Provider not registered: ${name}`)
    }

    return new ProviderClass({ config: { model } })
  }

  /**
   * Get all registered provider names
   */
  public getProviderNames(): string[] {
    return Array.from(this._providers.keys())
  }
}

/**
 * Register a provider
 * @param name Provider name
 * @param providerClass Provider class
 */
export function registerProvider(
  name: string,
  providerClass: ProviderConstructor,
): void {
  ProviderRegistry.getInstance().register(name, providerClass)
}

/**
 * Get a provider instance
 * @param name Provider name
 * @param model Model name
 */
export function createProvider(name: string, model: string): IApiProvider {
  return ProviderRegistry.getInstance().create(name, model)
}

/**
 * Check if a provider is registered
 * @param name Provider name
 */
export function hasProvider(name: string): boolean {
  return ProviderRegistry.getInstance().has(name)
}

/**
 * Get all registered provider names
 */
export function getProviderNames(): string[] {
  return ProviderRegistry.getInstance().getProviderNames()
}

export const providerRegistry: ProviderRegistry = ProviderRegistry.getInstance()
