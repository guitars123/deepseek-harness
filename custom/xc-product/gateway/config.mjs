import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/** @param env Deployment environment. @returns Validated product configuration. */
export function configuration(env = process.env) {
  const publicUrl = new URL(env.XC_PUBLIC_URL || 'http://127.0.0.1:3090');
  const accountUrl = new URL(env.XC_ACCOUNT_URL || 'http://182.254.155.185:8080');
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) throw new Error('XC_PUBLIC_URL must be an HTTP(S) origin');
  if (!['http:', 'https:'].includes(accountUrl.protocol)) throw new Error('Invalid XC_ACCOUNT_URL');
  const number = (key, fallback) => { const value = Number(env[key] || fallback); if (!Number.isSafeInteger(value) || value < 1) throw new Error(key + ' must be a positive integer'); return value; };
  return { publicUrl: publicUrl.origin, accountUrl: accountUrl.href.replace(/\/$/u, ''), host: env.XC_HOST || '127.0.0.1', port: number('XC_PORT',3090), dataDir: resolve(env.XC_DATA_DIR || '.data'), dshRoot: resolve(env.XC_DSH_ROOT || fileURLToPath(new URL('../../../',import.meta.url))), sessionDays: number('XC_SESSION_DAYS',7), startupTimeout: number('XC_STARTUP_TIMEOUT_MS',180000), maxInstances: number('XC_MAX_INSTANCES',20) };
}
