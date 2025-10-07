-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CS');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('TIER1', 'TIER2');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Innovator" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requiresIntroduction" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Innovator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evangelists" (
    "id" TEXT NOT NULL,
    "recordId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "contactPref" TEXT,
    "strengths" TEXT,
    "notes" TEXT,
    "tier" "Tier" NOT NULL DEFAULT 'TIER2',
    "assignedCsId" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evangelists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "evangelistId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFirst" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "nextActions" TEXT,
    "contactMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Innovator_email_key" ON "Innovator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "evangelists_recordId_key" ON "evangelists"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "evangelists_email_key" ON "evangelists"("email");

-- AddForeignKey
ALTER TABLE "evangelists" ADD CONSTRAINT "evangelists_assignedCsId_fkey" FOREIGN KEY ("assignedCsId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_evangelistId_fkey" FOREIGN KEY ("evangelistId") REFERENCES "evangelists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
