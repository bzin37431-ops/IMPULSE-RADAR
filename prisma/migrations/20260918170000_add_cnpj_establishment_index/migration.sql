CREATE TABLE "CnpjEstablishmentIndex" (
    "cnpj" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "normalizedBusinessName" TEXT NOT NULL,
    "tradeName" TEXT,
    "normalizedTradeName" TEXT,
    "status" TEXT NOT NULL,
    "cnae" TEXT,
    "street" TEXT,
    "number" TEXT,
    "district" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CnpjEstablishmentIndex_pkey" PRIMARY KEY ("cnpj")
);
CREATE INDEX "CnpjEstablishmentIndex_normalizedTradeName_idx" ON "CnpjEstablishmentIndex"("normalizedTradeName");
CREATE INDEX "CnpjEstablishmentIndex_normalizedBusinessName_idx" ON "CnpjEstablishmentIndex"("normalizedBusinessName");
CREATE INDEX "CnpjEstablishmentIndex_city_state_idx" ON "CnpjEstablishmentIndex"("city", "state");
CREATE INDEX "CnpjEstablishmentIndex_postalCode_idx" ON "CnpjEstablishmentIndex"("postalCode");
CREATE INDEX "CnpjEstablishmentIndex_cnae_idx" ON "CnpjEstablishmentIndex"("cnae");
