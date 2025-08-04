// Result type for safe error handling
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helper functions for creating results
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Helper to unwrap result or throw
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(result.error);
}

// Helper to unwrap result or return default
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}
