/*
  Warnings:

  - You are about to drop the column `selectedLine` on the `ChallengeSubmission` table. All the data in the column will be lost.
  - Added the required column `selectedLines` to the `ChallengeSubmission` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChallengeSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userName" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "selectedLines" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ChallengeSubmission" ("challengeId", "correct", "createdAt", "id", "userName") SELECT "challengeId", "correct", "createdAt", "id", "userName" FROM "ChallengeSubmission";
DROP TABLE "ChallengeSubmission";
ALTER TABLE "new_ChallengeSubmission" RENAME TO "ChallengeSubmission";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
