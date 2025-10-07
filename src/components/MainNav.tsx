import { getSession } from '@/lib/session';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Users, UserCheck } from 'lucide-react';

export default async function MainNav() {
  const session = await getSession();
  
  if (!session?.isLoggedIn) {
    return null;
  }

  const userRole = session.role;

  return (
    <nav className="w-full py-2 px-4 bg-purple-700/50">
      <div className="mx-auto max-w-6xl flex items-center justify-end space-x-4">
        {(userRole === 'ADMIN' || userRole === 'CS') && (
          <>
            {userRole === 'ADMIN' && (
              <Link href="/admin/users">
                <Button variant="ghost" size="sm" className="text-white hover:bg-purple-600/50">
                  <Users className="mr-2 h-4 w-4" />
                  ユーザー管理
                </Button>
              </Link>
            )}
            <Link href="/admin/innovators">
              <Button variant="ghost" size="sm" className="text-white hover:bg-purple-600/50">
                <UserCheck className="mr-2 h-4 w-4" />
                イノベータ管理
              </Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}