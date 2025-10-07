-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_evangelists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "contactPref" TEXT,
    "strengths" TEXT,
    "notes" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'TIER2',
    "assignedCsId" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "evangelists_assignedCsId_fkey" FOREIGN KEY ("assignedCsId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_evangelists" ("assignedCsId", "contactPref", "createdAt", "email", "firstName", "id", "lastName", "notes", "recordId", "strengths", "tags", "tier", "updatedAt") SELECT "assignedCsId", "contactPref", "createdAt", "email", "firstName", "id", "lastName", "notes", "recordId", "strengths", "tags", "tier", "updatedAt" FROM "evangelists";
DROP TABLE "evangelists";
ALTER TABLE "new_evangelists" RENAME TO "evangelists";
CREATE UNIQUE INDEX "evangelists_recordId_key" ON "evangelists"("recordId");
CREATE UNIQUE INDEX "evangelists_email_key" ON "evangelists"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
