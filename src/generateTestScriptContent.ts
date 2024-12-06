import { firstToUppercase, formatPascalCase } from "./util";

// Function to resolve references ($ref) in Swagger
export function resolveSchemaReferences(swaggerData: any, schema: any): any {
  if (!schema || !schema.$ref) {
    return schema;
  }

  try {
    const refParts = schema.$ref.split('/');
    let resolvedSchema: any = swaggerData;
    refParts.slice(1).forEach((part: string) => {
      resolvedSchema = resolvedSchema[part];
      if (!resolvedSchema) {
        throw new Error(`Schema not found for $ref: ${schema.$ref}`);
      }
    });

    // Resolve nested $refs
    return resolveSchemaReferences(swaggerData, resolvedSchema);
  } catch (err: any) {
    console.error("Schema not found for $ref", err.message);
    return {};
  }
}
// Function to build examples based on the schema
export function buildExampleFromSchema(schema: any): any {
  const example: any = {};
  for (const propName in schema.properties) {
    const prop = schema.properties[propName];
    example[propName] = prop.example || getDefaultValueForType(prop);
  }
  return example;
}

// Function to get default values based on type
export function getDefaultValueForType(property: any): any {
  switch (property.type) {
    case "integer":
      return 12345;
    case "number":
      return 123.45;
    case "boolean":
      return true;
    case "string":
      if (property.format && property.format === 'date') {
        return new Date().toISOString().split('T')[0];
      } else if (property.format && property.format === 'date-time') {
        return new Date().toISOString();
      }
      return "example";
    case "array":
      return property.items ? [getDefaultValueForType(property.items)] : [];
    default:
      return "example";
  }
}

// Function to generate Cypress test content
export async function generateTestScriptContentCypressJavaScript(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]: [string, any]) => {
    const parametersObject = (details.parameters || []).reduce((acc: Record<string, any>, param: any) => {
      acc[param.name] = param.value || '';
      return acc;
    }, {});
    const parameters = JSON.stringify(parametersObject, null, 8);

    // Handle request body
    let requestBodyContent = "";
    if (details.requestBody && details.requestBody.content) {
      const contentType = Object.keys(details.requestBody.content)[0];
      const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType].schema || {});
      const example = schema.example || buildExampleFromSchema(schema);

      requestBodyContent = example ? `${JSON.stringify(example, null, 8)}` : "";
    }

    // Handle response example
    const responseExample = details.responses && details.responses["200"] && details.responses["200"].content
      ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]].example
      : undefined;

    return `
  it('${method.toUpperCase()}: Should return success', () => {
    cy.${method.toLowerCase()}(\`\${endPoint}\`, {
      qs: ${parameters}${requestBodyContent ? `,
      body: ${requestBodyContent}` : ""}
    }).then((response) => {
      expect(response.status).to.eq(200);${responseExample ? `
      expect(response.body).to.deep.equal(${JSON.stringify(responseExample, null, 2)});` : ""}
    });
  });`;
  }));

  return `/// <reference types="Cypress" />
const baseUrl = '${baseUrl}';
const pathName = '${pathName}';
const pathUrl = '${endpointPath.replace(/{.*?}/g, "example")}';
const endPoint = \`\${baseUrl}\${pathName}\${pathUrl}\`;
describe('${tagName} ${endpointPath}', () => {
  ${testCases.join("\n")}
});
`;
}

// Function to generate Cypress test content
export async function generateTestScriptContentCypressTypeScript(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]: [string, any]) => {
    const parametersObject = (details.parameters || []).reduce((acc: Record<string, any>, param: any) => {
      acc[param.name] = param.value || '';
      return acc;
    }, {});
    const parameters = JSON.stringify(parametersObject, null, 8);

    // Handle request body
    let requestBodyContent = "";
    if (details.requestBody && details.requestBody.content) {
      const contentType = Object.keys(details.requestBody.content)[0];
      const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType].schema || {});
      const example = schema.example || buildExampleFromSchema(schema);

      requestBodyContent = example ? `${JSON.stringify(example, null, 8)}` : "";
    }

    // Handle response example
    const responseExample = details.responses && details.responses["200"] && details.responses["200"].content
      ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]].example
      : undefined;

    return `
  it('${method.toUpperCase()}: Should return success', () => {
    cy.${method.toLowerCase()}(\`\${endPoint}\`, {
      qs: ${parameters}${requestBodyContent ? `,
      body: ${requestBodyContent}` : ""}
    }).then((response) => {
      expect(response.status).to.eq(200);${responseExample ? `
      expect(response.body).to.deep.equal(${JSON.stringify(responseExample, null, 2)});` : ""}
    });
  });`;
  }));

  return `/// <reference types="Cypress" />
const baseUrl: string = '${baseUrl}';
const pathName: string = '${pathName}';
const pathUrl: string = '${endpointPath.replace(/{.*?}/g, 'example')}';
const endPoint: string = \`\${baseUrl}\${pathName}\${pathUrl}\`;
describe('${tagName} ${endpointPath}', () => {
  ${testCases.join("\n")}
});
`;
}

// Function to generate JavaScript test content for Playwright
export async function generateTestScriptContentPlaywrightJavaScript(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]) => {
    const parameters = details.parameters?.map((param: any) => {
      const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
      const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
      return `${param.name}: ${JSON.stringify(value)}`;
    }).join(", ") || "";

    let requestBodyContent = "";
    if (details.requestBody?.content) {
      const contentType = Object.keys(details.requestBody.content)[0];
      const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType]?.schema || {});
      const example = schema.example || buildExampleFromSchema(schema);

      requestBodyContent = example ? `${JSON.stringify(example, null, 8)}` : "";
    }

    const responseExample = details.responses?.["200"]?.content
      ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]]?.example
      : undefined;

    return `
  test('${method.toUpperCase()}: Should return success', async ({ request }) => {
    const response = await request.${method.toLowerCase()}(\`\${endPoint}\`, {
      params: { ${parameters} }${requestBodyContent ? `,
      data: ${requestBodyContent}` : ""}
    });
    expect(response.status()).toBe(200);${responseExample ? `
    expect(await response.json()).toEqual(${JSON.stringify(responseExample, null, 2)});` : ""}
  });`;
  }));

  return `import { test, expect } from '@playwright/test';
const baseUrl = '${baseUrl}';
const pathName = '${pathName}';
const pathUrl = '${endpointPath.replace(/{.*?}/g, "example")}';
const endPoint = \`\${baseUrl}\${pathName}\${pathUrl}\`;

test.describe('${tagName} ${endpointPath}', () => {${testCases.join("\n")}
});
`;
}

// Function to generate TypeScript test content for Playwright
export async function generateTestScriptContentPlaywrightTypeScript(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(
    Object.entries(methods).map(async ([method, details]) => {
      const parameters = details.parameters
        ?.map((param: any) => {
          const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
          const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
          return `${param.name}: ${JSON.stringify(value)}`;
        })
        .join(", ") || "";

      let requestBodyContent = "";
      if (details.requestBody?.content) {
        const contentType = Object.keys(details.requestBody.content)[0];
        const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType]?.schema || {});
        const example = schema.example || buildExampleFromSchema(schema);

        requestBodyContent = example ? JSON.stringify(example, null, 8) : "";
      }

      const responseExample = details.responses?.["200"]?.content
        ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]]?.example
        : undefined;

      return `
  test('${method.toUpperCase()}: Should return success', async ({ request }) => {
    const response = await request.${method.toLowerCase()}(\`\${endPoint}\`, {
      params: { ${parameters} }${requestBodyContent ? `,
      data: ${requestBodyContent}` : ""
        }
    });
    expect(response.status()).toBe(200);${responseExample ? `
    expect(await response.json()).toEqual(${JSON.stringify(responseExample, null, 2)});` : ""
        }
  });`;
    })
  );

  return `import { test, expect } from '@playwright/test';
const baseUrl = '${baseUrl}';
const pathName = '${pathName}';
const pathUrl = '${endpointPath.replace(/{.*?}/g, "example")}';
const endPoint = \`\${baseUrl}\${pathName}\${pathUrl}\`;

test.describe('${tagName} ${endpointPath}', () => {${testCases.join("\n")}
});
`;
}

// Function to generate .Net test content for Playwright
export async function generateTestScriptContentPlaywrightDotNet(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]: [string, any]) => {
    const parameters = details.parameters ? details.parameters.map((param: any) => {
      const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
      const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
      return `${param.name}={${value}}`;
    }).join("&") : "";

    // Handling Request Body
    let requestBodyContent = "";
    if (details.requestBody && details.requestBody.content) {
      const contentType = Object.keys(details.requestBody.content)[0];
      const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType].schema || {});
      const example = schema.example || buildExampleFromSchema(schema);

      requestBodyContent = example ? JSON.stringify(example, null, 8) : "";
    }

    // Handling Response Example
    const responseExample = details.responses && details.responses["200"] && details.responses["200"].content
      ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]].example
      : undefined;

    return `[TestMethod]
  public async Task Test${firstToUppercase(method)}Async() {
    using (var client = new HttpClient()) {
      var url = $"{endPoint}${parameters ? `?${parameters}` : ""}";
      var content = new StringContent(${requestBodyContent ? `"${requestBodyContent}"` : "null"}, Encoding.UTF8, "application/json");
      var response = await client.${firstToUppercase(method)}Async(url, ${requestBodyContent ? "content" : "null"});
      Assert.AreEqual(200, (int)response.StatusCode);${responseExample ? `
      var responseBody = await response.Content.ReadAsStringAsync();
      Assert.AreEqual("${JSON.stringify(responseExample)}", responseBody);` : ""}
    }
  }`;
  }));

  return `using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class Test${formatPascalCase(tagName)} {
  private readonly string baseUrl = "${baseUrl}";
  private readonly string pathName = "${pathName}";
  private readonly string pathUrl = "${endpointPath.replace(/{.*?}/g, 'example')}";
  private readonly string endPoint;

  public Test${formatPascalCase(tagName)}() {
    endPoint = \$"{baseUrl}{pathName}{pathUrl}";
  }
  ${testCases.join("\n")}
}`;
}

// Function to generate Java test content for Playwright
export async function generateTestScriptContentPlaywrightJava(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]: [string, any]) => {

    // Handling Parameters
    const parameters = details.parameters ? details.parameters.map((param: any) => {
      const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
      const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
      return `request.addQueryParam("${param.name}", "${value}");`;
    }).join("\n    ") : "";

    // Handling Request Body
    let requestBodyContent = "";
    if (details.requestBody && details.requestBody.content) {
      const contentType = Object.keys(details.requestBody.content)[0];
      const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType].schema || {});
      const example = schema.example || buildExampleFromSchema(schema);

      requestBodyContent = example ? JSON.stringify(example, null, 8) : "";
    }

    // Handling Response Example
    const responseExample = details.responses && details.responses["200"] && details.responses["200"].content
      ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]].example
      : undefined;

    return `@Test
  public void test${method.toUpperCase()}() throws Exception {
    HttpRequest request = HttpRequest.newBuilder()
      .uri(new URI(endPoint))
      .method("${method.toUpperCase()}", ${requestBodyContent ? `HttpRequest.BodyPublishers.ofString(
        '${requestBodyContent}')` : "HttpRequest.BodyPublishers.noBody()"})
      .build();

    HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    Assertions.assertEquals(200, response.statusCode());${responseExample ? `
    Assertions.assertEquals("${JSON.stringify(responseExample)}", response.body());` : ""}
  }`;
  }));

  return `package org.example;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.RequestOptions;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class Test${formatPascalCase(tagName)} {
  private final String baseUrl = "${baseUrl}";
  private final String pathName = "${pathName}";
  private final String pathUrl = '${endpointPath.replace(/{.*?}/g, "example")}';
  private final String endPoint = baseUrl+pathName+pathUrl;

  private Playwright playwright;
  private APIRequestContext request;

  ${testCases.join("\n")}
}`;
}

// Function to generate Python test content for Playwright
export async function generateTestScriptContentPlaywrightPhypton(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]) => {
    const parameters = details.parameters?.map((param: any) => {
      const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
      const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
      return `'${param.name}': ${JSON.stringify(value)}`;
    }).join(", ") || "";

    let requestBodyContent = "";
    if (details.requestBody?.content) {
      const contentType = Object.keys(details.requestBody.content)[0];
      const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType]?.schema || {});
      const example = schema.example || buildExampleFromSchema(schema);

      requestBodyContent = example ? `${JSON.stringify(example, null, 8)}` : "";
    }

    const responseExample = details.responses?.["200"]?.content
      ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]]?.example
      : undefined;

    return `
def test_${method.toLowerCase()}_success(playwright):
    with playwright.request.new_context() as context:
        response = context.${method.toLowerCase()}("${baseUrl}${endpointPath.replace(/{.*?}/g, "example")}", json={
            ${parameters}${requestBodyContent ? `,
            "body": ${requestBodyContent}` : ""}
        })
        assert response.status == 200${responseExample ? `
        assert response.json() == ${JSON.stringify(responseExample, null, 2)}` : ""}
`;
  }));

  return `# Playwright Python Tests
import pytest
from playwright.sync_api import sync_playwright

@pytest.fixture(scope="module")
def playwright():
    with sync_playwright() as p:
        yield p
${testCases.join("\n")}
`;
}

