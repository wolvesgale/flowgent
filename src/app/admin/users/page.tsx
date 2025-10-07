import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import UsersPageContent from './UsersPageContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UsersPage() {
  try {
    await requireAdmin();
  } catch (error) {
    redirect('/login');
  }

  return <UsersPageContent />;
}