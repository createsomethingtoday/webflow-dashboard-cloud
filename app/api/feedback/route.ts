import { NextResponse } from 'next/server';
import { hasAdminAccess } from '@create-something/webflow-dashboard-core/security';
import { getUserFromRequest } from '../../../lib/server/session';
import { getEnvOrThrow, getOptionalEnv } from '../../../lib/server/env';

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = await getEnvOrThrow();
  const db = env.DB;
  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  const body = (await request.json()) as {
    type?: string;
    message?: string;
    pageUrl?: string;
  };

  if (!body.type || !['bug', 'feature', 'general'].includes(body.type)) {
    return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 });
  }

  if (!body.message || body.message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (body.message.length > 5000) {
    return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
  }

  try {
    await db
      .prepare('INSERT INTO feedback (user_email, feedback_type, message, page_url) VALUES (?, ?, ?, ?)')
      .bind(user.email, body.type, body.message.trim(), body.pageUrl || null)
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback submission error:', err);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = await getOptionalEnv();
  if (
    !hasAdminAccess(user.email, {
      adminEmailsCsv: env?.ADMIN_EMAILS,
      environment: env?.ENVIRONMENT
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = env?.DB;
  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const type = url.searchParams.get('type');

    let query = 'SELECT * FROM feedback';
    const params: string[] = [];

    if (type && ['bug', 'feature', 'general'].includes(type)) {
      query += ' WHERE feedback_type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit.toString());

    const result = await db
      .prepare(query)
      .bind(...params)
      .all();

    return NextResponse.json({ feedback: result.results });
  } catch (err) {
    console.error('Feedback fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
