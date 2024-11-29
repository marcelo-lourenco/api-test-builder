import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Function to format strings in safe format for directories
export function formatarString(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "-");
}
// Function to convert the first letter to uppercase
export function firstToUppercase(framework: string) {
  return framework.charAt(0).toUpperCase() + framework.slice(1);
}

// Function to resolve references ($ref) in Swagger
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

    // Resolve nested $refs
    return resolveSchemaReferences(swaggerData, resolvedSchema);
  } catch (err: any) {
    console.error("Schema not found for $ref", err.message);
    return {};
  }
}

// Function to build examples based on the schema
function buildExampleFromSchema(schema: any): any {
  const example: any = {};
  for (const propName in schema.properties) {
    const prop = schema.properties[propName];
    example[propName] = prop.example || getDefaultValueForType(prop);
  }
  return example;
}

// Function to get default values based on type
function getDefaultValueForType(property: any): any {
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
      return "string";
    case "array":
      return property.items ? [getDefaultValueForType(property.items)] : [];
    default:
      return "string";
  }
}

// Function to confirm and delete the main directory
async function confirmAndDeleteRootDir(rootDir: string): Promise<boolean> {
  if (!fs.existsSync(rootDir)) {
    return true; // Directory doesn't exist, proceed
  }

  const confirmationMessage = `Caution! Directory already exists. Do you want to replace it? ${rootDir}`;

  vscode.window.showWarningMessage(confirmationMessage);

  const overwrite = await vscode.window.showQuickPick(['Yes', 'No'], {
    placeHolder: confirmationMessage
  });

  if (overwrite === 'Yes') {
    fs.rmSync(rootDir, { recursive: true, force: true });
    // vscode.window.showInformationMessage(`Directory overridden by user. ${rootDir}`);
    vscode.window.showInformationMessage(`Creating new directories. Please wait!`);
    return true; // Proceed after deleting
  }

  vscode.window.showInformationMessage(`Processing cancelled by user.`);
  return false; // Cancel processing
}

// Function to ensure a directory exists
function ensureDirectoryExistence(dir: string) {
  if (!fs.existsSync(dir)) {
    // vscode.window.showInformationMessage(`Creating new directories. Please wait!`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Function to generate Playwright test content
async function generatePlaywrightTestContent(
  baseUrl: string,
  pathName: string,
  endpointPath: string,
  tagName: string,
  methods: Record<string, any>,
  swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]: [string, any]) => {
    const methodUpperCase = method.toUpperCase();
    const methodLowerCase = method.toLowerCase();

    const parameters = details.parameters ? details.parameters.map((param: any) => {
      const resolvedSchema = resolveSchemaReferences(swaggerData, param.schema || {});
      const value = resolvedSchema.example || getDefaultValueForType(resolvedSchema);
      return `${param.name}: ${JSON.stringify(value)}`;
    }).join(", ") : "";

    let requestBodyContent = "";
    if (details.requestBody && details.requestBody.content) {
      const contentType = Object.keys(details.requestBody.content)[0];
      const schema = resolveSchemaReferences(swaggerData, details.requestBody.content[contentType].schema || {});
      const example = schema.example || buildExampleFromSchema(schema);

      requestBodyContent = example ? `${JSON.stringify(example, null, 8)}` : "";
    }

    const responseExample = details.responses && details.responses["200"] && details.responses["200"].content
      ? details.responses["200"].content[Object.keys(details.responses["200"].content)[0]].example
      : undefined;

    return `test('${methodUpperCase}: Should return success', async ({ request }) => {
    const response = await request.${methodLowerCase}(\`\${endPoint}\`, {
      params: { ${parameters} }${requestBodyContent ? `,
      data: ${requestBodyContent}` : ""}
    });
    expect(response.status()).toBe(200);${responseExample ? `
    expect(await response.json()).toEqual(${JSON.stringify(responseExample, null, 2)});` : ""}
  });`;
  })
  );

  return `import { expect, test } from '@playwright/test';
const baseUrl = '${baseUrl}';
const pathName = '${pathName}';
const pathUrl = '${endpointPath.replace(/{.*?}/g, "example")}';
const endPoint = \`\${baseUrl}\${pathName}\${pathUrl}\`;

test.describe('${tagName} ${endpointPath}', () => {
  ${testCases.join("\n")}
});
`;
}

// Function to generate Cypress test content
async function generateCypressTestContent(
  baseUrl: string,
  pathName: string,
  endpointPath: string,
  tagName: string,
  methods: Record<string, any>,
  swaggerData: any
): Promise<string> {
  const testCases = await Promise.all(Object.entries(methods).map(async ([method, details]: [string, any]) => {
    const methodUpperCase = method.toUpperCase();
    const methodLowerCase = method.toLowerCase();

    // Handle parameters
    const parametersObject = (details.parameters || []).reduce((acc: Record<string, any>, param: any) => {
      acc[param.name] = param.value || '';
      return acc;
    }, {});
    const parameters = JSON.stringify(parametersObject, null, 2);

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

    return `it('${methodUpperCase}: Should return success', () => {
    cy.${methodLowerCase}(\`\${endPoint}\`, {
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


// Refactored main function to delegate content generation
async function generateTestFileContent(
  baseUrl: string,
  pathName: string,
  endpointPath: string,
  tagName: string,
  methods: Record<string, any>,
  swaggerData: any,
  testFramework: 'playwright' | 'cypress',
  fileExtension: string
): Promise<string> {
  if (testFramework === 'playwright') {
    return generatePlaywrightTestContent(baseUrl, pathName, endpointPath, tagName, methods, swaggerData);
  } else if (testFramework === 'cypress') {
    return generateCypressTestContent(baseUrl, pathName, endpointPath, tagName, methods, swaggerData);
  }
  throw new Error(`Unsupported test framework: ${testFramework}`);
}

// Function to process the file
async function processFile(uri: vscode.Uri, data: string, framework: 'playwright' | 'cypress', fileExtension: string, processDataFunc: (data: any) => { baseUrl: string; pathName: string; paths: any; info: any }): Promise<string[]> {
  vscode.window.showInformationMessage(`Started creating scripts for ${firstToUppercase(framework)}.`);

  const suffix = {
    playwright: 'test',
    cypress: 'cy',
    default: 'spec'
  }[framework] || 'spec';

  try {
    const jsonData = JSON.parse(data);
    const { baseUrl, pathName, paths, info } = processDataFunc(jsonData);
    const generatedFiles: string[] = [];

    const jsonDir = path.dirname(uri.fsPath);
    const rootDir = path.join(jsonDir, formatarString(info.title || info.name));
    generatedFiles.push(`${rootDir}\n`);

    if (!await confirmAndDeleteRootDir(rootDir)) {
      return []; // Stop processing if user cancels
    }

    // Ensure the existence of the main directory with confirmation
    ensureDirectoryExistence(rootDir);

    for (const [endpointPath, methods] of Object.entries(paths)) {
      const tagName = (Object.values(methods as Record<string, any>)[0]?.tags?.[0]) || "untagged";
      const dirPath = path.join(rootDir, formatarString(tagName));
      const relativePath = `${endpointPath.replace(/^\/|\/$/g, "").replace(/\//g, "_")}.${suffix}.${fileExtension}`;
      const fileName = path.join(dirPath, relativePath);

      // Secure subdirectories without confirmation
      ensureDirectoryExistence(dirPath);

      const testContent = await generateTestFileContent(baseUrl, pathName, endpointPath, tagName, methods as any, jsonData, framework, fileExtension);

      await fs.promises.writeFile(fileName, testContent, "utf-8");
      generatedFiles.push(`\\${formatarString(tagName)}\\${relativePath}`);
    }
    return generatedFiles;
  } catch (error: unknown) {
    const errorMessage = (error as Error)?.message || "Unknown error";
    vscode.window.showErrorMessage(`Error processing file: ${errorMessage}`);
    return [];
  }
}

// Main function of activating the extension
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "API Test Builder" is now active!');

  const registerCommand = (command: string, framework: 'playwright' | 'cypress', fileExtension: string, processDataFunc: (data: any) => { baseUrl: string; pathName: string; paths: any; info: any }) => {
    const disposable = vscode.commands.registerCommand(command, async (uri: vscode.Uri) => {
      const filePath = uri.fsPath;
      try {
        const data = await fs.promises.readFile(filePath, "utf-8");
        const generatedFiles = await processFile(uri, data, framework, fileExtension, processDataFunc);
        if (generatedFiles.length > 0) {
          vscode.window.showInformationMessage(`Finished creating scripts for  ${firstToUppercase(framework)}.\nFiles generated in:\n${generatedFiles.join('\n\n')}`);
        }
      } catch (error: unknown) {
        const errorMessage = (error as Error)?.message || "Unknown error";
        vscode.window.showErrorMessage(`Error processing file: ${errorMessage}`);
      }
    });
    context.subscriptions.push(disposable);
  };


  // Helper function to process Swagger data
  function extractSwaggerData(data: any): { baseUrl: string; pathName: string; paths: any; info: any } {
    const baseUrl = new URL(data.servers[0].url).origin;
    const pathName = new URL(data.servers[0].url).pathname;
    const paths = data.paths;
    const info = data.info;
    return { baseUrl, pathName, paths, info };
  }

  // Helper function to process Postman data
  // TODO
  function extractPostmanData(data: any): { baseUrl: string; pathName: string; paths: any; info: any } {
    const baseUrlFull = data.variable?.find((variable: any) => variable.key === 'baseUrl')?.value || '';
    const baseUrl = baseUrlFull ? new URL(baseUrlFull).origin : '';
    const pathName = baseUrlFull ? new URL(baseUrlFull).pathname : '';
    const paths: Record<string, Record<string, any>> = {};
    const info = data.info || {};

    function collectionProcessItems(items: any[], currentPath: string = '', currentTag: string = 'Untagged') {
      items?.forEach(item => {
        if (item.item) {
          const folderName = item.name || currentTag;
          collectionProcessItems(item.item, currentPath, folderName);
        } else if (item.request) {
          const pathSegments = item.request.url.path || [];
          const path = `/${pathSegments.join('/')}`;
          paths[path] = paths[path] || {};

          const method = item.request.method.toLowerCase();
          const parameters = (item.request.url.query || []).map((query: any) => ({
            name: query.key,
            value: query.value || '',
          }));

          paths[path][method] = {
            ...item.request,
            tags: [currentTag], // Add tags for better categorization
            parameters,
          };
        }
      });
    }

    collectionProcessItems(data.item || []);
    return { baseUrl, pathName, paths, info };
  }

  // comands to vscode
  registerCommand("apiTestScript.genSwaggerToPlaywright", 'playwright', 'ts', (data: any) => extractSwaggerData(data));

  registerCommand("apiTestScript.genSwaggerToCypress", 'cypress', 'js', (data: any) => extractSwaggerData(data));

  registerCommand("apiTestScript.genPostmanToPlaywright", 'playwright', 'ts', (data: any) => extractPostmanData(data));

  registerCommand("apiTestScript.genPostmanToCypress", 'cypress', 'js', (data: any) => extractPostmanData(data));

}

export function deactivate() { }
