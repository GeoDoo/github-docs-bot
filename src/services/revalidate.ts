import type { Logger } from '../types/index.js';

/**
 * Notifies the docs portal to revalidate cached content after the bot
 * commits documentation updates. Fails silently — the portal will
 * eventually refresh via ISR even if this call doesn't land.
 */
export async function notifyPortalRevalidation(
  repo: string,
  log: Logger,
): Promise<void> {
  const portalUrl = process.env.PORTAL_URL;
  const secret = process.env.PORTAL_REVALIDATE_SECRET;

  if (!portalUrl || !secret) return;

  const url = `${portalUrl.replace(/\/+$/, '')}/api/revalidate`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ repo }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      log.info(`Portal revalidation triggered for ${repo}`);
    } else {
      log.warn(
        { status: response.status },
        `Portal revalidation returned ${response.status}`,
      );
    }
  } catch (error) {
    log.warn({ error }, 'Failed to notify portal for revalidation');
  }
}
