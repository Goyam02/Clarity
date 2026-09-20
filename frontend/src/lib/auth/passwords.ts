/**
 * Client-safe common-password list (the server-side PBKDF2 hashing lives in
 * the FastAPI backend now — this is only used by signup validation).
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'admin123', 'welcome1', 'welcome123', 'letmein123', 'clarity123',
  'iloveyou', 'monkey123', 'dragon123', 'master123', 'sunshine1', 'princess1',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}
