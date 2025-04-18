declare namespace NodeJS {
  interface ProcessEnv {
    OPENAI_API_KEY: string | undefined
    GEMINI_API_KEY: string | undefined
    ANTHROPIC_API_KEY: string | undefined
    DEEPSEEK_API_KEY: string | undefined
  }
}
