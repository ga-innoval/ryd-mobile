// `tsconfig.json` restringe `types` a ["jest"] a propósito: mantiene los
// globales de Node fuera de una app React Native, donde no existen en runtime.
// En vez de ensanchar eso para un helper de tests, se declara aquí solo el
// subconjunto de `node:sqlite` que usa `in-memory-db.ts`.
declare module "node:sqlite" {
  export class StatementSync {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  }

  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
