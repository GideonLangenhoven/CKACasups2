-- AlterTable: Simplify PaymentBreakdown to only track cash and additional sales
ALTER TABLE "PaymentBreakdown" DROP COLUMN "creditCards",
DROP COLUMN "onlineEFTs",
DROP COLUMN "vouchers",
DROP COLUMN "members",
DROP COLUMN "agentsToInvoice",
DROP COLUMN "waterPhoneSunblock",
DROP COLUMN "discountsTotal";

-- AlterTable: Add new fields for phone pouches, water, and sunglasses sales
ALTER TABLE "PaymentBreakdown" ADD COLUMN "phonePouches" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "waterSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "sunglassesSales" DECIMAL(10,2) NOT NULL DEFAULT 0;
