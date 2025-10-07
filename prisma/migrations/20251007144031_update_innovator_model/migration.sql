/*
  Warnings:

  - The primary key for the `Innovator` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `required` on the `Innovator` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Innovator` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `company` to the `Innovator` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `Innovator` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position` to the `Innovator` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Innovator" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requiresIntroduction" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Innovator" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Innovator";
DROP TABLE "Innovator";
ALTER TABLE "new_Innovator" RENAME TO "Innovator";
CREATE UNIQUE INDEX "Innovator_email_key" ON "Innovator"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
