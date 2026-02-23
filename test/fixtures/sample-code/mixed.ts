/**
 * Already documented function.
 */
export function documented(): void {
  return;
}

export function undocumented(x: number): number {
  return x * 2;
}

/**
 * A configuration interface.
 */
export interface AppConfig {
  port: number;
  host: string;
}

export interface UndocumentedConfig {
  debug: boolean;
}

export const arrowFn = (a: string, b: string) => a + b;
