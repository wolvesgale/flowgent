import { PrismaClient } from '@prisma/client'

// 既定：本番の正とする接続（Vercel の DATABASE_URL）
function normalizeEnv() {
  if (!process.env.DATABASE_URL && process.env.PRISMA_DATABASE_URL) {
    // 保険：もし DATABASE_URL が無いが PRISMA_DATABASE_URL だけあるならコピー
    process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL
  }
}
normalizeEnv()

declare global {
  var prismaMain: PrismaClient | undefined
  // 追加：サルベージ用のソース DB（SOURCE_DATABASE_URL）に接続
  var prismaSource: PrismaClient | undefined
}

export const prisma =
  global.prismaMain ??
  new PrismaClient({ log: ['warn', 'error'] })

// SOURCE_DATABASE_URL があれば「読み取り専用ソース」として別クライアントを用意
export const prismaSource =
  global.prismaSource ??
  (process.env.SOURCE_DATABASE_URL
    ? new PrismaClient({
        log: ['warn', 'error'],
        datasourceUrl: process.env.SOURCE_DATABASE_URL,
      })
    : undefined)

if (process.env.NODE_ENV !== 'production') {
  global.prismaMain = prisma
  if (prismaSource) global.prismaSource = prismaSource
}
