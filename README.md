
# API Test Builder - VS Code Extension

## API Test Script Generator

Automatically generate API Test Scripts for **Playwright** and **Cypress** from **Swagger Documentation**.

## Supports:

- OpenAPI 3.0 version
- Swagger 2.0 version

## Usage

1. Open the **Swagger Documentation** (JSON file) in VS Code;
2. **Right-click** anywhere in the code editor;
3. Click the **API Test Builder** menu;
4. Click the desired option;
    - **Swagger to Cypress (JavaScript)**
    - **Swagger to Playwright (JavaScript)**
    - **Swagger to Playwright (Java)**  \*beta
    - **Swagger to Playwright (Python)** \*beta
    - **Swagger to Playwright (.Net)** \*beta
5. *Voilà*! The extension will generate the directories and test script templates.
All you need to do is adjust the indentation and add the test scenarios you want/need.

> **Beta version*
> - Java - requires proper definition of "import"
> - .Net - requires proper definition of "using"
> - Python - requires proper definition of "import"
> - all - requires proper indentation

**Help us improve. [Report a Issue](https://github.com/marcelo-lourenco/api-test-builder/issues).**

## Try the Extension
Want to try the extension but don't have a Swagger documentation file?
You can use the Swagger Petstore examples:

 - For [Swagger Petstore 2.0](https://petstore.swagger.io/) use .json file: [https://petstore.swagger.io/v2/swagger.json](https://petstore.swagger.io/v2/swagger.json)
 - For [Swagger Petstore 3.0](https://petstore3.swagger.io/) use .json file: [https://petstore3.swagger.io/api/v3/openapi.json](https://petstore3.swagger.io/api/v3/openapi.json)

## Features

- **Generates tests**: Creates test scripts based on the source specification (Swagger/OpenAPI)
- **Organizes tests by tag**: Groups generated tests into folders based on the tags defined in your source file
- **Handles multiple HTTP methods**: Supports GET, POST, PUT, DELETE, and other HTTP methods defined in your source file.
- **Resolves schema references ($ref)**: Correctly handles references within your schema definitions.
- **Generates sample requests**: Creates sample request bodies based on your schema definitions.
- **Includes basic response assertions**: Adds expect statements to check the response status code.
- **Clean file structure**: Creates a well-organized directory structure for your tests, making them easy to manage.

## Motivate us

If this is what you were looking for, please consider giving us a [5-star rating](https://marketplace.visualstudio.com/items?itemName=mlourenco.api-test-builder&ssr=false#review-details).

We love suggestions. [Leave yours](https://github.com/marcelo-lourenco/api-test-builder/discussions/categories/ideas).

## Contributing

Contributions are welcome! Please feel free to submit [issues](https://github.com/marcelo-lourenco/api-test-builder/issues) and [pull requests](https://github.com/marcelo-lourenco/api-test-builder/fork).

## Resources and Information

[Code of Condut](https://github.com/marcelo-lourenco/api-test-builder?tab=coc-ov-file#readme) • [License MIT](https://github.com/marcelo-lourenco/api-test-builder?tab=MIT-1-ov-file#readme) • [Security](https://github.com/marcelo-lourenco/api-test-builder/security) • [Changelog](https://github.com/marcelo-lourenco/api-test-builder/blob/master/CHANGELOG.md) • [Discussions](https://github.com/marcelo-lourenco/api-test-builder/discussions)

