# Initialize Project

```bash
npx mcp-testing-framework@latest init [target directory] --example getting-started
```

This command will create a basic MCP test project structure, including sample configuration files and test cases.

# Run Evaluation Tests

Before running tests, make sure you have an OpenAI API key. You can apply for one from the [OpenAI Developer Platform](https://platform.openai.com/docs/overview) and configure it in the `.env` file in your project:

```
OPENAI_API_KEY=sk-...
```

You can also run the command directly, but the test will not succeed.

Run the test command:

```bash
npx mcp-testing-framework@latest evaluate
```

This command will execute test cases according to the configuration file and generate a test report in the `mcp-report` directory.
