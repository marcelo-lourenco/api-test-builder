import * as assert from 'assert';

import { firstToUppercase, formatKebabCase, formatPascalCase } from '../util';

suite('Util Functions Tests', () => {

    test('formatPascalCase - Basic strings', () => {
        assert.strictEqual(formatPascalCase('hello world'), 'HelloWorld');
        assert.strictEqual(formatPascalCase('single'), 'Single');
        assert.strictEqual(formatPascalCase('PascalCase'), 'Pascalcase'); // Should convert to lowercase first
    });

    test('formatPascalCase - Strings with special characters', () => {
        assert.strictEqual(formatPascalCase('héllo Wörld'), 'HelloWorld'); // Handles diacritics
        assert.strictEqual(formatPascalCase('123 abc'), '123Abc'); // Handles numbers
        assert.strictEqual(formatPascalCase('  leading and trailing spaces  '), 'LeadingAndTrailingSpaces'); // Handles spaces
    });


    test('formatPascalCase - Edge cases', () => {
        assert.strictEqual(formatPascalCase(''), ''); // Empty string
        assert.strictEqual(formatPascalCase(' '), ''); // Only spaces
        assert.strictEqual(formatPascalCase('123'), '123'); // Only numbers
    });

    test('formatKebabCase - Basic strings', () => {
        assert.strictEqual(formatKebabCase('hello world'), 'hello-world');
        assert.strictEqual(formatKebabCase('single'), 'single');
        assert.strictEqual(formatKebabCase('kebab-case'), 'kebab-case'); // Should remain lowercase
    });


    test('formatKebabCase - Strings with special characters', () => {
        assert.strictEqual(formatKebabCase('héllo Wörld'), 'hello-world'); // Handles diacritics
        assert.strictEqual(formatKebabCase('123 abc'), '123-abc'); // Handles numbers
        assert.strictEqual(formatKebabCase('  leading and trailing spaces  '), 'leading-and-trailing-spaces'); // Handles spaces
    });

    test('formatKebabCase - Edge cases', () => {
        assert.strictEqual(formatKebabCase(''), ''); // Empty string
        assert.strictEqual(formatKebabCase(' '), ''); // Only spaces
        assert.strictEqual(formatKebabCase('123'), '123'); // Only numbers
    });

    test('firstToUppercase - Basic strings', () => {
        assert.strictEqual(firstToUppercase('hello'), 'Hello');
        assert.strictEqual(firstToUppercase('world'), 'World');
    });

    test('firstToUppercase - Edge cases', () => {
        assert.strictEqual(firstToUppercase(''), ''); // Empty string
        assert.strictEqual(firstToUppercase('H'), 'H'); // Already uppercase
        assert.strictEqual(firstToUppercase('123'), '123'); // Numbers
    });


    test('firstToUppercase - String with space', () => {
      assert.strictEqual(firstToUppercase(' hello world'), ' hello world');
    });

});
