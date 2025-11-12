-- CreateEnum: ExceptionType for payment exceptions
CREATE TYPE "ExceptionType" AS ENUM ('CASH', 'CARD', 'EFT');

-- CreateTable: PaymentException for tracking cash/card/EFT payments taken by guides
CREATE TABLE "PaymentException" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "tripId" TEXT,
    "type" "ExceptionType" NOT NULL,
    "yocoRef" TEXT,
    "bankRef" TEXT,
    "amountHint" DECIMAL(10,2),
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentException_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CashHandover for tracking handover of payments to admin
CREATE TABLE "CashHandover" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedAmount" DECIMAL(10,2),
    "comment" TEXT,

    CONSTRAINT "CashHandover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentException_guideId_idx" ON "PaymentException"("guideId");

-- CreateIndex
CREATE INDEX "PaymentException_tripId_idx" ON "PaymentException"("tripId");

-- CreateIndex
CREATE INDEX "PaymentException_type_idx" ON "PaymentException"("type");

-- CreateIndex
CREATE INDEX "PaymentException_resolvedAt_idx" ON "PaymentException"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashHandover_exceptionId_key" ON "CashHandover"("exceptionId");

-- AddForeignKey
ALTER TABLE "PaymentException" ADD CONSTRAINT "PaymentException_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentException" ADD CONSTRAINT "PaymentException_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentException" ADD CONSTRAINT "PaymentException_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "PaymentException"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
