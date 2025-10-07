"use client";
import Papa from "papaparse";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DB_FIELDS = [
  { key: "recordId", label: "レコードID" },
  { key: "firstName", label: "名" },
  { key: "lastName", label: "姓" },
  { key: "email", label: "Eメール" },
  { key: "contactPref", label: "連絡手段" },
  { key: "tags", label: "タグ（複数可）" },
  { key: "notes", label: "ノート" },
  { key: "strengths", label: "強み・スキル" },
  { key: "tier", label: "ティア" },
];

// 追加の型
type CsvRow = Record<string, string | undefined>;

export default function CSVMapper() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [map, setMap] = useState<Record<string, string | string[]>>({});
  const [isImporting, setIsImporting] = useState(false);

  const onFile = (f: File) => {
    Papa.parse<CsvRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data ?? [];
        setRows(data.slice(0, 200)); // 最初の200行のみ表示
        setHeaders(res.meta.fields || []);
        toast.success(`CSVファイルを読み込みました（${data.length}行）`);
      },
      error: (error) => {
        toast.error(`CSVファイルの読み込みに失敗しました: ${error.message}`);
      }
    });
  };

  const buildPayload = () => {
    return rows.map(r => {
      const obj: Record<string, unknown> = {};
      for (const f of DB_FIELDS) {
        const m = map[f.key];
        if (!m) continue;
        if (Array.isArray(m)) {
          obj[f.key] = m.map(h => (r[h] ?? '').trim()).filter(Boolean);
        } else {
          obj[f.key] = (r[m] ?? '').trim();
        }
      }
      return obj;
    });
  };

  const importNow = async () => {
    if (rows.length === 0) {
      toast.error("CSVファイルを選択してください");
      return;
    }

    setIsImporting(true);
    try {
      const payload = buildPayload();
      const res = await fetch("/api/evangelists/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: payload })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Import failed");
      }

      const result = await res.json();
      toast.success(`インポートが完了しました（${result.count}件）`);
      
      // リセット
      setHeaders([]);
      setRows([]);
      setMap({});
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error instanceof Error ? error.message : "インポートに失敗しました");
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
            
            {rows.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {rows.length}行のデータが読み込まれました（最初の200行を表示）
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
            onClick={importNow} 
            disabled={isImporting || rows.length === 0}
            size="lg"
          >
            {isImporting ? "インポート中..." : "インポート"}
          </Button>
        </div>
      )}
    </div>
  );
}