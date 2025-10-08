'use client';
import Papa from 'papaparse';
import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UploadCloud, ListChecks, Table as TableIcon, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STRENGTH_OPTIONS = [
  { value: 'HR', label: '人事', aliases: ['人事', 'hr', 'ヒューマンリソース'] },
  { value: 'IT', label: 'IT', aliases: ['it', 'アイティー'] },
  { value: 'ACCOUNTING', label: '会計', aliases: ['会計', 'accounting', 'finance&accounting'] },
  { value: 'ADVERTISING', label: '広告', aliases: ['広告', 'advertising', 'マーケ'] },
  { value: 'MANAGEMENT', label: '経営', aliases: ['経営', 'management', 'マネジメント'] },
  { value: 'SALES', label: '営業', aliases: ['営業', 'sales'] },
  { value: 'MANUFACTURING', label: '製造', aliases: ['製造', 'manufacturing', 'ものづくり'] },
  { value: 'MEDICAL', label: '医療', aliases: ['医療', 'medical', 'ヘルスケア'] },
  { value: 'FINANCE', label: '金融', aliases: ['金融', 'finance', 'ファイナンス'] },
] as const;

const CONTACT_OPTIONS = [
  { value: 'FACEBOOK', label: 'Facebook', aliases: ['facebook', 'fb'] },
  { value: 'LINE', label: 'LINE', aliases: ['line', 'ライン'] },
  { value: 'EMAIL', label: 'メール', aliases: ['メール', 'mail', 'email', 'e-mail'] },
  { value: 'PHONE', label: '電話', aliases: ['電話', 'tel', 'phone', 'call'] },
  { value: 'SLACK', label: 'Slack', aliases: ['slack'] },
] as const;

const PHASE_OPTIONS = [
  { value: 'FIRST_CONTACT', label: '初回', aliases: ['初回', 'first', 'firstcontact'] },
  { value: 'REGISTERED', label: '登録', aliases: ['登録', 'registered'] },
  { value: 'LIST_SHARED', label: 'リスト提供', aliases: ['リスト提供', 'list', 'listshared'] },
  { value: 'CANDIDATE_SELECTION', label: '候補抽出', aliases: ['候補抽出', 'selection'] },
  { value: 'INNOVATOR_REVIEW', label: 'イノベータ確認', aliases: ['イノベータ確認', 'innovator', 'review'] },
  { value: 'INTRODUCING', label: '紹介中', aliases: ['紹介中', 'introducing', '紹介'] },
  { value: 'FOLLOW_UP', label: '継続中', aliases: ['継続中', 'followup', 'follow'] },
] as const;

const DB_FIELDS = [
  { key: 'lastName', label: '姓' },
  { key: 'firstName', label: '名' },
  { key: 'email', label: 'メールアドレス' },
  { key: 'strength', label: '強み' },
  { key: 'contactPreference', label: '連絡手段' },
  { key: 'phase', label: 'フェーズ' },
] as const;

type FieldKey = (typeof DB_FIELDS)[number]['key'];

type HeaderInfo = {
  id: string;
  label: string;
  raw: string;
  index: number;
};

type CsvRow = string[];
const BATCH_SIZE = 500;

const normalizeText = (value: string) => value.replace(/\s+/g, '').toLowerCase();

const buildLookup = <T extends { value: string; label: string; aliases?: string[] }>(options: readonly T[]) => {
  return options.reduce<Map<string, string>>((map, option) => {
    const candidates = [option.value, option.label, ...(option.aliases ?? [])];
    candidates.forEach((candidate) => {
      const normalized = normalizeText(candidate);
      if (!map.has(normalized)) {
        map.set(normalized, option.value);
      }
    });
    return map;
  }, new Map<string, string>());
};

const strengthLookup = buildLookup(STRENGTH_OPTIONS);
const contactLookup = buildLookup(CONTACT_OPTIONS);
const phaseLookup = buildLookup(PHASE_OPTIONS);

const FIELD_KEYWORDS: Record<FieldKey, string[]> = {
  lastName: ['姓', '苗字', 'last', 'last_name', 'familyname', '氏'],
  firstName: ['名', '名前', 'first', 'first_name', 'givenname'],
  email: ['メールアドレス', 'email', 'mail', 'e-mail'],
  strength: ['強み', '専門', 'スキル', '領域'],
  contactPreference: ['連絡手段', '連絡方法', 'コンタクト', '連絡先'],
  phase: ['フェーズ', 'ステータス', '進捗', '状態'],
};

const FIELD_HINTS: Partial<Record<FieldKey, string>> = {
  strength: '人事 / IT / 会計 / 広告 / 経営 / 営業 / 製造 / 医療 / 金融',
  contactPreference: 'Facebook / LINE / メール / 電話 / Slack',
  phase: '初回 / 登録 / リスト提供 / 候補抽出 / イノベータ確認 / 紹介中 / 継続中',
};

const buildAutoMap = (headers: HeaderInfo[]) => {
  const autoMap: Record<string, string> = {};
  const takenHeaderIds = new Set<string>();

  headers.forEach((header) => {
    const normalized = normalizeText(header.label || header.raw);
    (Object.entries(FIELD_KEYWORDS) as Array<[FieldKey, string[]]>).forEach(([fieldKey, keywords]) => {
      if (autoMap[fieldKey]) return;
      const matched = keywords.some((keyword) => normalizeText(keyword) === normalized);
      if (matched && !takenHeaderIds.has(header.id)) {
        autoMap[fieldKey] = header.id;
        takenHeaderIds.add(header.id);
      }
    });
  });

  return autoMap;
};

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

  const headerLookup = useMemo(() => {
    return headers.reduce<Record<string, HeaderInfo>>((acc, header) => {
      acc[header.id] = header;
      return acc;
    }, {});
  }, [headers]);

  const onFile = useCallback((file: File) => {
    try {
      const canUseWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined';

      Papa.parse<(string | number | boolean | null)[]>(file, {
        header: false,
        worker: canUseWorker,
        skipEmptyLines: 'greedy',
        delimiter: '',
        complete: (res) => {
          try {
            const parsedRows = (res.data ?? []).filter((row): row is (string | number | boolean | null)[] => Array.isArray(row));
            if (parsedRows.length === 0) {
              toast.error('CSV にヘッダ行が見つかりません');
              return;
            }

            if (res.errors && res.errors.length > 0) {
              const message = res.errors.map((err) => err.message).join('\n');
              toast.warning(`CSV 解析で警告: ${message}`);
            }

            const rawHeaderRow = parsedRows[0] ?? [];
            const dataRows = parsedRows.slice(1);

            if (dataRows.length === 0) {
              toast.error('CSV にデータ行がありません');
              return;
            }

            const initialHeaders: HeaderInfo[] = rawHeaderRow.map((value, index) => {
              const rawValue = value == null ? '' : String(value);
              const trimmed = rawValue.trim();
              const label = trimmed || `列${index + 1}`;
              return {
                id: `col_${index}`,
                label,
                raw: rawValue,
                index,
              };
            });

            const maxColumns = dataRows.reduce((max, row) => Math.max(max, row.length), initialHeaders.length);
            const headerInfos = [...initialHeaders];
            for (let i = initialHeaders.length; i < maxColumns; i += 1) {
              headerInfos.push({
                id: `col_${i}`,
                label: `列${i + 1}`,
                raw: '',
                index: i,
              });
            }

            const normalizedRows = dataRows.map((row) => {
              return headerInfos.map((_, index) => {
                const cell = row[index];
                if (cell == null) return '';
                if (typeof cell === 'string') return cell.trim();
                return String(cell).trim();
              });
            });

            const displayData = normalizedRows.slice(0, 200);

            setHeaders(headerInfos);
            setRows(displayData);
            setAllRows(normalizedRows);
            const auto = buildAutoMap(headerInfos);
            const nextMap = createEmptyMap();
            (Object.entries(auto) as Array<[FieldKey, string]>).forEach(([key, headerId]) => {
              nextMap[key] = headerId;
            });
            setMap(nextMap);
            setLastImportCount(null);
            toast.success(`CSVファイルを読み込みました（${normalizedRows.length}行）`);
          } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            toast.error(`CSV データ処理で例外: ${errorMessage}`);
          }
        },
        error: (err) => {
          toast.error(`CSV 解析に失敗しました: ${err?.message ?? err}`);
        },
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast.error(`CSV 読み込みで例外: ${errorMessage}`);
    }
  }, []);

  const buildPayload = useCallback(() => {
    return allRows.map((row) => {
      const obj: Record<string, unknown> = {};
      DB_FIELDS.forEach((field) => {
        const mapping = map[field.key];
        if (!mapping) return;

        const header = headerLookup[mapping];
        if (!header) return;

        const cell = row[header.index];
        const rawValue = cell == null ? '' : String(cell).trim();
        if (!rawValue) return;

        const normalized = normalizeText(rawValue);

        if (field.key === 'strength') {
          const strength = strengthLookup.get(normalized);
          if (strength) {
            obj[field.key] = strength;
          }
          return;
        }

        if (field.key === 'contactPreference') {
          const contact = contactLookup.get(normalized);
          if (contact) {
            obj[field.key] = contact;
          }
          return;
        }

        if (field.key === 'phase') {
          const phase = phaseLookup.get(normalized);
          if (phase) {
            obj[field.key] = phase;
          }
          return;
        }

        obj[field.key] = rawValue;
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
        credentials: 'include',
        body: JSON.stringify({ rows: chunk }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('AUTH');
        }
        if (res.status === 403) {
          throw new Error('FORBIDDEN');
        }
        const text = await res.text();
        throw new Error(`バッチ ${i / BATCH_SIZE + 1} で失敗: ${text || res.statusText}`);
      }
    }
  }

  const handleImport = async () => {
    try {
      if (!allRows.length) {
        toast.error('CSV データが空です');
        return;
      }

      const hasMapping = Object.values(map).some((value) => Boolean(value && value.length > 0));

      if (!hasMapping) {
        toast.error('取り込み先の列が選択されていません');
        return;
      }

      const payload = buildPayload();
      const meaningfulRows = payload.filter((row) =>
        Object.values(row).some((value) => {
          if (value === null || value === undefined) return false;
          return String(value).trim().length > 0;
        })
      );

      if (meaningfulRows.length === 0) {
        toast.error('選択した列に値が見つかりませんでした');
        return;
      }

      setIsImporting(true);
      await importInBatches(meaningfulRows);
      toast.success(`${meaningfulRows.length} 件のインポートが完了しました`);
      setLastImportCount(meaningfulRows.length);

      setHeaders([]);
      setRows([]);
      setAllRows([]);
      setMap(createEmptyMap());
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.message === 'AUTH') {
          toast.error('セッションの有効期限が切れています。再度ログインしてからやり直してください。');
          return;
        }
        if (e.message === 'FORBIDDEN') {
          toast.error('CSVインポートは管理者またはCS権限のユーザーのみ利用できます。');
          return;
        }
        toast.error(`インポートエラー: ${e.message}`);
        return;
      }
      toast.error(`インポートエラー: ${String(e)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const mappedFields = DB_FIELDS.filter((field) => Boolean(map[field.key]));

  return (
    <div className="space-y-8">
      <Card className="border-none shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">STEP 1</Badge>
              <CardTitle>CSVファイルをアップロード</CardTitle>
            </div>
            <CardDescription className="leading-relaxed text-slate-600">
              UTF-8 の CSV / TSV ファイルを読み込み、最初の行をヘッダーとして認識します。列名が空でも自動で列番号が割り当てられます。
            </CardDescription>
          </div>
          <UploadCloud className="h-6 w-6 text-purple-600" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="csv-file" className="text-sm font-semibold text-slate-700">
              CSVファイルを選択
            </Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={(event) => event.target.files && onFile(event.target.files[0])}
              className="mt-2"
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
                const selectedLabel = selected ? headerLookup[selected]?.label ?? '（不明な列）' : '未選択';
                const isMapped = Boolean(selected);

                return (
                  <div key={field.key} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                        <span className="text-xs text-slate-500">{isMapped ? selectedLabel : '未選択'}</span>
                      </div>
                      {isMapped ? (
                        <Badge variant="outline" className="border-green-300 bg-green-50 text-xs text-green-700">
                          選択済み
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-300 text-xs text-slate-500">
                          未設定
                        </Badge>
                      )}
                    </div>

                    <Select
                      value={selected ?? undefined}
                      onValueChange={(value) => {
                        setMap((prev) => {
                          if (value === '__CLEAR__') {
                            const next = { ...prev };
                            next[field.key] = undefined;
                            return next;
                          }
                          return { ...prev, [field.key]: value };
                        });
                      }}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="（単一列を選択）" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900">
                        <SelectItem value="__CLEAR__">（選択解除）</SelectItem>
                        {headers.map((header) => {
                          const trimmedRaw = header.raw.trim();
                          return (
                            <SelectItem key={header.id} value={header.id}>
                              {header.label}
                              {trimmedRaw.length > 0 && trimmedRaw !== header.label ? `（${header.raw}）` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {FIELD_HINTS[field.key] && (
                      <p className="text-xs text-slate-500">
                        利用可能な値: <span className="font-medium text-slate-600">{FIELD_HINTS[field.key]}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
                    {mappedFields.map((field) => (
                      <th key={field.key} className="border border-slate-200 px-3 py-2">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {mappedFields.map((field) => {
                        const mapping = map[field.key];
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
                          <td key={field.key} className="border border-slate-200 px-3 py-2 text-sm text-slate-700">
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
              <div className="mt-3 text-sm text-slate-500">...他 {rows.length - 5} 行</div>
            )}
          </CardContent>
        </Card>
      )}

      {headers.length > 0 && (
        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">STEP 4</Badge>
                <CardTitle>インポートを実行</CardTitle>
              </div>
              <CardDescription className="text-slate-600">
                インポート後は割り当てられていないEVAに対して CS を設定できます。
              </CardDescription>
            </div>
            <ShieldAlert className="h-6 w-6 text-purple-600" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>インポートを実行するには管理者または CS 権限のアカウントでログインしている必要があります。</p>
            </div>

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
