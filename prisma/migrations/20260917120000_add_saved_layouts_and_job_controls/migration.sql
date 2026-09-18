-- Safe additive migration: preserves all existing prospecting and CRM data.
CREATE TYPE "SavedLayoutCommercialStatus" AS ENUM ('NOVO', 'PARA_ABORDAR', 'ABORDADO', 'AGUARDANDO_RESPOSTA', 'INTERESSADO', 'PROPOSTA', 'FECHADO', 'DESCARTADO');

ALTER TYPE "ProspectingSearchStatus" ADD VALUE 'INTERRUPTED';

ALTER TABLE "ProspectingSearch"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3);

CREATE TABLE "SavedLayout" (
  "id" TEXT NOT NULL,
  "prospectBusinessId" TEXT NOT NULL,
  "searchId" TEXT NOT NULL,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "savedBy" TEXT,
  "commercialStatus" "SavedLayoutCommercialStatus" NOT NULL DEFAULT 'NOVO',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedLayout_prospectBusinessId_key" ON "SavedLayout"("prospectBusinessId");
CREATE INDEX "SavedLayout_commercialStatus_updatedAt_idx" ON "SavedLayout"("commercialStatus", "updatedAt");
CREATE UNIQUE INDEX "ProspectingSearch_userId_idempotencyKey_key" ON "ProspectingSearch"("userId", "idempotencyKey");

ALTER TABLE "SavedLayout" ADD CONSTRAINT "SavedLayout_prospectBusinessId_fkey" FOREIGN KEY ("prospectBusinessId") REFERENCES "ProspectBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedLayout" ADD CONSTRAINT "SavedLayout_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "ProspectingSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
