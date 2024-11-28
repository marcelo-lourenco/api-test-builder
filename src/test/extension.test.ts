import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { firstToUppercase, formatarString } from '../extension';

const invalidSwagger = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'invalidSwagger.json'), 'utf-8'));
const sampleSwagger = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sampleSwagger.json'), 'utf-8'));

suite('Extension Tests', () => {
    suite('Utility Function Tests', () => {
        test('formatarString should format strings correctly', () => {
            const result = formatarString('Olá Mundo da automação');
            assert.strictEqual(result, 'ola-mundo-da-automacao');
        });

        test('firstToUppercase should capitalize first letter', () => {
            const result = firstToUppercase('framework');
            assert.strictEqual(result, 'Framework');
        });
    });

    suite('Swagger Validation Tests', () => {
        test('Should detect valid Swagger/OpenAPI schema', () => {
            assert.doesNotThrow(() => {
                // Simulating a function that validates OpenAPI
                validateSwagger(sampleSwagger);
            }, 'Sample Swagger should be valid');
        });

        test('Should detect invalid Swagger/OpenAPI schema', () => {
            assert.throws(() => {
                validateSwagger(invalidSwagger);
            }, 'Invalid Swagger should throw an error');
        });
    });
});

// Mock function to simulate validation logic
function validateSwagger(schema: any): void {
    if (!schema.openapi || !schema.paths) {
        throw new Error('Invalid OpenAPI schema');
    }
}
