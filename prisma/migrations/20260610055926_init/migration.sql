-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('MASTER', 'SUBSCRIBER');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('DISCONNECTED', 'PROVISIONING', 'CONNECTED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "subscriptionStatus" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metaApiAccountId" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyStrategy" (
    "id" TEXT NOT NULL,
    "masterAccountId" TEXT NOT NULL,
    "metaApiStrategyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategySubscription" (
    "id" TEXT NOT NULL,
    "subscriberAccountId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "metaApiSubscriberId" TEXT NOT NULL,
    "riskMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "mpesaReceipt" TEXT,
    "status" TEXT NOT NULL,
    "merchantRequestID" TEXT NOT NULL,
    "checkoutRequestID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TradingAccount_metaApiAccountId_key" ON "TradingAccount"("metaApiAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CopyStrategy_masterAccountId_key" ON "CopyStrategy"("masterAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CopyStrategy_metaApiStrategyId_key" ON "CopyStrategy"("metaApiStrategyId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategySubscription_metaApiSubscriberId_key" ON "StrategySubscription"("metaApiSubscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategySubscription_subscriberAccountId_strategyId_key" ON "StrategySubscription"("subscriberAccountId", "strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_mpesaReceipt_key" ON "Payment"("mpesaReceipt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_merchantRequestID_key" ON "Payment"("merchantRequestID");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_checkoutRequestID_key" ON "Payment"("checkoutRequestID");

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyStrategy" ADD CONSTRAINT "CopyStrategy_masterAccountId_fkey" FOREIGN KEY ("masterAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategySubscription" ADD CONSTRAINT "StrategySubscription_subscriberAccountId_fkey" FOREIGN KEY ("subscriberAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategySubscription" ADD CONSTRAINT "StrategySubscription_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "CopyStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
