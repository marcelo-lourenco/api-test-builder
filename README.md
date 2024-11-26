# API Test Script Generator

This Visual Studio Code extension automatically generates Playwright test files from a Swagger (OpenAPI) specification. It simplifies the process of creating end-to-end API tests by parsing your Swagger file and creating ready-to-run Playwright tests for each endpoint.

## Features

- **Generates Playwright tests**: Creates test files based on your Swagger/OpenAPI definition.
- Organizes tests by tag: Groups generated tests into folders based on the tags defined in your Swagger file. Untagged endpoints are placed in a folder named untagged.
- **Handles various HTTP methods**: Supports GET, POST, PUT, DELETE, and other HTTP methods defined in your Swagger file.
- **Resolves schema references ($ref)**: Correctly handles references within your Swagger schema definitions.
- **Generates example requests**: Creates example request bodies based on the schema definitions.
- **Includes basic response assertions**: Adds expect statements to verify the response status code. If a response example is provided in the Swagger, it will be used in an assertion as well.
- **Clear file structure**: Creates a well-organized directory structure for your tests, making them easy to manage.

## Requirements

- Visual Studio Code: This extension is designed for VS Code.
- Node.js and npm: Required for installing the extension and running Playwright.
- Playwright: You'll need to have Playwright installed in your project.

## Installation

- Open Visual Studio Code.
- Go to the Extensions Marketplace (Ctrl+Shift+X or Cmd+Shift+X).
- Search for "API Test Builder".
- Click "Install".

## Usage

1. Open a Swagger (JSON or YAML) file in VS Code.
2. Right-click on the file in the explorer.
3. Select "Generate Playwright Tests" from the context menu.
4. The extension will generate Playwright test files in a directory next to your Swagger file, named after the title of your API in the Swagger.

## Configuration

Currently, there are no specific configuration options for this extension.

## Example

Let's say your swagger.json file defines an endpoint like this:

```json
{
  "paths": {
    "/users": {
      "get": {
        "tags": ["Users"],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  }
}
```

The extension will generate a test file named users.test.ts (or similar) inside a users directory (because of the tag "Users"), containing a Playwright test like this:

```javascript
import { expect, test } from '@playwright/test';

// ... (constants for baseUrl, pathName, etc.)

test.describe('Users /users', () => {
  test('GET: Should return success', async ({ request }) => {
    const response = await request.get(`${endPoint}`);
    expect(response.status()).toBe(200);
  });
});
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT

---

[Código de Conduta](https://github.com/marcelo-lourenco/api-test-builder?tab=coc-ov-file#readme) • [Licença MIT](https://github.com/marcelo-lourenco/api-test-builder?tab=MIT-1-ov-file#readme) • [Segurança](https://github.com/marcelo-lourenco/api-test-builder/security) • [Changelog](https://github.com/marcelo-lourenco/api-test-builder/blob/master/CHANGELOG.md) • [Fórum](https://github.com/marcelo-lourenco/api-test-builder/discussions)
