/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Product` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "itemId" TEXT NOT NULL PRIMARY KEY,
    "productName" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "coloursJson" TEXT NOT NULL DEFAULT '[]',
    "colourCount" INTEGER NOT NULL DEFAULT 0,
    "imageBase64" TEXT,
    "imageMimeType" TEXT,
    "link" TEXT,
    "depth" REAL,
    "height" REAL,
    "width" REAL
);
INSERT INTO "new_Product" ("category", "colourCount", "coloursJson", "depth", "height", "itemId", "link", "priceCents", "productName", "width") SELECT "category", "colourCount", "coloursJson", "depth", "height", "itemId", "link", "priceCents", "productName", "width" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
