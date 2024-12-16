import * as assert from 'assert';
import * as vscode from 'vscode';
import { extractSwaggerData } from '../extractDataSwagger';

suite('extractSwaggerData Tests', () => {
  test('Swagger 2.0 - Basic', () => {
    const swaggerData = {
      swagger: "2.0",
      schemes: ["https", "http"],
      host: "example.com",
      basePath: "/api",
      paths: { "/test": {} },
      info: { title: "Swagger API", version: "1.0.0" },
    };

    const result = extractSwaggerData(swaggerData);
    assert.strictEqual(result.baseUrl, "https://example.com");
    assert.strictEqual(result.pathName, "/api");
    assert.deepStrictEqual(result.paths, { "/test": {} });
    assert.deepStrictEqual(result.info, { title: "Swagger API", version: "1.0.0" });
  });

  test('OpenAPI 3.0 - With servers', () => {
    const openApiData = {
      openapi: "3.0.0",
      servers: [{ url: "https://example.com/api" }],
      paths: { "/test": {} },
      info: { title: "OpenAPI", version: "1.0.0" },
    };

    const result = extractSwaggerData(openApiData);
    assert.strictEqual(result.baseUrl, "https://example.com");
    assert.strictEqual(result.pathName, "/api");
    assert.deepStrictEqual(result.paths, { "/test": {} });
    assert.deepStrictEqual(result.info, { title: "OpenAPI", version: "1.0.0" });
  });

  test('OpenAPI 3.0 - With variables', () => {
    const openApiData = {
      openapi: "3.0.0",
      servers: [{
        url: "https://{subdomain}.example.com/api",
        variables: {
          subdomain: { default: "api" },
        },
      }],
      paths: { "/test": {} },
      info: { title: "OpenAPI", version: "1.0.0" },
    };

    const result = extractSwaggerData(openApiData);
    assert.strictEqual(result.baseUrl, "https://api.example.com");
    assert.strictEqual(result.pathName, "/api");
    assert.deepStrictEqual(result.paths, { "/test": {} });
    assert.deepStrictEqual(result.info, { title: "OpenAPI", version: "1.0.0" });
  });

  test('Swagger 2.0 - Missing host', () => {
    const swaggerData = {
      swagger: "2.0",
      schemes: ["http"],
      paths: { "/test": {} },
      info: { title: "Swagger API", version: "1.0.0" },
    };

    const result = extractSwaggerData(swaggerData);
    assert.strictEqual(result.baseUrl, "http://localhost");
    assert.strictEqual(result.pathName, "/");
    assert.deepStrictEqual(result.paths, { "/test": {} });
    assert.deepStrictEqual(result.info, { title: "Swagger API", version: "1.0.0" });
  });

  test('Unsupported version', () => {
    const unsupportedData = { swagger: "1.0" };
    assert.throws(() => extractSwaggerData(unsupportedData), /Unsupported Swagger\/OpenAPI version/);
  });
});
