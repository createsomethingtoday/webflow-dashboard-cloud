import { requireUser } from '../../../lib/server/session';
import { ValidationPlayground } from '../../../components/validation-playground';

export const dynamic = 'force-dynamic';

export default async function PlaygroundPage() {
  await requireUser();

  return <ValidationPlayground />;
}
