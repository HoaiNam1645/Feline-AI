CREATE TABLE "ProductVisualProfile" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "productStyle" TEXT,
    "productBrand" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageChecksum" TEXT NOT NULL,
    "descriptor" JSONB NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVisualProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVisualProfile_productId_key" ON "ProductVisualProfile"("productId");
CREATE INDEX "ProductVisualProfile_updatedAt_idx" ON "ProductVisualProfile"("updatedAt");
