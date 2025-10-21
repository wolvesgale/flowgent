-- CreateTable
CREATE TABLE "RequiredIntroductionRule" (
    "id" TEXT NOT NULL,
    "innovatorId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "tiers" TEXT,
    "strengths" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequiredIntroductionRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RequiredIntroductionRule"
ADD CONSTRAINT "RequiredIntroductionRule_innovatorId_fkey" FOREIGN KEY ("innovatorId") REFERENCES "Innovator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
