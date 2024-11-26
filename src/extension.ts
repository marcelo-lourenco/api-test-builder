import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Função para formatar strings em formato seguro para diretórios
function formatarString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Função para garantir que um diretório exista
function ensureDirectoryExistence(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Função para resolver referências ($ref) no Swagger
function resolveSchemaReferences(swaggerData: any, schema: any): any {
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

    // Resolve $refs aninhados
    return resolveSchemaReferences(swaggerData, resolvedSchema);
  } catch (err: any) {
    console.error("Schema not found for $ref", err.message);
    return {};
  }
}

// Função para construir exemplos com base no schema
function buildExampleFromSchema(schema: any): any {
  const example: any = {};
  for (const propName in schema.properties) {
    const prop = schema.properties[propName];
    example[propName] = prop.example || getDefaultValueForType(prop);
  }
  return example;
}

// Função para obter valores padrão com base no tipo
function getDefaultValueForType(property: any): any {
  switch (property.type) {
    case "integer":
      return 123;
    case "number":
      return 123.45;
    case "boolean":
      return true;
    case "string":
      return "example string";
    case "array":
      return property.items ? [getDefaultValueForType(property.items)] : [];
    default:
      return "example";
  }
}

// Função para gerar o conteúdo do teste para Playwright e Cypress
export async function generateTestContent(
  baseUrl: string,
  pathName: string,
  endpointPath: string,
  tagName: string,
  methods: Record<string, any>,
  swaggerData: any,
  testFramework: 'playwright' | 'cypress'
): Promise<string> {

  const urlVariables = `
const baseUrl = '${baseUrl}';
const pathName = '${pathName}';
const pathUrl  = '${endpointPath.replace(/{.*?}/g, "example")}';
const endPoint = \`\${baseUrl}\${pathName}\${pathUrl}\`;
`;

  const testCases = await Promise.all(
    Object.entries(methods).map(async ([method, details]: [string, any]) => {
      const methodUpperCase = method.toUpperCase();
      const methodLowerCase = method.toLowerCase();

      const parameters = details.parameters
        ? details.parameters
          .map((param: any) => {
            const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
            const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
            return `${param.name}: ${JSON.stringify(value)}`;
          })
          .join(", ")
        : "";

      let requestBodyContent = "";
      if (details.requestBody && details.requestBody.content) {
        const contentType = Object.keys(details.requestBody.content)[0];
        const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType].schema || {});
        const example = schema.example || buildExampleFromSchema(schema);

        requestBodyContent = example ? `${JSON.stringify(example, null, 2)}` : "";
      }

      const responseExample =
        details.responses &&
          details.responses["200"] &&
          details.responses["200"].content
          ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]].example
          : undefined;

      if (testFramework === 'playwright') {
        return `test('${methodUpperCase}: Should return success', async ({ request }) => {
          const response = await request.${methodLowerCase}(\`\${endPoint}\`, {
            params: { ${parameters} }${requestBodyContent ? `, data: ${requestBodyContent}` : ""}
          });
          expect(response.status()).toBe(200);
          ${responseExample ? `expect(await response.json()).toEqual(${JSON.stringify(responseExample, null, 2)});` : ""}
        });`;
      }

      else if (testFramework === 'cypress') {
        return `it('${methodUpperCase}: Should return success', () => {
          cy.${methodLowerCase}(\`\${endPoint}\`, {
            params: { ${parameters} }${requestBodyContent ? `, body: ${requestBodyContent}` : ""}
          }).then((response) => {
            expect(response.status).to.eq(200);
            ${responseExample ? `expect(response.body).to.deep.equal(${JSON.stringify(responseExample, null, 2)});` : ""}
          });
        });`;
      }

      return '';
    })
  );

  if (testFramework === 'playwright') {
    return `import { expect, test } from '@playwright/test';
${urlVariables}
test.describe('${tagName} ${endpointPath}', () => {
	${testCases.join("\n")}
});
`;

  }

  else if (testFramework === 'cypress') {
    return `/// <reference types="Cypress" />
${urlVariables}
describe('${tagName} ${endpointPath}', () => {
  ${testCases.join("\n")}
});
`;

  }

return '';
}

// Função principal de ativação da extensão
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "api-test-builder" is now active!');

  // Comandos para Swagger
  const disposableSwaggerPlaywright = vscode.commands.registerCommand("apiTestScript.genSwaggerToPlaywright", async (uri: vscode.Uri) => {
    const swaggerFilePath = uri.fsPath;
    try {
      const data = await fs.promises.readFile(swaggerFilePath, "utf-8");
      const swaggerData = JSON.parse(data);

      const url = new URL(swaggerData.servers[0].url);
      const baseUrl = `${url.protocol}//${url.host}`;
      const pathName = url.pathname;

      const jsonDir = path.dirname(swaggerFilePath);
      const rootDir = path.join(jsonDir, formatarString(swaggerData.info.title));

      ensureDirectoryExistence(rootDir);

      for (const [endpointPath, methods] of Object.entries(swaggerData.paths)) {
        const tagName = (Object.values(methods as Record<string, any>)[0]?.tags?.[0]) || "untagged";
        const dirPath = path.join(rootDir, formatarString(tagName));
        const fileName = path.join(dirPath, `${endpointPath.replace(/^\/|\/$/g, "").replace(/\//g, "_")}.test.ts`);

        ensureDirectoryExistence(dirPath);

        const testContent = await generateTestContent(baseUrl, pathName, endpointPath, tagName, methods as any, swaggerData, 'playwright');

        console.log(`Generating file in: ${fileName}`);
        await fs.promises.writeFile(fileName, testContent, "utf-8");
        vscode.window.showInformationMessage(`Generated file: ${fileName}`);
      }
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message || "Unknown error";
      vscode.window.showErrorMessage(`Error processing Swagger: ${errorMessage}`);
    }
  });

  const disposableSwaggerCypress = vscode.commands.registerCommand("apiTestScript.genSwaggerToCypress", async (uri: vscode.Uri) => {
    const swaggerFilePath = uri.fsPath;
    try {
      const data = await fs.promises.readFile(swaggerFilePath, "utf-8");
      const swaggerData = JSON.parse(data);

      const url = new URL(swaggerData.servers[0].url);
      const baseUrl = `${url.protocol}//${url.host}`;
      const pathName = url.pathname;

      const jsonDir = path.dirname(swaggerFilePath);
      const rootDir = path.join(jsonDir, formatarString(swaggerData.info.title));

      ensureDirectoryExistence(rootDir);

      for (const [endpointPath, methods] of Object.entries(swaggerData.paths)) {
        const tagName = (Object.values(methods as Record<string, any>)[0]?.tags?.[0]) || "untagged";
        const dirPath = path.join(rootDir, formatarString(tagName));
        const fileName = path.join(dirPath, `${endpointPath.replace(/^\/|\/$/g, "").replace(/\//g, "_")}.cy.js`);

        ensureDirectoryExistence(dirPath);

        const testContent = await generateTestContent(baseUrl, pathName, endpointPath, tagName, methods as any, swaggerData, 'cypress');

        console.log(`Generating file in: ${fileName}`);
        await fs.promises.writeFile(fileName, testContent, "utf-8");
        vscode.window.showInformationMessage(`Generated file: ${fileName}`);
      }
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message || "Unknown error";
      vscode.window.showErrorMessage(`Error processing Swagger: ${errorMessage}`);
    }
  });

  // Comandos para Postman
  const disposablePostmanPlaywright = vscode.commands.registerCommand("apiTestScript.genPostmanToPlaywright", async (uri: vscode.Uri) => {
    const postmanFilePath = uri.fsPath;
    try {
      const data = await fs.promises.readFile(postmanFilePath, "utf-8");
      const postmanData = JSON.parse(data);

      const baseUrl = postmanData.info.baseUrl;

      const jsonDir = path.dirname(postmanFilePath);
      const rootDir = path.join(jsonDir, formatarString(postmanData.info.name));

      ensureDirectoryExistence(rootDir);

      for (const item of postmanData.item) {
        const endpointPath = item.request.url.path.join('/');
        const methods = { [item.request.method.toLowerCase()]: item.request };

        const tagName = "untagged";  // Placeholder for simplicity
        const dirPath = path.join(rootDir, formatarString(tagName));
        const fileName = path.join(dirPath, `${endpointPath.replace(/^\/|\/$/g, "").replace(/\//g, "_")}.test.ts`);

        ensureDirectoryExistence(dirPath);

        const testContent = await generateTestContent(baseUrl, '', endpointPath, tagName, methods as any, postmanData, 'playwright');

        console.log(`Generating file in: ${fileName}`);
        await fs.promises.writeFile(fileName, testContent, "utf-8");
        vscode.window.showInformationMessage(`Generated file: ${fileName}`);
      }
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message || "Unknown error";
      vscode.window.showErrorMessage(`Error processing Postman: ${errorMessage}`);
    }
  });

  const disposablePostmanCypress = vscode.commands.registerCommand("apiTestScript.genPostmanToCypress", async (uri: vscode.Uri) => {
    const postmanFilePath = uri.fsPath;
    try {
      const data = await fs.promises.readFile(postmanFilePath, "utf-8");
      const postmanData = JSON.parse(data);

      const baseUrl = postmanData.info.baseUrl;

      const jsonDir = path.dirname(postmanFilePath);
      const rootDir = path.join(jsonDir, formatarString(postmanData.info.name));

      ensureDirectoryExistence(rootDir);

      for (const item of postmanData.item) {
        const endpointPath = item.request.url.path.join('/');
        const methods = { [item.request.method.toLowerCase()]: item.request };

        const tagName = "untagged";  // Placeholder for simplicity
        const dirPath = path.join(rootDir, formatarString(tagName));
        const fileName = path.join(dirPath, `${endpointPath.replace(/^\/|\/$/g, "").replace(/\//g, "_")}.cy.js`);

        ensureDirectoryExistence(dirPath);

        const testContent = await generateTestContent(baseUrl, '', endpointPath, tagName, methods as any, postmanData, 'cypress');

        console.log(`Generating file in: ${fileName}`);
        await fs.promises.writeFile(fileName, testContent, "utf-8");
        vscode.window.showInformationMessage(`Generated file: ${fileName}`);
      }
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message || "Unknown error";
      vscode.window.showErrorMessage(`Error processing Postman: ${errorMessage}`);
    }
  });

  context.subscriptions.push(disposableSwaggerPlaywright, disposableSwaggerCypress, disposablePostmanPlaywright, disposablePostmanCypress);
}

export function deactivate() {}
