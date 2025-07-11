/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `LeaderboardUser` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardUser_name_key" ON "LeaderboardUser"("name");
