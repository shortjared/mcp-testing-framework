class MyCustomProvider {
  constructor(options) {
    this._config = options.config
  }

  async createMessage(systemPrompt, message) {
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

  get apiUrl() {
    return 'https://api.mycustomprovider.com/v1'
  }

  get apiKey() {
    return process.env.MY_CUSTOM_API_KEY || ''
  }
}

module.exports = { MyCustomProvider }
