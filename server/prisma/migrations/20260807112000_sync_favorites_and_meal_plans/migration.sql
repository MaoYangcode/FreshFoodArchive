ALTER TABLE `FavoriteRecipe`
  ADD COLUMN `snapshot` JSON NULL,
  ADD COLUMN `completedCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastCompletedAt` DATETIME(3) NULL,
  ADD COLUMN `favoritedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE TABLE `MealPlan` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `clientId` VARCHAR(128) NULL,
  `date` VARCHAR(10) NOT NULL,
  `meal` VARCHAR(20) NOT NULL DEFAULT 'dinner',
  `servings` INTEGER NOT NULL DEFAULT 1,
  `recipeName` VARCHAR(191) NOT NULL,
  `duration` INTEGER NOT NULL DEFAULT 0,
  `difficulty` VARCHAR(191) NULL,
  `recipeSnapshot` JSON NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MealPlan_userId_clientId_key`(`userId`, `clientId`),
  INDEX `MealPlan_userId_date_meal_idx`(`userId`, `date`, `meal`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MealPlan_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
