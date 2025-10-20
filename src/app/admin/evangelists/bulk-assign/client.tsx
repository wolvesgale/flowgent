'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function safeParseJson(raw: string, contentType: string) {
  if (!raw) return null;
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export default function BulkAssignClient() {
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<string | Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      setError('CSVファイルを選択してください。');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const response = await fetch(`/api/admin/evangelists/bulk-assign?dryRun=${dryRun}`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });

      const contentType = response.headers.get('content-type') || '';
      const raw = await response.text();
      const payload = safeParseJson(raw, contentType);

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const message =
          (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as Record<string, unknown>).error === 'string'
            ? (payload as { error: string }).error
            : undefined) || 'エラーが発生しました。';
        setError(message);
        return;
      }

      if (payload && typeof payload === 'object') {
        setResult(payload as Record<string, unknown>);
      } else {
        setResult(raw);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">CSV一括反映（管理者のみ）</CardTitle>
        <p className="text-sm text-slate-600">担当・Tier を CSV で一括更新します。まずはドライランで確認してください。</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          <span>ヘッダー例：<code>担当,Tier,姓,名,Eメール</code></span>
          <a className="text-brand underline" href="/api/admin/evangelists/export-basic">
            現在の割当をCSVダウンロード
          </a>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bulk-upload">CSVファイル</Label>
          <Input
            id="bulk-upload"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
          ドライラン（件数のみ・更新なし）
        </label>

        <Button onClick={handleSubmit} disabled={loading} className="w-full md:w-auto">
          {loading ? '処理中…' : 'アップロードして反映'}
        </Button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <pre className="max-h-96 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
