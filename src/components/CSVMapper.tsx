'use client';
import Papa from 'papaparse';
import { useState, useCallback, useMemo } from 'react';
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

type HeaderInfo = {
  id: string;
  label: string;
  raw: string;
  index: number;
};

type CsvRow = string[];
const BATCH_SIZE = 500;

export default function CSVMapper() {
  const [headers, setHeaders] = useState<HeaderInfo[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [map, setMap] = useState<Record<string, string | string[]>>({});
  const [isImporting, setIsImporting] = useState(false);

  const headerLookup = useMemo(() => {
    return headers.reduce<Record<string, HeaderInfo>>((acc, header) => {
      acc[header.id] = header;
      return acc;
    }, {});
  }, [headers]);

  const onFile = useCallback((file: File) => {
    try {
      Papa.parse<(string | number | boolean | null)[]>(file, {
        header: false,
        worker: true,
        skipEmptyLines: 'greedy',
        complete: (res) => {
          try {
            const parsedRows = (res.data ?? []).filter((row): row is (string | number | boolean | null)[] => Array.isArray(row));
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
            setMap({});
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
      DB_FIELDS.forEach((f) => {
        const mapping = map[f.key];
        if (!mapping || (typeof mapping === 'string' && mapping.length === 0)) return;

        if (Array.isArray(mapping)) {
          const values = mapping
            .map((id) => {
              const header = headerLookup[id];
              if (!header) return '';
              return row[header.index] ?? '';
            })
            .filter((value) => value && value.length > 0);

          if (values.length === 0) return;

          if (f.key === 'tags') {
            const tags = values
              .flatMap((value) => value.split(',').map((tag) => tag.trim()))
              .filter((tag) => tag.length > 0);
            obj[f.key] = Array.from(new Set(tags));
          } else {
            obj[f.key] = values.join(' ');
          }
        } else {
          const header = headerLookup[mapping];
          if (!header) return;
          const value = row[header.index] ?? '';
          if (f.key === 'tags') {
            obj[f.key] = value
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0);
          } else {
            obj[f.key] = value;
          }
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
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast.error(`インポートエラー: ${errorMessage}`);
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
              {DB_FIELDS.map((field) => {
                const selected = map[field.key];
                const selectedLabel = Array.isArray(selected)
                  ? selected
                      .map((id) => headerLookup[id]?.label ?? '（不明な列）')
                      .join(', ')
                  : (typeof selected === 'string' && selected.length > 0)
                    ? headerLookup[selected]?.label ?? '（不明な列）'
                    : '未選択';

                return (
                  <div key={field.key} className="p-4 border rounded-lg space-y-3">
                    <div className="font-medium">
                      {field.label} → {selectedLabel}
                    </div>

                    <Select
                      value={Array.isArray(selected) ? '' : (typeof selected === 'string' ? selected : '')}
                      onValueChange={(value) => {
                        setMap((prev) => {
                          if (!value) {
                            const next = { ...prev };
                            delete next[field.key];
                            return next;
                          }
                          return { ...prev, [field.key]: value };
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="（単一列を選択）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">（選択なし）</SelectItem>
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

                    {field.key === 'tags' && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-muted-foreground">
                          タグに使う列を複数選択
                        </summary>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {headers.map((header) => {
                            const isChecked = Array.isArray(map.tags) && (map.tags as string[]).includes(header.id);
                            return (
                              <label key={header.id} className="text-sm flex items-center space-x-1">
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
                    {DB_FIELDS.filter((field) => map[field.key] && (!Array.isArray(map[field.key]) || (map[field.key] as string[]).length > 0)).map((field) => (
                      <th key={field.key} className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {DB_FIELDS.filter((field) => map[field.key] && (!Array.isArray(map[field.key]) || (map[field.key] as string[]).length > 0)).map((field) => {
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
                          <td key={field.key} className="border border-gray-300 px-2 py-1 text-sm">
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
