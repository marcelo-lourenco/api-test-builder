
# API Test Builder - VS Code Extension

## API Test Script Generator

Automatically generate API Test Scripts for **Playwright** and **Cypress** from Swagger Documentation.

## Usage

1. Open the JSON file (Swagger Documentation) in VS Code;
2. **Right-click** anywhere in the code editor;
3. Click the **API Test Builder** menu;
4. Click the desired option;
    - **Swagger to Playwright**
    - **Swagger to Cypress**
    - **Postman to Playwright**
    - **Postman to Cypress**
5. *Voilà*! The extension will generate the directories and tests scripts templates.

## Features

- **Generates tests**: Creates test scripts based on the source specification (Swagger/OpenAPI)
- **Organizes tests by tag**: Groups generated tests into folders based on the tags defined in your source file
- **Handles multiple HTTP methods**: Supports GET, POST, PUT, DELETE, and other HTTP methods defined in your source file.
- **Resolves schema references ($ref)**: Correctly handles references within your schema definitions.
- **Generates sample requests**: Creates sample request bodies based on your schema definitions.
- **Includes basic response assertions**: Adds expect statements to check the response status code.
- **Clean file structure**: Creates a well-organized directory structure for your tests, making them easy to manage.

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

[Code of Condut](https://github.com/marcelo-lourenco/api-test-builder?tab=coc-ov-file#readme) • [License MIT](https://github.com/marcelo-lourenco/api-test-builder?tab=MIT-1-ov-file#readme) • [Security](https://github.com/marcelo-lourenco/api-test-builder/security) • [Changelog](https://github.com/marcelo-lourenco/api-test-builder/blob/master/CHANGELOG.md) • [Discussions](https://github.com/marcelo-lourenco/api-test-builder/discussions)
