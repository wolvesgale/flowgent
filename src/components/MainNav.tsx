import { getSession } from '@/lib/session';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Sparkles, Users, UserCheck } from 'lucide-react';

export default async function MainNav() {
  const session = await getSession();

  if (!session?.isLoggedIn) {
    return null;
  }

  const userRole = session.role;

  return (
    <nav className="w-full py-3 px-4 flowgent-header">
      <div className="mx-auto max-w-6xl flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center space-x-2 text-white">
          <Sparkles className="h-5 w-5" />
          <span className="text-lg font-semibold">FlowGent</span>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/evangelists">
            <Button variant="ghost" size="sm" className="text-white hover:bg-purple-600/60">
              <Users className="mr-2 h-4 w-4" />
              エヴァ一覧
            </Button>
          </Link>

          <Link href="/evangelists/import">
            <Button variant="ghost" size="sm" className="text-white hover:bg-purple-600/60">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              CSVインポート
            </Button>
          </Link>

          {(userRole === 'ADMIN' || userRole === 'CS') && (
            <>
              <Link href="/admin/innovators">
                <Button variant="ghost" size="sm" className="text-white hover:bg-purple-600/60">
                  <UserCheck className="mr-2 h-4 w-4" />
                  イノベータ管理
                </Button>
              </Link>

              {userRole === 'ADMIN' && (
                <Link href="/admin/users">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-purple-600/60">
                    <Users className="mr-2 h-4 w-4" />
                    ユーザー管理
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}