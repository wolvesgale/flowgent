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
  { key: 'recordId', label: 'レコードID（任意）' },
  { key: 'lastName', label: '姓（必須）' },
  { key: 'firstName', label: '名（必須）' },
  { key: 'email', label: 'メールアドレス' },
  { key: 'tier', label: 'Tier (TIER1/TIER2)' },
  { key: 'strengths', label: '強み' },
  { key: 'pattern', label: '領域' },
  { key: 'registrationStatus', label: '登録有無' },
  { key: 'listAcquired', label: 'リスト提出有無' },
  { key: 'meetingStatus', label: '前回面談' },
] as const;

const REQUIRED_FIELDS = ['lastName', 'firstName'] as const;

type FieldKey = (typeof DB_FIELDS)[number]['key'];

type HeaderInfo = {
  id: string;     // 内部ID（col_0 等）
  label: string;  // 表示名（空なら「列n」）
  raw: string;    // CSVの生ヘッダ
  index: number;  // カラムインデックス
};

type CsvRow = string[];
const BATCH_SIZE = 500;

const createEmptyMap = () =>
  DB_FIELDS.reduce<Record<FieldKey, string | undefined>>((acc, field) => {
    acc[field.key] = undefined;
    return acc;
  }, {} as Record<FieldKey, string | undefined>);

export default function CSVMapper() {
  const [headers, setHeaders] = useState<HeaderInfo[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [map, setMap] = useState<Record<FieldKey, string | undefined>>(() => createEmptyMap());
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
        worker: canUseWorker, // 可能ならWebWorkerでパース
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
            setMap(createEmptyMap());
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
    const invalidRows: number[] = [];
    const records = allRows.map((row, index) => {
      const record: Record<string, unknown> = {};

      DB_FIELDS.forEach((field) => {
        const mapping = map[field.key];
        if (!mapping) return;

        const header = headerLookup[mapping];
        if (!header) return;

        const raw = row[header.index];
        const value = raw == null ? '' : String(raw).trim();

        if (!value) {
          if (REQUIRED_FIELDS.includes(field.key as (typeof REQUIRED_FIELDS)[number])) {
            invalidRows.push(index + 1);
          }
          return;
        }

        if (field.key === 'tier') {
          const normalized = value.toUpperCase();
          record[field.key] = normalized === 'TIER1' || normalized === 'TIER2' ? normalized : value;
          return;
        }

        record[field.key] = value;
      });

      const hasAllRequired = REQUIRED_FIELDS.every((key) => {
        const assignedHeader = map[key];
        if (!assignedHeader) return false;
        const header = headerLookup[assignedHeader];
        if (!header) return false;
        const raw = row[header.index];
        return Boolean(raw != null && String(raw).trim());
      });

      if (!hasAllRequired && !invalidRows.includes(index + 1)) {
        invalidRows.push(index + 1);
      }

      return record;
    });

    return { records, invalidRows };
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

      const requiredMapped = REQUIRED_FIELDS.every((key) => Boolean(map[key]));
      if (!requiredMapped) return toast.error('姓と名の取り込み先を必ず選択してください');

      const { records, invalidRows } = buildPayload();
      if (invalidRows.length > 0) {
        const sample = invalidRows.slice(0, 5).join(', ');
        const suffix = invalidRows.length > 5 ? ' など' : '';
        return toast.error(`必須項目（姓・名）が空の行があります: ${sample}${suffix}`);
      }

      const meaningfulRows = records.filter((row) =>
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
      setMap(createEmptyMap());
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

  const mappedFields = DB_FIELDS.filter((f) => Boolean(map[f.key]));

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
                右側のプルダウンから CSV の列を選択してください。姓と名は必須で、メールアドレスは任意項目です。
              </CardDescription>
            </div>
            <ListChecks className="h-6 w-6 text-purple-600" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {DB_FIELDS.map((field) => {
                const selected = map[field.key];
                const selectedLabel = selected
                  ? headerLookup[selected]?.label ?? '（不明な列）'
                  : '未選択';

                const isMapped = Boolean(selected);

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
                      value={selected || undefined}
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
                      <SelectTrigger className="w-full bg-white text-slate-900">
                        <SelectValue placeholder="（単一列を選択）" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900">
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
                        const header = mapping ? headerLookup[mapping] : undefined;
                        const value = header ? row[header.index] ?? '' : '';

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
