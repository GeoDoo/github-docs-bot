/**
 * Known code file extensions. Used only to filter out non-code files
 * (images, lockfiles, binaries, etc.) before sending to the LLM.
 * The LLM handles all language-specific analysis — this is just a gate.
 */
const CODE_EXTENSIONS = new Set([
  // JavaScript / TypeScript
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'mts', 'cjs', 'cts',
  // Python
  'py', 'pyi',
  // Java / JVM
  'java', 'kt', 'kts', 'scala', 'groovy', 'clj',
  // C / C++
  'c', 'h', 'cpp', 'cxx', 'cc', 'hpp', 'hxx',
  // C# / .NET
  'cs', 'fs', 'vb',
  // Go
  'go',
  // Rust
  'rs',
  // Ruby
  'rb',
  // PHP
  'php',
  // Swift
  'swift',
  // Dart
  'dart',
  // Elixir / Erlang
  'ex', 'exs', 'erl',
  // Haskell
  'hs',
  // Lua
  'lua',
  // R
  'r', 'R',
  // Shell
  'sh', 'bash', 'zsh',
  // Zig
  'zig',
]);

export function isCodeFile(filename: string): boolean {
  const ext = filename.split('.').pop() ?? '';
  return CODE_EXTENSIONS.has(ext);
}
