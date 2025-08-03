# Agent Guidelines for gridCore

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## Build/Test Commands

- `bun test` - Run all tests
- `bun test <file>` - Run specific test file (e.g., `bun test src/animation/Timeline.test.ts`)
- `bun run check` - Run linting and type checking

## Code Style

- **Runtime**: Bun with TypeScript
- **Formatting**: Prettier (semi: false, printWidth: 120)
- **Imports**: Use explicit imports, group by: built-ins, external deps, internal modules
- **Types**: Strict TypeScript, use interfaces for options/configs, explicit return types for public APIs
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces, UPPER_CASE for constants
- **Error Handling**: Use proper Error objects, avoid silent failures
- **Async**: Prefer async/await over Promises, handle errors explicitly
- **Comments**: Minimal comments, focus on JSDoc for public APIs only
- **File Structure**: Index files for clean exports, group related functionality
- **Testing**: Bun test framework, descriptive test names, use beforeEach/afterEach for setup

## TypeScript Linting Rules

IMPORTANT: Always run `bun run check` before committing to ensure code passes linting.

### Avoid `any` type
- **NEVER** use `any` type - use `unknown` or proper type annotations instead
- For test mocks: use proper type assertions like `as unknown as TargetType`
- For global assignments in tests: prefer type-safe approaches or use `unknown`
- For function parameters: always specify proper types, even in test utilities

### Avoid non-null assertions (`!`)
- **NEVER** use non-null assertion operator (`!`)
- Use proper type guards instead: `.filter((x): x is Type => x !== undefined)`
- Check for null/undefined before use: `if (value) { ... }`
- For optional chaining results, wrap in conditional: `if (obj?.prop) { ... }`

### Safe optional chaining
- Don't use optional chaining in for...of loops: `for (const x of obj?.array)`
- Instead use: `if (obj?.array) { for (const x of obj.array) { ... } }`

### Type imports
- Always import types explicitly: `import type { TypeName } from "./module"`
- For mixed imports: `import { func, type TypeName } from "./module"`
