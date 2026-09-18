CREATE TABLE "CnpjCompanyIndex" (
    "cnpjBasic" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CnpjCompanyIndex_pkey" PRIMARY KEY ("cnpjBasic")
);
CREATE TABLE "CnpjCnaeIndex" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CnpjCnaeIndex_pkey" PRIMARY KEY ("code")
);
CREATE TABLE "CnpjImportMetadata" (
    "id" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "datasetImportedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "establishmentCount" INTEGER NOT NULL DEFAULT 0,
    "ufs" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CnpjImportMetadata_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CnpjEstablishmentIndex"
  ADD COLUMN "cnpjBasic" TEXT,
  ADD COLUMN "cnpjOrder" TEXT,
  ADD COLUMN "cnpjDv" TEXT,
  ADD COLUMN "branchType" TEXT,
  ADD COLUMN "cnaeSecondary" TEXT,
  ADD COLUMN "complement" TEXT;
