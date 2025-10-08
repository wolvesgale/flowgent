'use client';
import Papa from 'papaparse';
import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UploadCloud, ListChecks, Table as TableIcon, Info, ShieldAlert } from 'lucide-react';

const DB_FIELDS = [
  { key: 'recordId', label: 'レコードID' },
  { key: 'firstName', label: '名' },
  { key: 'lastName', label: '姓' },
  { key: 'supportPriority', label: 'サポート優先度' },
  { key: 'email', label: 'メールアドレス' },
  { key: 'pattern', label: 'パターン' },
  { key: 'contactPref', label: '連絡手段' },
  { key: 'meetingStatus', label: '面談状況' },
  { key: 'registrationStatus', label: '登録状況' },
  { key: 'lineRegistered', label: 'LINE登録' },
  { key: 'phoneNumber', label: '電話番号' },
  { key: 'acquisitionSource', label: '流入経路' },
  { key: 'facebookUrl', label: 'Facebook URL' },
  { key: 'listAcquired', label: 'リスト取得' },
  { key: 'matchingListUrl', label: 'マッチングリストURL' },
  { key: 'contactOwner', label: 'コンタクト担当者' },
  { key: 'sourceCreatedAt', label: '作成日 (YYYY-MM-DD HH:mm)' },
  { key: 'marketingContactStatus', label: 'マーケティングコンタクトステータス' },
  { key: 'strengths', label: '強み' },
  { key: 'notes', label: 'メモ' },
  { key: 'tier', label: 'Tier (TIER1/TIER2)' },
  { key: 'tags', label: 'タグ(カンマ区切り可)' },
] as const;

const MULTI_VALUE_FIELDS = new Set(['tags']);

type HeaderInfo = {
  id: string;     // 内部ID（col_0 等）
  label: string;  // 表示名（空なら「列n」）
  raw: string;    // CSVの生ヘッダ
  index: number;  // カラムインデックス
};

type CsvRow = string[];
const BATCH_SIZE = 500;

export default function CSVMapper() {
  const [headers, setHeaders] = useState<HeaderInfo[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [map, setMap] = useState<Record<string, string | string[]>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [lastImportCount, setLastImportCount] = useState<number | null>(null);

  const headerLookup = useMemo(
    () =>
      headers.reduce<Record<string, HeaderInfo>>((acc, header) => {
        acc[header.id] = header;
        return acc;
      }, {}),
    [headers],
  );

  const onFile = useCallback((file: File) => {
    try {
      const canUseWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined';
      Papa.parse<(string | number | boolean | null)[]>(file, {
        header: false,
        worker: canUseWorker,          // 可能ならWebWorkerでパース
        skipEmptyLines: 'greedy',
        complete: (res) => {
          try {
            const parsedRows = (res.data ?? []).filter(
              (row): row is (string | number | boolean | null)[] => Array.isArray(row),
            );
            if (parsedRows.length === 0) {
              toast.error('CSV にヘッダ行が見つかりません');
              return;
            }
            const rawHeaderRow = parsedRows[0] ?? [];
            const dataRows = parsedRows.slice(1);
            if (dataRows.length === 0) {
              toast.error('CSV にデータ行がありません');
              return;
            }

            // ヘッダ整形（空は「列n」）
            const initialHeaders: HeaderInfo[] = rawHeaderRow.map((value, index) => {
              const rawValue = value == null ? '' : String(value);
              const trimmed = rawValue.trim();
              const label = trimmed || `列${index + 1}`;
              return { id: `col_${index}`, label, raw: rawValue, index };
            });

            // データ側列が多い場合はヘッダを追加
            const maxColumns = dataRows.reduce(
              (max, row) => Math.max(max, row.length),
              initialHeaders.length,
            );
            const headerInfos = [...initialHeaders];
            for (let i = initialHeaders.length; i < maxColumns; i += 1) {
              headerInfos.push({ id: `col_${i}`, label: `列${i + 1}`, raw: '', index: i });
            }

            // 行をトリム・正規化
            const normalizedRows = dataRows.map((row) =>
              headerInfos.map((_, index) => {
                const cell = row[index];
                if (cell == null) return '';
                if (typeof cell === 'string') return cell.trim();
                return String(cell).trim();
              }),
            );

            setHeaders(headerInfos);
            setRows(normalizedRows.slice(0, 200)); // プレビュー用
            setAllRows(normalizedRows);
            setMap({});
            setLastImportCount(null);
            toast.success(`CSVファイルを読み込みました（${normalizedRows.length}行）`);
          } catch (e: unknown) {
            toast.error(`CSV データ処理で例外: ${e instanceof Error ? e.message : String(e)}`);
          }
        },
        error: (err) => {
          toast.error(`CSV 解析に失敗しました: ${err?.message ?? String(err)}`);
        },
      });
    } catch (e: unknown) {
      toast.error(`CSV 読み込みで例外: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const buildPayload = useCallback(() => {
    return allRows.map((row) => {
      const obj: Record<string, unknown> = {};

      DB_FIELDS.forEach((f) => {
        const mapping = map[f.key];
        if (!mapping || (typeof mapping === 'string' && mapping.length === 0)) return;

        const applySingleValue = (rawValue: string) => {
          const value = rawValue.trim();
          if (!value) return;

          if (MULTI_VALUE_FIELDS.has(f.key)) {
            const tags = value
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0);
            if (tags.length === 0) return;
            const existing = Array.isArray(obj[f.key]) ? (obj[f.key] as string[]) : [];
            obj[f.key] = Array.from(new Set([...existing, ...tags]));
            return;
          }

          if (f.key === 'tier') {
            const normalized = value.toUpperCase();
            obj[f.key] = normalized === 'TIER1' || normalized === 'TIER2' ? normalized : value;
            return;
          }

          obj[f.key] = value;
        };

        if (Array.isArray(mapping)) {
          mapping.forEach((id) => {
            const header = headerLookup[id];
            if (!header) return;
            const cell = row[header.index];
            const value = cell == null ? '' : String(cell);
            applySingleValue(value);
          });
        } else {
          const header = headerLookup[mapping];
          if (!header) return;
          const cell = row[header.index];
          const value = cell == null ? '' : String(cell);
          applySingleValue(value);
        }
      });

      return obj;
    });
  }, [allRows, headerLookup, map]);

  async function importInBatches(payload: Record<string, unknown>[]) {
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const chunk = payload.slice(i, i + BATCH_SIZE);
      const res = await fetch('/api/evangelists/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        credentials: 'include', // 401回避（Cookie送信）
        body: JSON.stringify({ rows: chunk }),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('AUTH');
        if (res.status === 403) throw new Error('FORBIDDEN');
        const text = await res.text();
        throw new Error(`バッチ ${i / BATCH_SIZE + 1} で失敗: ${text || res.statusText}`);
      }
    }
  }

  const handleImport = async () => {
    try {
      if (!allRows.length) return toast.error('CSV データが空です');

      const hasMapping = Object.values(map).some((v) =>
        Array.isArray(v) ? v.length > 0 : Boolean(v && v.length > 0),
      );
      if (!hasMapping) return toast.error('取り込み先の列が選択されていません');

      const payload = buildPayload();
      const meaningfulRows = payload.filter((row) =>
        Object.values(row).some((value) => {
          if (Array.isArray(value)) return value.length > 0;
          if (value === null || value === undefined) return false;
          return String(value).trim().length > 0;
        }),
      );
      if (meaningfulRows.length === 0) return toast.error('選択した列に値が見つかりませんでした');

      setIsImporting(true);
      await importInBatches(meaningfulRows);
      toast.success(`${meaningfulRows.length} 件のインポートが完了しました`);
      setLastImportCount(meaningfulRows.length);

      // リセット
      setHeaders([]);
      setRows([]);
      setAllRows([]);
      setMap({});
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.message === 'AUTH') return toast.error('セッションの有効期限が切れています。再度ログインしてください。');
        if (e.message === 'FORBIDDEN') return toast.error('CSVインポートは管理者またはCS権限のみ利用できます。');
        return toast.error(`インポートエラー: ${e.message}`);
      }
      toast.error(`インポートエラー: ${String(e)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const mappedFields = DB_FIELDS.filter(
    (f) => map[f.key] && (!Array.isArray(map[f.key]) || (map[f.key] as string[]).length > 0),
  );

  return (
    <div className="space-y-8">
      {/* STEP 1 */}
      <Card className="border-none shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">STEP 1</Badge>
              <CardTitle>CSVファイルをアップロード</CardTitle>
            </div>
            <CardDescription className="leading-relaxed text-slate-600">
              UTF-8 の CSV / TSV を読み込み、最初の行をヘッダーとして認識します。列名が空でも自動で列番号が割り当てられます。
            </CardDescription>
          </div>
          <UploadCloud className="h-6 w-6 text-purple-600" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="csv-file" className="text-sm font-semibold text-slate-700">CSVファイルを選択</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,.tsv"
              onChange={(e) => e.target.files && onFile(e.target.files[0])}
              className="mt-2 bg-white"
            />
          </div>
          {allRows.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-purple-800">
              <Info className="h-4 w-4" />
              <span>{allRows.length} 行のデータが読み込まれました（最初の 200 行をプレビューします）</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STEP 2 */}
      {headers.length > 0 && (
        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">STEP 2</Badge>
                <CardTitle>取り込みフィールドのマッピング</CardTitle>
              </div>
              <CardDescription className="text-slate-600">
                右側のプルダウンから CSV の列を選択してください。タグは複数列から統合できます。
              </CardDescription>
            </div>
            <ListChecks className="h-6 w-6 text-purple-600" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {DB_FIELDS.map((field) => {
                const selected = map[field.key];
                const selectedLabel = Array.isArray(selected)
                  ? selected.map((id) => headerLookup[id]?.label ?? '（不明な列）').join(', ')
                  : typeof selected === 'string' && selected.length > 0
                  ? headerLookup[selected]?.label ?? '（不明な列）'
                  : '未選択';

                const isMapped = Array.isArray(selected)
                  ? selected.length > 0
                  : typeof selected === 'string' && selected.length > 0;

                return (
                  <div key={field.key} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                        <span className="text-xs text-slate-500">{isMapped ? selectedLabel : '未選択'}</span>
                      </div>
                      {isMapped ? (
                        <Badge variant="outline" className="border-green-300 bg-green-50 text-xs text-green-700">選択済み</Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-300 text-xs text-slate-500">未設定</Badge>
                      )}
                    </div>

                    {/* 単一列マッピング（Radix Select: 空値禁止→未選択は undefined を使う） */}
                    <Select
                      value={
                        Array.isArray(selected)
                          ? undefined
                          : typeof selected === 'string' && selected.length > 0
                          ? selected
                          : undefined
                      }
                      onValueChange={(value) => {
                        setMap((prev) => {
                          if (value === '__CLEAR__') {
                            const next = { ...prev };
                            delete next[field.key];
                            return next;
                          }
                          return { ...prev, [field.key]: value };
                        });
                      }}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="（単一列を選択）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__CLEAR__">（選択解除）</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header.id} value={header.id}>
                            {header.label}
                            {header.raw.trim().length > 0 && header.raw.trim() !== header.label
                              ? `（${header.raw}）`
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* タグのみ複数列対応 */}
                    {field.key === 'tags' && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-slate-600">タグに使う列を複数選択</summary>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {headers.map((header) => {
                            const isChecked = Array.isArray(map.tags) && (map.tags as string[]).includes(header.id);
                            return (
                              <label key={header.id} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(event) => {
                                    setMap((prev) => {
                                      const current = Array.isArray(prev.tags) ? [...(prev.tags as string[])] : [];
                                      if (event.target.checked) {
                                        if (current.includes(header.id)) return prev;
                                        return { ...prev, tags: [...current, header.id] };
                                      }
                                      const nextTags = current.filter((id) => id !== header.id);
                                      if (nextTags.length === 0) {
                                        const next = { ...prev };
                                        delete next.tags;
                                        return next;
                                      }
                                      return { ...prev, tags: nextTags };
                                    });
                                  }}
                                />
                                <span>{header.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3 */}
      {headers.length > 0 && (
        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">STEP 3</Badge>
                <CardTitle>取り込み内容のプレビュー</CardTitle>
              </div>
              <CardDescription className="text-slate-600">最初の 5 行を確認してからインポートしてください。</CardDescription>
            </div>
            <TableIcon className="h-6 w-6 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                    {mappedFields.map((f) => (
                      <th key={f.key} className="border border-slate-200 px-3 py-2">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {mappedFields.map((f) => {
                        const mapping = map[f.key];
                        let value = '';
                        if (Array.isArray(mapping)) {
                          value = mapping
                            .map((id) => {
                              const header = headerLookup[id];
                              if (!header) return '';
                              return row[header.index] ?? '';
                            })
                            .filter(Boolean)
                            .join(', ');
                        } else if (mapping) {
                          const header = headerLookup[mapping];
                          value = header ? row[header.index] ?? '' : '';
                        }
                        return (
                          <td key={f.key} className="border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 5 && <div className="mt-3 text-sm text-slate-500">...他 {rows.length - 5} 行</div>}
          </CardContent>
        </Card>
      )}

      {/* STEP 4 */}
      {headers.length > 0 && (
        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">STEP 4</Badge>
                <CardTitle>インポートを実行</CardTitle>
              </div>
              <CardDescription className="text-slate-600">
                インポートには管理者または CS 権限のアカウントが必要です。
              </CardDescription>
            </div>
            <ShieldAlert className="h-6 w-6 text-purple-600" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleImport}
              disabled={allRows.length === 0 || isImporting}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isImporting ? (
                'インポート中...'
              ) : (
                <span className="flex items-center justify-center">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {allRows.length}件をインポート
                </span>
              )}
            </Button>

            {lastImportCount !== null && (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {lastImportCount} 件のレコードを登録 / 更新しました。
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
