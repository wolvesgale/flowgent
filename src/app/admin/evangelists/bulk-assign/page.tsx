import { requireAdmin } from '@/lib/session';

import BulkAssignClient from './client';

export default async function BulkAssignPage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <BulkAssignClient />
    </div>
  );
}
