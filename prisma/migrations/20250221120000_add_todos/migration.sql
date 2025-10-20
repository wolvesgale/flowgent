CREATE TABLE "Todo" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "dueOn" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assigneeId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Todo"
  ADD CONSTRAINT "Todo_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Todo"
  ADD CONSTRAINT "Todo_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Todo_assigneeId_status_dueOn_idx"
  ON "Todo"("assigneeId", "status", "dueOn");
