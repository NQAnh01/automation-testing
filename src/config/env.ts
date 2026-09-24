import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ quiet: true });

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional(),
);

const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
  }, z.boolean());

const envSchema = z.object({
  TMS_BASE_URL: z.string().url().default('https://projects.tms-s.vn'),
  TMS_TOKEN: optionalTrimmedString,
  TMS_AUTH_SCHEME: z.string().trim().default('Bearer'),
  TMS_AUTH_HEADER: z.string().trim().default('Authorization'),
  APP_BASE_URL: optionalTrimmedString.pipe(z.string().url().optional()),
  TEST_USERNAME: optionalTrimmedString,
  TEST_PASSWORD: optionalTrimmedString,
  AUTH_MODE: z.enum(['none', 'form', 'storage-state']).default('none'),
  AUTH_STORAGE_STATE: z.string().trim().default('.auth/storage-state.json'),
  HEADLESS: booleanFromEnv(true),
  OUTPUT_DIR: z.string().trim().default('output'),
  TEST_DATA_JSON: optionalTrimmedString,
  NEED_ATTENTION_EXIT_CODE: booleanFromEnv(false),
});

export interface AutomationConfig {
  tmsBaseUrl: string;
  tmsToken?: string;
  tmsAuthScheme: string;
  tmsAuthHeader: string;
  appBaseUrl?: string;
  testUsername?: string;
  testPassword?: string;
  authMode: 'none' | 'form' | 'storage-state';
  authStorageState: string;
  headless: boolean;
  outputDir: string;
  testDataJson?: string;
  needAttentionExitCode: boolean;
}

export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentConfigurationError';
  }
}

export function getConfig(): AutomationConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new EnvironmentConfigurationError(`Invalid environment configuration: ${details}`);
  }

  const env = result.data;
  return {
    tmsBaseUrl: env.TMS_BASE_URL.replace(/\/$/, ''),
    ...(env.TMS_TOKEN ? { tmsToken: env.TMS_TOKEN } : {}),
    tmsAuthScheme: env.TMS_AUTH_SCHEME,
    tmsAuthHeader: env.TMS_AUTH_HEADER,
    ...(env.APP_BASE_URL ? { appBaseUrl: env.APP_BASE_URL.replace(/\/$/, '') } : {}),
    ...(env.TEST_USERNAME ? { testUsername: env.TEST_USERNAME } : {}),
    ...(env.TEST_PASSWORD ? { testPassword: env.TEST_PASSWORD } : {}),
    authMode: env.AUTH_MODE,
    authStorageState: path.resolve(env.AUTH_STORAGE_STATE),
    headless: env.HEADLESS,
    outputDir: path.resolve(env.OUTPUT_DIR),
    ...(env.TEST_DATA_JSON ? { testDataJson: env.TEST_DATA_JSON } : {}),
    needAttentionExitCode: env.NEED_ATTENTION_EXIT_CODE,
  };
}
