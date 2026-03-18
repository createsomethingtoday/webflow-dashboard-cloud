import {
  getCloudflareEnv,
  type DashboardCloudflareEnv
} from '@create-something/webflow-dashboard-core';

export async function getOptionalEnv(): Promise<DashboardCloudflareEnv | null> {
  const runtimeEnv = await getCloudflareEnv();
  if (runtimeEnv) {
    return runtimeEnv;
  }

  if (typeof process !== 'undefined' && process.env) {
    return {
      AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      CRON_SECRET: process.env.CRON_SECRET,
      ADMIN_EMAILS: process.env.ADMIN_EMAILS,
      CSRF_TRUSTED_ORIGINS: process.env.CSRF_TRUSTED_ORIGINS,
      ENVIRONMENT: process.env.ENVIRONMENT,
      DEBUG_LOGS: process.env.DEBUG_LOGS,
      DEBUG_AIRTABLE: process.env.DEBUG_AIRTABLE
    };
  }

  return null;
}

export async function getEnvOrThrow(): Promise<DashboardCloudflareEnv> {
  const env = await getOptionalEnv();
  if (!env) {
    throw new Error('Cloudflare runtime env not available');
  }
  return env;
}
