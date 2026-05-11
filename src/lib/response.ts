// src/lib/response.ts

export const ok = <T>(data: T) => ({
  success: true as const,
  data,
});

export const err = (code: string, message: string) => ({
  success: false as const,
  error: { code, message },
});
