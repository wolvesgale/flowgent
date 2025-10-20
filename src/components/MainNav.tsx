import { getSession } from '@/lib/session';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckSquare, ClipboardList, Sparkles, Upload, Users, UserCheck } from 'lucide-react';

export default async function MainNav() {
  const session = await getSession();

  if (!session?.isLoggedIn) {
    return null;
  }

  const userRole = session.role;

  return (
    <nav className="w-full bg-brand text-white shadow-xs">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center space-x-2 text-white">
          <Sparkles className="h-5 w-5" />
          <span className="text-lg font-semibold">FlowGent</span>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/evangelists">
            <Button
              variant="ghost"
              size="sm"
              className="border border-white/20 bg-white/10 text-white shadow-xs hover:bg-white/20"
            >
              <Users className="mr-2 h-4 w-4" />
              エヴァ一覧
            </Button>
          </Link>

          <Link href="/todos">
            <Button
              variant="ghost"
              size="sm"
              className="border border-white/20 bg-white/10 text-white shadow-xs hover:bg-white/20"
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              ToDo
            </Button>
          </Link>

          {(userRole === 'ADMIN' || userRole === 'CS') && (
            <>
              <Link href="/admin/innovators">
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-white/20 bg-white/10 text-white shadow-xs hover:bg-white/20"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  イノベータ管理
                </Button>
              </Link>

              {userRole === 'ADMIN' && (
                <>
                  <Link href="/admin/evangelists/bulk-assign">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-white/20 bg-white/10 text-white shadow-xs hover:bg-white/20"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      CSV一括反映
                    </Button>
                  </Link>
                  <Link href="/admin/introductions/required">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-white/20 bg-white/10 text-white shadow-xs hover:bg-white/20"
                    >
                      <ClipboardList className="mr-2 h-4 w-4" />
                      紹介必須ルール
                    </Button>
                  </Link>
                  <Link href="/admin/users">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-white/20 bg-white/10 text-white shadow-xs hover:bg-white/20"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      ユーザー管理
                    </Button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}