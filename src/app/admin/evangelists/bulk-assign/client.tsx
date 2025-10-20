'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

      if (!dryRun && !window.confirm('本当に反映しますか？（この操作は元に戻せません）')) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/evangelists/bulk-assign?dryRun=${dryRun}`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });

      const contentType = response.headers.get('content-type') || '';
      const raw = await response.text();
      let payload: Record<string, unknown> | string | null = null;

      try {
        payload = contentType.includes('application/json') && raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        setError('認証が切れている可能性があります。再ログイン後に再実行してください。');
        return;
      }

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'エラーが発生しました。';
        setError(message);
        return;
      }

      setResult(payload ?? raw);
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
            {typeof result === 'string'
              ? result
              : (() => {
                  const payload = result as Record<string, unknown>;
                  const mode = typeof payload.mode === 'string' ? payload.mode : undefined;
                  const prefix = mode ? `# MODE: ${mode}\n` : '';
                  return prefix + JSON.stringify(result, null, 2);
                })()}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
