-- AlterTable
ALTER TABLE "evangelists"
  ADD COLUMN     "listProvided" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "nextAction" TEXT,
  ADD COLUMN     "nextActionDueOn" TIMESTAMP(3),
  ADD COLUMN     "managementPhase" TEXT;
