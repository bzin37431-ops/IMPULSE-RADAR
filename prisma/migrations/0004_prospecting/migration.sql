CREATE TYPE "ProspectingSearchStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ProspectSourceMode" AS ENUM ('PRINCIPAL', 'ALTERNATIVA', 'AMPLIADA');
CREATE TYPE "ProspectDigitalStatus" AS ENUM ('UNKNOWN', 'NO_WEBSITE_FOUND', 'SOCIAL_ONLY', 'HAS_WEBSITE');
CREATE TYPE "ProspectCoverageMode" AS ENUM ('STRICT', 'INTELLIGENT', 'BROAD');
CREATE TABLE "ProspectingSearch" (
  "id" TEXT NOT NULL, "userId" TEXT, "state" TEXT NOT NULL, "city" TEXT NOT NULL, "district" TEXT,
  "niche" TEXT NOT NULL, "sourceMode" "ProspectSourceMode" NOT NULL, "digitalStatus" "ProspectDigitalStatus" NOT NULL,
  "minScore" INTEGER NOT NULL DEFAULT 0, "quantity" INTEGER NOT NULL, "coverageMode" "ProspectCoverageMode" NOT NULL DEFAULT 'INTELLIGENT',
  "status" "ProspectingSearchStatus" NOT NULL DEFAULT 'QUEUED', "progress" INTEGER NOT NULL DEFAULT 0,
  "providersConsulted" INTEGER NOT NULL DEFAULT 0, "uniqueResults" INTEGER NOT NULL DEFAULT 0, "noWebsiteCount" INTEGER NOT NULL DEFAULT 0,
  "socialOnlyCount" INTEGER NOT NULL DEFAULT 0, "websiteCount" INTEGER NOT NULL DEFAULT 0, "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3), "resultsCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProspectingSearch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProspectBusiness" (
  "id" TEXT NOT NULL, "searchId" TEXT NOT NULL, "externalIds" JSONB, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL,
  "category" TEXT, "phone" TEXT, "normalizedPhone" TEXT, "whatsapp" TEXT, "email" TEXT, "instagram" TEXT, "facebook" TEXT,
  "tiktok" TEXT, "linkedin" TEXT, "website" TEXT, "domain" TEXT, "mapsUrl" TEXT, "address" TEXT, "district" TEXT,
  "city" TEXT NOT NULL, "state" TEXT NOT NULL, "postalCode" TEXT, "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
  "rating" DOUBLE PRECISION, "reviewsCount" INTEGER, "digitalStatus" "ProspectDigitalStatus" NOT NULL DEFAULT 'UNKNOWN',
  "digitalStatusConfidence" TEXT NOT NULL DEFAULT 'LOW', "opportunityScore" INTEGER NOT NULL DEFAULT 0, "scoreBreakdown" JSONB,
  "sourceProviders" JSONB, "favorite" BOOLEAN NOT NULL DEFAULT false, "discarded" BOOLEAN NOT NULL DEFAULT false, "discardReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "verifiedAt" TIMESTAMP(3),
  CONSTRAINT "ProspectBusiness_pkey" PRIMARY KEY ("id"), CONSTRAINT "ProspectBusiness_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "ProspectingSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ProviderResult" (
  "id" TEXT NOT NULL, "searchId" TEXT NOT NULL, "provider" TEXT NOT NULL, "externalId" TEXT, "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProviderResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "ProspectingSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProspectingSearch_status_createdAt_idx" ON "ProspectingSearch"("status", "createdAt");
CREATE INDEX "ProspectBusiness_normalizedName_city_state_idx" ON "ProspectBusiness"("normalizedName", "city", "state");
CREATE INDEX "ProspectBusiness_normalizedPhone_idx" ON "ProspectBusiness"("normalizedPhone");
CREATE INDEX "ProspectBusiness_domain_idx" ON "ProspectBusiness"("domain");
CREATE INDEX "ProviderResult_searchId_provider_idx" ON "ProviderResult"("searchId", "provider");
