'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CSVMapper from '@/components/CSVMapper'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function EvangelistImportPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/evangelists">
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">エヴァンジェリストCSVインポート</h1>
          <p className="text-muted-foreground">CSVファイルからエヴァンジェリストデータを一括インポート</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>インポート手順</CardTitle>
            <CardDescription>
              以下の手順でCSVファイルをインポートしてください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>CSVファイルを選択してアップロード</li>
              <li>CSVの列とデータベースフィールドをマッピング</li>
              <li>プレビューでデータを確認</li>
              <li>インポートを実行</li>
            </ol>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">注意事項：</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• 同じメールアドレスのデータは上書きされます</li>
                <li>• 最大200行まで一度にインポート可能です</li>
                <li>• 必須フィールド：名、姓</li>
                <li>• タグは複数の列から選択可能です</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <CSVMapper />
      </div>
    </div>
  )
}