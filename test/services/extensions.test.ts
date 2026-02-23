import { describe, it, expect } from 'vitest';
import { isCodeFile } from '../../src/services/extensions.js';

describe('isCodeFile', () => {
  it('recognizes common code file extensions', () => {
    const codeFiles = [
      'src/index.ts',
      'app.js',
      'main.py',
      'App.java',
      'main.go',
      'lib.rs',
      'controller.rb',
      'Program.cs',
      'main.kt',
      'app.swift',
      'main.cpp',
      'index.php',
      'main.dart',
      'lib.ex',
      'Main.scala',
      'main.zig',
    ];

    for (const file of codeFiles) {
      expect(isCodeFile(file), `Expected ${file} to be a code file`).toBe(true);
    }
  });

  it('rejects non-code files', () => {
    const nonCodeFiles = [
      'image.png',
      'photo.jpg',
      'styles.css',
      'page.html',
      'data.json',
      'config.yaml',
      'readme.md',
      'package-lock.json',
      'Makefile',
      'document.pdf',
      '.gitignore',
      'data.csv',
      'archive.zip',
    ];

    for (const file of nonCodeFiles) {
      expect(isCodeFile(file), `Expected ${file} to NOT be a code file`).toBe(
        false,
      );
    }
  });

  it('handles files with multiple dots', () => {
    expect(isCodeFile('my.component.ts')).toBe(true);
    expect(isCodeFile('styles.module.css')).toBe(false);
  });

  it('handles files with no extension', () => {
    expect(isCodeFile('Makefile')).toBe(false);
    expect(isCodeFile('Dockerfile')).toBe(false);
  });
});
