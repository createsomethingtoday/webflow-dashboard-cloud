import { NextResponse } from 'next/server';
import { getUserFromRequest } from '../../../../lib/server/session';
import { getEnvOrThrow } from '../../../../lib/server/env';
import { getServerAirtable } from '../../../../lib/server/airtable';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = await getEnvOrThrow();
  const db = env.DB;
  if (!db) {
    return NextResponse.json({ snapshots: [], days_available: 0 });
  }

  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = Math.min(Math.max(parseInt(daysParam || '14', 10) || 14, 1), 30);

  try {
    const airtable = await getServerAirtable();
    const userAssets = await airtable.getAssetsByEmail(user.email);

    if (userAssets.length === 0) {
      return NextResponse.json({ snapshots: [], days_available: 0 });
    }

    const assetIds = userAssets.map((a) => a.id);
    const placeholders = assetIds.map(() => '?').join(', ');

    const result = await db
      .prepare(
        `SELECT
          captured_at,
          SUM(unique_viewers) as total_viewers,
          SUM(cumulative_purchases) as total_purchases,
          SUM(cumulative_revenue) as total_revenue
        FROM analytics_snapshots
        WHERE asset_id IN (${placeholders})
        GROUP BY captured_at
        ORDER BY captured_at DESC
        LIMIT ?`
      )
      .bind(...assetIds, days)
      .all();

    const snapshots = (result.results || []).reverse();

    return NextResponse.json({
      snapshots,
      days_available: snapshots.length
    });
  } catch (err) {
    console.error('Aggregate history query error:', err);
    return NextResponse.json({ snapshots: [], days_available: 0 });
  }
}
