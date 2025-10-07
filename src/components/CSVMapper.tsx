'use client';
import Papa from 'papaparse';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const DB_FIELDS = [
  { key: 'recordId', label: 'Record ID' },
  { key: 'firstName', label: '名' },
  { key: 'lastName', label: '姓' },
  { key: 'email', label: 'Email' },
  { key: 'contactPref', label: '連絡方法' },
  { key: 'strengths', label: '強み' },
  { key: 'notes', label: 'メモ' },
  { key: 'tier', label: 'Tier (TIER1/TIER2)' },
  { key: 'tags', label: 'タグ(カンマ区切り可)' },
];

type CsvRow = Record<string, string | undefined>;
const BATCH_SIZE = 500;

export default function CSVMapper() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [map, setMap] = useState<Record<string, string | string[]>>({});
  const [isImporting, setIsImporting] = useState(false);

  const onFile = useCallback((file: File) => {
    try {
      Papa.parse<CsvRow>(file, {
        header: true,
        worker: true,
        skipEmptyLines: true,
        transformHeader: (h) => (h ?? '').trim(),
        complete: (res) => {
          try {
            const fields = res.meta.fields ?? [];
            const data = (res.data ?? []).filter(Boolean).slice(0, 200);
            const allData = (res.data ?? []).filter(Boolean);
            setHeaders(fields);
            setRows(data);
            setAllRows(allData);
            toast.success(`CSVファイルを読み込みました（${allData.length}行）`);
          } catch (e: any) {
            toast.error(`CSV データ処理で例外: ${e?.message ?? e}`);
          }
        },
        error: (err) => {
          toast.error(`CSV 解析に失敗しました: ${err?.message ?? err}`);
        },
      });
    } catch (e: any) {
      toast.error(`CSV 読み込みで例外: ${e?.message ?? e}`);
    }
  }, []);

  const buildPayload = useCallback(() => {
    return allRows.map((r) => {
      const obj: Record<string, unknown> = {};
      DB_FIELDS.forEach((f) => {
        const m = map[f.key];
        if (!m) return;
        if (Array.isArray(m)) {
          // 複数ヘッダ→結合
          obj[f.key] = m.map((h) => (r[h] ?? '').trim()).filter(Boolean);
        } else {
          const val = (r[m] ?? '').trim();
          obj[f.key] = f.key === 'tags' ? val.split(',').map(s => s.trim()).filter(Boolean) : val;
        }
      });
      return obj;
    });
  }, [allRows, map]);

  async function importInBatches(payload: any[]) {
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const chunk = payload.slice(i, i + BATCH_SIZE);
      const res = await fetch('/api/evangelists/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ rows: chunk }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`バッチ ${i / BATCH_SIZE + 1} で失敗: ${text}`);
      }
    }
  }

  const handleImport = async () => {
    try {
      if (!allRows.length) return toast.error('CSV データが空です');
      const payload = buildPayload();
      setIsImporting(true);
      await importInBatches(payload);
      toast.success('インポートが完了しました');
      
      // リセット
      setHeaders([]);
      setRows([]);
      setAllRows([]);
      setMap({});
    } catch (e: any) {
      toast.error(`インポートエラー: ${e?.message ?? e}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSVファイルアップロード</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">CSVファイルを選択</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={e => e.target.files && onFile(e.target.files[0])}
                className="mt-2"
              />
            </div>
            
            {allRows.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {allRows.length}行のデータが読み込まれました（最初の200行を表示）
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>フィールドマッピング</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {DB_FIELDS.map(f => (
                <div key={f.key} className="p-4 border rounded-lg space-y-3">
                  <div className="font-medium">
                    {f.label} → {Array.isArray(map[f.key]) ? (map[f.key] as string[]).join(",") : (map[f.key] || "未選択")}
                  </div>
                  
                  <Select 
                    value={Array.isArray(map[f.key]) ? "" : (map[f.key] as string) || ""} 
                    onValueChange={value => setMap({ ...map, [f.key]: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="（単一列を選択）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">（選択なし）</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {f.key === "tags" && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        タグに使う列を複数選択
                      </summary>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {headers.map(h => (
                          <label key={h} className="text-sm flex items-center space-x-1">
                            <input
                              type="checkbox"
                              checked={Array.isArray(map.tags) && (map.tags as string[]).includes(h)}
                              onChange={e => {
                                const cur = Array.isArray(map.tags) ? [...(map.tags as string[])] : [];
                                if (e.target.checked) {
                                  setMap({ ...map, tags: [...cur, h] });
                                } else {
                                  setMap({ ...map, tags: cur.filter(x => x !== h) });
                                }
                              }}
                            />
                            <span>{h}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>プレビュー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr>
                    {DB_FIELDS.filter(f => map[f.key]).map(f => (
                      <th key={f.key} className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {DB_FIELDS.filter(f => map[f.key]).map(f => {
                        const m = map[f.key];
                        let value = "";
                        if (Array.isArray(m)) {
                          value = m.map(h => row[h]).filter(Boolean).join(", ");
                        } else if (m) {
                          value = row[m] || "";
                        }
                        return (
                          <td key={f.key} className="border border-gray-300 px-2 py-1 text-sm">
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 5 && (
              <div className="text-sm text-muted-foreground mt-2">
                ...他 {rows.length - 5} 行
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {headers.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleImport}
            disabled={allRows.length === 0 || isImporting}
            className="w-full"
          >
            {isImporting ? 'インポート中...' : `${allRows.length}件をインポート`}
          </Button>
        </div>
      )}
    </div>
  );
}