import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  firstToUppercase,
  formatKebabCase
} from './util';
import {
  generateTestScriptContentCypressJavaScript,
  generateTestScriptContentCypressTypeScript,
  generateTestScriptContentPlaywrightDotNet,
  generateTestScriptContentPlaywrightJava,
  generateTestScriptContentPlaywrightJavaScript,
  generateTestScriptContentPlaywrightPhypton,
  generateTestScriptContentPlaywrightTypeScript
} from './generateTestScriptContent';

import { extractPostmanData } from './extractDataPostman';
import { extractSwaggerData } from './extractDataSwagger';

// Refactored main function to delegate content generation
async function genTestFileContent(
  baseUrl: string,
  pathName: string,
  endpointPath: string,
  tagName: string,
  methods: Record<string, any>,
  swaggerData: any,
  testFramework: 'playwright' | 'cypress',
  language: 'javascript' | 'typescript' | 'python' | 'java' | '.net',
  fileExtension: string
): Promise<string> {
  const frameworks: Record<string, any> = {
    playwright: {
      javascript: generateTestScriptContentPlaywrightJavaScript,
      typescript: generateTestScriptContentPlaywrightTypeScript,
      java: generateTestScriptContentPlaywrightJava,
      '.net': generateTestScriptContentPlaywrightDotNet,
      python: generateTestScriptContentPlaywrightPhypton,
    },
    cypress: {
      javascript: generateTestScriptContentCypressJavaScript,
      typescript: generateTestScriptContentCypressTypeScript
    },
  };

  const frameworkHandler = frameworks[testFramework];
  if (!frameworkHandler) {
    throw new Error(`Unsupported test framework: ${testFramework}`);
  }

  if (typeof frameworkHandler === 'function') {
    return frameworkHandler(baseUrl, pathName, endpointPath, tagName, methods, swaggerData);
  }

  const languageHandler = frameworkHandler[language];
  if (!languageHandler) {
    throw new Error(`Unsupported language: ${language} for framework: ${testFramework}`);
  }

  return languageHandler(baseUrl, pathName, endpointPath, tagName, methods, swaggerData);
}


// Function to confirm and delete the main directory
async function confirmAndDeleteRootDir(rootDir: string): Promise<boolean> {
  if (!fs.existsSync(rootDir)) {
    return true; // Directory doesn't exist, proceed
  }

  //const confirmationMessage = `Directory already exists. Do you want to replace it? ${rootDir}`;
  //vscode.window.showWarningMessage(confirmationMessage);

  const overwrite = await vscode.window.showQuickPick(['Yes. Delete the existing directory.', 'No. Cancel the Process.'], {
    placeHolder: `Caution! Directory already exists. Do you want to replace it? ${rootDir}`
  });

  if (overwrite === 'Yes. Delete the existing directory.') {
    fs.rmSync(rootDir, { recursive: true, force: true });
    // vscode.window.showInformationMessage(`Directory overridden by user. ${rootDir}`);
    vscode.window.showInformationMessage(`Creating new directories. Please wait!`);
    return true; // Proceed after deleting
  }

  vscode.window.showInformationMessage(`Processing cancelled by user.`);
  return false; // Cancel processing
}

// Function to ensure a directory exists
function createDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Function to process the file
async function processFile(
  uri: vscode.Uri, data: string, framework: 'playwright' | 'cypress', language: 'javascript' | 'typescript' | 'python' | 'java' | '.net',
  fileExtension: string, processDataFunc: (data: any) => { baseUrl: string; pathName: string; paths: any; info: any }
): Promise<string[]> {
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
    const rootDir = path.join(jsonDir, formatKebabCase(info.title || info.name));
    generatedFiles.push(`${rootDir}\n`);

    if (!await confirmAndDeleteRootDir(rootDir)) {
      return []; // Stop processing if user cancels
    }

    // Ensure the existence of the main directory with confirmation
    createDirectory(rootDir);

    for (const [endpointPath, methods] of Object.entries(paths)) {
      const tagName = (Object.values(methods as Record<string, any>)[0]?.tags?.[0]) || "untagged";
      const dirPath = path.join(rootDir, formatKebabCase(tagName));
      const relativePath = `${endpointPath.replace(/^\/|\/$/g, "").replace(/\//g, "_")}.${suffix}.${fileExtension}`;
      const fileName = path.join(dirPath, relativePath);

      // Secure subdirectories without confirmation
      createDirectory(dirPath);

      const testContent = await genTestFileContent(baseUrl, pathName, endpointPath, tagName, methods as any, jsonData, framework, language, fileExtension);

      await fs.promises.writeFile(fileName, testContent, "utf-8");
      generatedFiles.push(`\\${formatKebabCase(tagName)}\\${relativePath}`);
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

  const registerCommand = (
    command: string, framework: 'playwright' | 'cypress', language: 'javascript' | 'typescript' | 'python' | 'java' | '.net',
    fileExtension: string, processDataFunc: (data: any) => { baseUrl: string; pathName: string; paths: any; info: any }
  ) => {
    const disposable = vscode.commands.registerCommand(command, async (uri: vscode.Uri) => {
      const filePath = uri.fsPath;
      try {
        const data = await fs.promises.readFile(filePath, "utf-8");
        const generatedFiles = await processFile(uri, data, framework, language, fileExtension, processDataFunc);
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

  // comands to vscode
  registerCommand("apiTestScript.genSwaggerToPlaywrightTs", 'playwright', 'typescript', 'ts', (data: any) => extractSwaggerData(data));
  registerCommand("apiTestScript.genSwaggerToPlaywrightJs", 'playwright', 'javascript', 'js', (data: any) => extractSwaggerData(data));
  registerCommand("apiTestScript.genSwaggerToPlaywrightPy", 'playwright', 'python', 'py', (data: any) => extractSwaggerData(data));
  registerCommand("apiTestScript.genSwaggerToPlaywrightJava", 'playwright', 'java', 'java', (data: any) => extractSwaggerData(data));
  registerCommand("apiTestScript.genSwaggerToPlaywrightDotNet", 'playwright', '.net', 'cs', (data: any) => extractSwaggerData(data));
  registerCommand("apiTestScript.genSwaggerToCypressTs", 'cypress', 'typescript', 'ts', (data: any) => extractSwaggerData(data));
  registerCommand("apiTestScript.genSwaggerToCypressJs", 'cypress', 'javascript', 'js', (data: any) => extractSwaggerData(data));
  registerCommand("apiTestScript.genPostmanToPlaywright", 'playwright', 'javascript', 'ts', (data: any) => extractPostmanData(data));
  registerCommand("apiTestScript.genPostmanToCypress", 'cypress', 'javascript', 'js', (data: any) => extractPostmanData(data));
}

export function deactivate() { }
