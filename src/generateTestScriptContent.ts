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
        case "integer": return 12345;
        case "number": return 123.45;
        case "boolean": return true;
        case "string":
            return property.format === "date"
                ? new Date().toISOString().split("T")[0]
                : property.format === "date-time"
                    ? new Date().toISOString()
                    : "example";
        case "array": return property.items ? [getDefaultValueForType(property.items)] : [];
        default: return "example";
    }
}

function resolveParameters(details: any, swaggerData: any) {
    if (!details?.parameters) {
        return {};
    }

    const pathParams = details.parameters?.filter((param: any) => param.in === "path");
    return pathParams.reduce((acc: any, param: any) => {
        const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
        const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
        acc[param.name] = value;
        return acc;
    }, {});
}

function resolveQueries(details: any, swaggerData: any): any {
    if (!details?.parameters) {
        return {}; // Return an empty object if no query parameters are available
    }
    const queryParams = details.parameters.filter((param: any) => param.in === "query");
    if (!queryParams.length) {
        return {};
    }
    return queryParams.reduce((acc: any, param: any) => {
        const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
        const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
        acc[param.name] = value;
        return acc;
    }, {});
}

function resolveHeaders(details: any, swaggerData: any) {
    if (!details?.parameters) {
        return "";
    }
    const headerParams = details.parameters.filter((param: any) => param.in === "header");
    return headerParams.map((header: any) => {
        const resolvedHeader = resolveSchemaReferences(swaggerData, header.schema || {});
        const value = resolvedHeader.example || getDefaultValueForType(resolvedHeader);
        return `${header.name}: \"${value}\"`;
    })
        .join(", ");
}

function resolveRequestBodyContent(details: any, swaggerData: any): string {
    if (!details.requestBody?.content) {
        return "";
    };
    const contentType = Object.keys(details.requestBody.content)[0];
    const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType]?.schema || {});
    const example = schema.example || buildExampleFromSchema(schema);
    return example ? JSON.stringify(example, null, 8) : "";
}

function resolveResponseExample(details: any) {
    return details.responses?.["200"]?.content
        ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]]?.example
        : undefined;
}

export async function generateContentCypressJavaScript(
    baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
    const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]) => {
      const headers = resolveHeaders(details, swaggerData);
      const pathParams = resolveParameters(details, swaggerData);
      const queryParams = resolveQueries(details, swaggerData);
      const requestBodyContent = resolveRequestBodyContent(details, swaggerData);
      const responseExample = resolveResponseExample(details);
      const allParams = {...pathParams, ...queryParams};
      return `
  it('${method.toUpperCase()}: Should return success', () => {
    cy.request({
      method: '${method.toUpperCase()}',
      url: endPoint,${headers ? `
      headers: { ${headers} },` : ""}${Object.keys(allParams).length > 0 ? `
      qs: ${JSON.stringify(allParams).replace(/"([^"]+)":/g, '$1:')},`: ''}${requestBodyContent && requestBodyContent.length > 0 ? `
      body: ${requestBodyContent},` : ""}
    }).then((response) => {
      expect(response.status).to.eq(200);${responseExample ? `
      expect(response.body).to.deep.equal(${JSON.stringify(responseExample, null, 8)});` : ""}
    });
  });`;
    })
    );

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

export async function generateContentCypressTypeScript(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]) => {
    const headers = resolveHeaders(details, swaggerData);
    const pathParams = resolveParameters(details, swaggerData);
    const queryParams = resolveQueries(details, swaggerData);
    const requestBodyContent = resolveRequestBodyContent(details, swaggerData);
    const responseExample = resolveResponseExample(details);
    const allParams = {...pathParams, ...queryParams};
    return `
  it('${method.toUpperCase()}: Should return success', () => {
    cy.request({
      method: '${method.toUpperCase()}',
      url: endPoint,${headers ? `
      headers: { ${headers} },` : ""}${Object.keys(allParams).length > 0 ? `
      qs: ${JSON.stringify(allParams).replace(/"([^"]+)":/g, '$1:')},`: ''}${requestBodyContent && requestBodyContent.length > 0 ? `
      body: ${requestBodyContent},` : ""}
    }).then((response) => {
      expect(response.status).to.eq(200);${responseExample ? `
      expect(response.body).to.deep.equal(${JSON.stringify(responseExample, null, 8)});` : ""}
    });
  });`;
  })
  );

  return `/// <reference types="Cypress" />
const baseUrl: string = '${baseUrl}';
const pathName: string = '${pathName}';
const pathUrl: string = '${endpointPath.replace(/{.*?}/g, "example")}';
const endPoint: string = \`\${baseUrl}\${pathName}\${pathUrl}\`;

describe('${tagName} ${endpointPath}', () => {
  ${testCases.join("\n")}
});
`;
}

export async function generateContentPlaywrightJavaScript(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]) => {
    const headers = resolveHeaders(details, swaggerData);
    const pathParams = resolveParameters(details, swaggerData);
    const queryParams = resolveQueries(details, swaggerData);
    const requestBodyContent = resolveRequestBodyContent(details, swaggerData);
    const responseExample = resolveResponseExample(details);
    const allParams = { ...pathParams, ...queryParams };
    return `
  test('${method.toUpperCase()}: Should return success', async ({ request }) => {
    const response = await request.${method.toLowerCase()}(\`\${endPoint}\`, {${headers ? `
      headers: { ${headers} },` : ""}${Object.keys(allParams).length > 0 ? `
      params: ${JSON.stringify(allParams).replace(/"([^"]+)":/g, '$1:')},` : ""}${requestBodyContent && requestBodyContent.length > 0 ? `
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

export async function generateContentPlaywrightTypeScript(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]) => {
    const headers = resolveHeaders(details, swaggerData);
    const pathParams = resolveParameters(details, swaggerData);
    const queryParams = resolveQueries(details, swaggerData);
    const requestBodyContent = resolveRequestBodyContent(details, swaggerData);
    const responseExample = resolveResponseExample(details);
    const allParams = { ...pathParams, ...queryParams };
    return `
  test('${method.toUpperCase()}: Should return success', async ({ request }) => {
    const response = await request.${method.toLowerCase()}(\`\${endPoint}\`, {${headers ? `
      headers: { ${headers} },` : ""}${Object.keys(allParams).length > 0 ? `
      params: ${JSON.stringify(allParams).replace(/"([^"]+)":/g, '$1:')},` : ""}${requestBodyContent && requestBodyContent.length > 0 ? `
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

export async function generateContentPlaywrightDotNet(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]: [string, any]) => {
    const headers = resolveHeaders(details, swaggerData);
    const pathParams = resolveParameters(details, swaggerData);
    const queryParams = resolveQueries(details, swaggerData);
    const requestBodyContent = resolveRequestBodyContent(details, swaggerData);
    const responseExample = resolveResponseExample(details);
    const allParams = { ...pathParams, ...queryParams };
    const paramsString = Object.entries(allParams)
      .map(([key, value]) => `${key}={${JSON.stringify(value).replace(/"/g, '')}}`)
      .join("&");


      return `[TestMethod]
  public async Task Test${firstToUppercase(method)}Async() {
    using (var client = new HttpClient()) {
      ${headers.join("\n        ")}
      var url = $"{endPoint}${paramsString ? `?${paramsString}` : ""}";
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

export async function generateContentPlaywrightJava(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]: [string, any]) => {
    const headers = resolveHeaders(details, swaggerData);
    const pathParams = resolveParameters(details, swaggerData);
    const queryParams = resolveQueries(details, swaggerData);
    const requestBodyContent = resolveRequestBodyContent(details, swaggerData);
    const responseExample = resolveResponseExample(details);
    const allParams = { ...pathParams, ...queryParams };
    const paramsString = Object.entries(allParams)
      .map(([key, value]) => `request.addQueryParam("${key}", "${JSON.stringify(value).replace(/"/g, '')}");`)
      .join("\n    ");
    return `  @Test
  public void test${firstToUppercase(method)}() throws Exception {
    HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
      .uri(new URI(endPoint))
    ${paramsString}
    ${headers}
    ;
    HttpRequest request = requestBuilder.method("${method.toUpperCase()}", ${requestBodyContent ? `HttpRequest.BodyPublishers.ofString(
        '${requestBodyContent}')` : "HttpRequest.BodyPublishers.noBody()"})
      .build();

    HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    Assertions.assertEquals(200, response.statusCode());${responseExample ? `
    Assertions.assertEquals("${JSON.stringify(responseExample)}", response.body());` : ""}
  }`;
  }));

  return `package org.example;

import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.Playwright;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;

import java.util.HashMap;
import java.util.Map;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class Test${formatPascalCase(tagName)}Api {
  private final String baseUrl = "${baseUrl}";
  private final String pathName = "${pathName}";
  private final String pathUrl = '${endpointPath.replace(/{.*?}/g, "example")}';
  private final String endPoint = baseUrl+pathName+pathUrl;

  private Playwright playwright;
  private APIRequestContext request;
${testCases.join("\n")}
}`;
}

export async function generateContentPlaywrightPhypton(
  baseUrl: string, pathName: string, endpointPath: string, tagName: string, methods: Record<string, any>, swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]) => {
    const headers = resolveHeaders(details, swaggerData);
    const pathParams = resolveParameters(details, swaggerData);
    const queryParams = resolveQueries(details, swaggerData);
    const requestBodyContent = resolveRequestBodyContent(details, swaggerData);
    const responseExample = resolveResponseExample(details);
    const allParams = { ...pathParams, ...queryParams };
    const paramsString = Object.entries(allParams)
      .map(([key, value]) => `'${key}': ${JSON.stringify(value).replace(/"/g, '')},`)
      .join("\n            ");
    return `
def test_${method.toLowerCase()}_success(playwright):
  with playwright.request.new_context() as context:
    response = context.${method.toLowerCase()}("${baseUrl}${pathName}${endpointPath.replace(/{.*?}/g, "example")}",${headers ? `
      headers={
        ${headers}
      },` : ""}${paramsString ? `
      params={
        ${paramsString}
      },` : ""}${requestBodyContent ? `
      data=${requestBodyContent}` : ""}
    )
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

