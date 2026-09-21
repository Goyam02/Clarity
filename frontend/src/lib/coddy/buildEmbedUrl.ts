/**
 * Coddy Embed URL Builder
 * Builds iframe URLs for Coddy's live code runner embed (https://coddy.tech/embed-editor).
 * Verified against https://coddy.tech/embed documentation and runner endpoints:
 * - Base URL: https://coddy.tech/embed-editor
 * - Supported languages: python (main.py), java (Main.java), cpp (main.cpp)
 * - Supported params: lang, theme, layout, code, stdin
 * - Encoding: UTF-8 safe standard base64 passed through encodeURIComponent
 */

export interface BuildEmbedUrlOptions {
  lang?: 'python' | 'java' | 'cpp' | string;
  theme?: 'light' | 'dark' | 'auto';
  layout?: 'side' | 'stacked';
  code?: string;
  stdin?: string;
  credit?: boolean;
}

export const CODDY_EMBED_BASE_URL = 'https://coddy.tech/embed-editor';
export const CODDY_ATTRIBUTION_URL = 'https://coddy.tech/embed';

/**
 * Converts a UTF-8 string to a base64 encoded string safely in both
 * Node.js (SSR / Vitest) and modern browser environments.
 */
export function encodeUtf8Base64(str: string): string {
  if (!str) return '';

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64');
  }

  // Browser environment UTF-8 safe base64
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a base64 string back to a UTF-8 string safely.
 * Used for round-trip verification in tests and dev checks.
 */
export function decodeUtf8Base64(base64Str: string): string {
  if (!base64Str) return '';

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64Str, 'base64').toString('utf8');
  }

  // Browser environment UTF-8 safe decode
  const binary = atob(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Constructs the embed URL for Coddy's embeddable editor.
 */
export function buildEmbedUrl(options: BuildEmbedUrlOptions = {}): string {
  const {
    lang = 'python',
    theme = 'light',
    layout = 'stacked',
    code = '',
    stdin = '',
  } = options;

  const params = new URLSearchParams();
  params.set('lang', lang);
  params.set('theme', theme);
  params.set('layout', layout);

  if (code) {
    const encodedCode = encodeUtf8Base64(code);
    params.set('code', encodedCode);
  }

  if (stdin) {
    const encodedStdin = encodeUtf8Base64(stdin);
    params.set('stdin', encodedStdin);
  }

  return `${CODDY_EMBED_BASE_URL}?${params.toString()}`;
}

// Dev-only console self-check on initialization
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
  try {
    const testSample = 'print("Clarity UTF-8 check: 🚀")';
    const encoded = encodeUtf8Base64(testSample);
    const decoded = decodeUtf8Base64(encoded);
    if (decoded !== testSample) {
      console.warn('[Coddy Embed] UTF-8 base64 roundtrip check mismatch in dev.');
    }
  } catch {
    // ignore
  }
}
