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

// Função para gerar o conteúdo do teste
export async function generateTestContent(
	baseUrl: string,
	pathName: string,
	endpointPath: string,
	tagName: string,
	methods: Record<string, any>,
	swaggerData: any
): Promise<string> {
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

			return `
  test('${methodUpperCase}: Should return success', async ({ request }) => {
    const response = await request.${methodLowerCase}(\`\${endPoint}\`, {
      params: { ${parameters} }${requestBodyContent ? `, data: ${requestBodyContent}` : ""}
    });
    expect(response.status()).toBe(200);
    ${responseExample ? `expect(await response.json()).toEqual(${JSON.stringify(responseExample, null, 2)});` : ""}
  });`;
		})
	);

	return `import { expect, test } from '@playwright/test';

const baseUrl = '${baseUrl}';
const pathName = '${pathName}';
const pathUrl  = '${endpointPath.replace(/{.*?}/g, "example")}';
const endPoint = \`\${baseUrl}\${pathName}\${pathUrl}\`;

test.describe('${tagName} ${endpointPath}', () => {${testCases.join("\n")}
});
`;
}

// Função principal da extensão
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "api-test-builder" is now active!');

	const disposable = vscode.commands.registerCommand("swagger-to-playwright.generate", async (uri: vscode.Uri) => {
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

				const testContent = await generateTestContent(baseUrl, pathName, endpointPath, tagName, methods as any, swaggerData);

				console.log(`Generating file in: ${fileName}`);
				await fs.promises.writeFile(fileName, testContent, "utf-8");
				vscode.window.showInformationMessage(`Generated file: ${fileName}`);
			}
		} catch (error: unknown) {
			const errorMessage = (error as Error)?.message || "Unknown error";
			vscode.window.showErrorMessage(`Error processing Swagger: ${errorMessage}`);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
