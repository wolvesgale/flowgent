'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface CSVRow {
  [key: string]: string
}

interface ColumnMapping {
  csvColumn: string
  dbField: string
  required: boolean
}

interface CSVPreviewProps {
  onImport: (data: CSVRow[], mapping: ColumnMapping[]) => Promise<void>
}

const DB_FIELDS = [
  { key: 'name', label: '氏名', required: true },
  { key: 'email', label: 'メールアドレス', required: true },
  { key: 'phone', label: '電話番号', required: false },
  { key: 'company', label: '会社名', required: false },
  { key: 'position', label: '役職', required: false },
  { key: 'industry', label: '業界', required: false },
  { key: 'experience', label: '経験年数', required: false },
  { key: 'skills', label: 'スキル', required: false },
  { key: 'notes', label: '備考', required: false },
]

export default function CSVPreview({ onImport }: CSVPreviewProps) {
  const [csvData, setCsvData] = useState<CSVRow[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('CSVファイルを選択してください')
      return
    }

    setFileName(file.name)
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          setError('CSVファイルにデータが含まれていません')
          return
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
          const row: CSVRow = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          return row
        })

        setCsvHeaders(headers)
        setCsvData(rows)
        
        // 初期マッピングを設定
        const initialMapping: ColumnMapping[] = DB_FIELDS.map(field => ({
          csvColumn: '',
          dbField: field.key,
          required: field.required
        }))
        setMapping(initialMapping)
      } catch {
        setError('CSVファイルの読み込みに失敗しました')
      }
    }
    reader.readAsText(file)
  }, [])

  const updateMapping = (dbField: string, csvColumn: string) => {
    setMapping(prev => prev.map(m => 
      m.dbField === dbField ? { ...m, csvColumn } : m
    ))
  }

  const validateMapping = (): boolean => {
    const requiredFields = mapping.filter(m => m.required)
    return requiredFields.every(field => field.csvColumn !== '')
  }

  const handleImport = async () => {
    if (!validateMapping()) {
      setError('必須フィールドのマッピングを完了してください')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await onImport(csvData, mapping)
    } catch {
      setError('インポートに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const getMappedFieldsCount = () => {
    return mapping.filter(m => m.csvColumn !== '').length
  }

  const getRequiredFieldsCount = () => {
    return mapping.filter(m => m.required && m.csvColumn !== '').length
  }

  const getTotalRequiredFields = () => {
    return mapping.filter(m => m.required).length
  }

  return (
    <div className="space-y-6">
      {/* ファイルアップロード */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSVファイルアップロード
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                CSVファイルを選択
              </p>
              <p className="text-sm text-gray-500">
                クリックしてファイルを選択してください
              </p>
            </label>
          </div>
          {fileName && (
            <div className="mt-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">{fileName}</span>
              <Badge variant="secondary">{csvData.length}行</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* エラー表示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* CSVプレビューとマッピング */}
      {csvData.length > 0 && (
        <>
          {/* マッピング設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>フィールドマッピング</span>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {getMappedFieldsCount()}/{DB_FIELDS.length} マッピング済み
                  </Badge>
                  <Badge variant={getRequiredFieldsCount() === getTotalRequiredFields() ? "default" : "destructive"}>
                    {getRequiredFieldsCount()}/{getTotalRequiredFields()} 必須フィールド
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mapping.map((field) => {
                  const dbFieldInfo = DB_FIELDS.find(f => f.key === field.dbField)
                  return (
                    <div key={field.dbField} className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        {dbFieldInfo?.label}
                        {field.required && <Badge variant="destructive" className="text-xs">必須</Badge>}
                      </label>
                      <Select
                        value={field.csvColumn === '' ? undefined : field.csvColumn}
                        onValueChange={(value: string) =>
                          updateMapping(field.dbField, value === '__CLEAR__' ? '' : value)
                        }
                      >
                        <SelectTrigger className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                          <SelectValue placeholder="CSVの列を選択" />
                        </SelectTrigger>
                        <SelectContent className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400">
                          <SelectItem value="__CLEAR__">選択しない</SelectItem>
                          {csvHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* CSVプレビュー */}
          <Card>
            <CardHeader>
              <CardTitle>データプレビュー（最初の5行）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      {csvHeaders.map((header) => (
                        <th key={header} className="border border-gray-300 px-4 py-2 text-left text-sm font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {csvHeaders.map((header) => (
                          <td key={header} className="border border-gray-300 px-4 py-2 text-sm">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.length > 5 && (
                <p className="text-sm text-gray-500 mt-2">
                  他 {csvData.length - 5} 行のデータがあります
                </p>
              )}
            </CardContent>
          </Card>

          {/* インポートボタン */}
          <div className="flex justify-end">
            <Button
              onClick={handleImport}
              disabled={!validateMapping() || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  インポート中...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {csvData.length}件をインポート
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}