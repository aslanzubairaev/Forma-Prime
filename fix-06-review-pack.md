# Forma Prime Fix 06 Review Pack

Generated from the current workspace on 2026-06-13.

## 1. Full File Contents

### prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum Gender {
  MALE
  FEMALE
  OTHER
  UNSPECIFIED
}

enum ActivityLevel {
  SEDENTARY
  LIGHT
  MODERATE
  HIGH
}

enum GoalType {
  FAT_LOSS
  MAINTENANCE
  MUSCLE_GAIN
  RECOMPOSITION
}

enum FoodEntrySource {
  MANUAL
  AI_DRAFT
}

enum WorkoutSessionStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum BodyweightCheckinSource {
  MANUAL
  WEEKLY_CHECKIN
}

enum CheckinStatusLabel {
  ON_TRACK
  NEEDS_CONSISTENCY
  INSUFFICIENT_DATA
}

enum ReminderType {
  FOOD_LOG
  WORKOUT_LOG
  WEEKLY_CHECKIN
}

enum ConversationStep {
  IDLE
  ONBOARDING_LANGUAGE
  ONBOARDING_GENDER
  ONBOARDING_AGE
  ONBOARDING_HEIGHT
  ONBOARDING_WEIGHT
  ONBOARDING_ACTIVITY
  ONBOARDING_GOAL
  ONBOARDING_TRAINING_DAYS
  ONBOARDING_CONFIRMATION
  FOOD_ENTRY
  MEAL_EDIT
  MEAL_DELETE
  WORKOUT_ENTRY
  WORKOUT_EDIT
  WORKOUT_EDIT_EXERCISE
  WORKOUT_DELETE
  WEIGHT_ENTRY
  CHECKIN_WEIGHT
  CHECKIN_NUTRITION
  CHECKIN_TRAINING
  CHECKIN_ENERGY
  CHECKIN_NOTES
  REMINDER_TYPE
  REMINDER_ACTION
  REMINDER_WEEKDAY
  REMINDER_TIME
}

model User {
  id                 String                @id @default(cuid())
  telegramId         BigInt                @unique
  username           String?
  firstName          String?
  lastName           String?
  languageCode       String?
  timezone           String                @default("Europe/Paris")
  createdAt          DateTime              @default(now())
  updatedAt          DateTime              @updatedAt

  profile            Profile?
  nutritionTarget    NutritionTarget?
  customFoods        CustomFood[]
  learnedFoodCandidates LearnedFoodCandidate[]
  mealEntries        MealEntry[]
  foodEntries        FoodEntry[]
  workoutSplits      WorkoutSplit[]
  workoutSessions    WorkoutSession[]
  progressRules      ProgressRule[]
  bodyweightCheckins BodyweightCheckin[]
  weeklyCheckins     WeeklyCheckin[]
  reminderPreferences ReminderPreference[]
  conversationState  ConversationState?
}

model Profile {
  id                   String         @id @default(cuid())
  userId               String         @unique
  gender               Gender         @default(UNSPECIFIED)
  age                  Int?
  heightCm             Int?
  currentWeightKg      Decimal?       @db.Decimal(6, 2)
  activityLevel        ActivityLevel?
  goalType             GoalType?
  trainingDaysPerWeek  Int?
  preferredLanguage    String         @default("en")
  onboardingCompletedAt DateTime?
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  user                 User           @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model NutritionTarget {
  id                String   @id @default(cuid())
  userId            String   @unique
  caloriesTarget    Int      @default(0)
  proteinTargetG    Int      @default(0)
  fatTargetG        Int      @default(0)
  carbsTargetG      Int      @default(0)
  goalType          GoalType @default(MAINTENANCE)
  calculationMethod String   @default("MIFFLIN_ST_JEOR")
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model NutritionFood {
  id                 String                 @id @default(cuid())
  slug               String                 @unique
  nameRu             String
  nameEn             String
  category           String
  baseAmount         Int                    @default(100)
  baseUnit           String                 @default("g")
  caloriesPer100g    Decimal                @db.Decimal(8, 2)
  proteinPer100g     Decimal                @db.Decimal(8, 2)
  fatPer100g         Decimal                @db.Decimal(8, 2)
  carbsPer100g       Decimal                @db.Decimal(8, 2)
  sourceType         String?
  sourceName         String?
  sourceUrl          String?
  sourceUpdatedAt    DateTime?
  isVerified         Boolean                @default(false)
  isActive           Boolean                @default(true)
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  aliases            NutritionFoodAlias[]
  mealItems          MealEntryItem[]
}

model CustomFood {
  id                 String          @id @default(cuid())
  userId             String
  name               String
  normalizedName     String
  caloriesPer100g    Decimal         @db.Decimal(8, 2)
  proteinPer100g     Decimal         @db.Decimal(8, 2)
  fatPer100g         Decimal         @db.Decimal(8, 2)
  carbsPer100g       Decimal         @db.Decimal(8, 2)
  isActive           Boolean         @default(true)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  user               User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  mealItems          MealEntryItem[]

  @@unique([userId, normalizedName])
  @@index([userId, isActive])
}

model LearnedFoodCandidate {
  id                 String    @id @default(cuid())
  userId             String?
  rawInput           String
  normalizedInput    String
  canonicalName      String
  displayName        String
  category           String?
  servingGrams       Decimal?  @db.Decimal(10, 2)
  caloriesPer100g    Decimal   @db.Decimal(8, 2)
  proteinPer100g     Decimal   @db.Decimal(8, 2)
  fatPer100g         Decimal   @db.Decimal(8, 2)
  carbsPer100g       Decimal   @db.Decimal(8, 2)
  confidence         Decimal   @db.Decimal(4, 3)
  isEstimate         Boolean   @default(true)
  aliasesJson        Json
  source             String
  timesSeen          Int       @default(1)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  approvedAt         DateTime?
  rejectedAt         DateTime?

  user               User?     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, normalizedInput])
  @@index([normalizedInput])
  @@index([userId, normalizedInput])
  @@index([rejectedAt])
}

model NutritionFoodAlias {
  id                 String        @id @default(cuid())
  foodId             String
  alias              String
  languageCode       String
  normalizedAlias    String
  createdAt          DateTime      @default(now())

  food               NutritionFood @relation(fields: [foodId], references: [id], onDelete: Cascade)

  @@index([foodId])
  @@index([normalizedAlias])
}

model MealEntry {
  id                 String          @id @default(cuid())
  userId             String
  telegramUserId     BigInt
  consumedAt         DateTime        @default(now())
  rawText            String
  totalCalories      Decimal         @db.Decimal(10, 2)
  totalProteinG      Decimal         @db.Decimal(10, 2)
  totalFatG          Decimal         @db.Decimal(10, 2)
  totalCarbsG        Decimal         @db.Decimal(10, 2)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  user               User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  items              MealEntryItem[]

  @@index([userId, consumedAt])
}

model MealEntryItem {
  id                 String        @id @default(cuid())
  mealEntryId        String
  foodId             String?
  customFoodId       String?
  matchedName        String
  quantity           Decimal       @db.Decimal(10, 2)
  unit               String
  grams              Decimal       @db.Decimal(10, 2)
  calories           Decimal       @db.Decimal(10, 2)
  proteinG           Decimal       @db.Decimal(10, 2)
  fatG               Decimal       @db.Decimal(10, 2)
  carbsG             Decimal       @db.Decimal(10, 2)
  createdAt          DateTime      @default(now())

  mealEntry          MealEntry     @relation(fields: [mealEntryId], references: [id], onDelete: Cascade)
  food               NutritionFood? @relation(fields: [foodId], references: [id], onDelete: Restrict)
  customFood         CustomFood?   @relation(fields: [customFoodId], references: [id], onDelete: Restrict)

  @@index([mealEntryId])
  @@index([foodId])
  @@index([customFoodId])
}

model FoodEntry {
  id           String          @id @default(cuid())
  userId       String
  loggedAt     DateTime        @default(now())
  title        String
  calories     Int?
  proteinGrams Decimal?        @db.Decimal(8, 2)
  fatGrams     Decimal?        @db.Decimal(8, 2)
  carbGrams    Decimal?        @db.Decimal(8, 2)
  source       FoodEntrySource @default(MANUAL)
  rawText      String?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, loggedAt])
}

model WorkoutSplit {
  id        String       @id @default(cuid())
  userId    String
  name      String
  isActive  Boolean      @default(false)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  days      WorkoutDay[]

  @@index([userId])
}

model WorkoutDay {
  id             String       @id @default(cuid())
  workoutSplitId String
  name           String
  sortOrder      Int          @default(0)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  workoutSplit   WorkoutSplit @relation(fields: [workoutSplitId], references: [id], onDelete: Cascade)
  exercises      Exercise[]
  sessions       WorkoutSession[]

  @@index([workoutSplitId, sortOrder])
}

model Exercise {
  id           String        @id @default(cuid())
  workoutDayId String
  name         String
  sortOrder    Int           @default(0)
  targetSets   Int?
  targetReps   String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  workoutDay   WorkoutDay    @relation(fields: [workoutDayId], references: [id], onDelete: Cascade)
  exerciseLogs ExerciseLog[]
  progressRules ProgressRule[]

  @@index([workoutDayId, sortOrder])
}

model WorkoutSession {
  id          String               @id @default(cuid())
  userId      String
  workoutDayId String?
  startedAt   DateTime             @default(now())
  completedAt DateTime?
  status      WorkoutSessionStatus @default(PLANNED)
  notes       String?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  workoutDay  WorkoutDay?          @relation(fields: [workoutDayId], references: [id], onDelete: SetNull)
  logs        ExerciseLog[]

  @@index([userId, startedAt])
  @@index([workoutDayId])
}

model ExerciseLog {
  id               String         @id @default(cuid())
  workoutSessionId String
  exerciseId       String?
  exerciseName     String
  setNumber        Int
  weightKg         Decimal?       @db.Decimal(8, 2)
  reps             Int?
  rpe              Decimal?       @db.Decimal(3, 1)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  workoutSession   WorkoutSession @relation(fields: [workoutSessionId], references: [id], onDelete: Cascade)
  exercise         Exercise?      @relation(fields: [exerciseId], references: [id], onDelete: SetNull)

  @@index([workoutSessionId])
  @@index([exerciseId])
}

model ProgressRule {
  id         String   @id @default(cuid())
  userId     String
  exerciseId String?
  name       String
  config     Json
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  exercise   Exercise? @relation(fields: [exerciseId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([exerciseId])
}

model BodyweightCheckin {
  id        String   @id @default(cuid())
  userId    String
  checkedAt DateTime @default(now())
  weightKg  Decimal  @db.Decimal(6, 2)
  source    BodyweightCheckinSource @default(MANUAL)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, checkedAt])
}

model WeeklyCheckin {
  id                  String             @id @default(cuid())
  userId              String
  weekStartDate       DateTime
  weightKg            Decimal            @db.Decimal(6, 2)
  nutritionAdherence  Int
  trainingAdherence   Int
  energy              Int
  notes               String?
  statusLabel         CheckinStatusLabel @default(INSUFFICIENT_DATA)
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  user                User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, weekStartDate])
}

model ReminderPreference {
  id          String       @id @default(cuid())
  userId      String
  type        ReminderType
  isEnabled   Boolean      @default(false)
  hourLocal   Int
  minuteLocal Int
  daysOfWeek  Int[]        @default([])
  lastSentAt  DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type])
  @@index([userId])
  @@index([isEnabled, hourLocal, minuteLocal])
}

model ConversationState {
  id        String           @id @default(cuid())
  userId    String           @unique
  step      ConversationStep @default(IDLE)
  payload   Json?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### src/nutrition/food-parser.ts

```ts
import { normalizeFoodText } from "./food-normalization.js";
import type { ParsedFoodItemCandidate } from "./food.types.js";

export type FoodLogParseResult = {
  items: ParsedFoodItemCandidate[];
  rejectedParts: string[];
};

const gramsUnitPattern = "(?:g|gr|gram|grams|г|гр|грамм|грамма|граммов)\\.?"
const leadingQuantityPattern = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*${gramsUnitPattern}\\s+(.+)$`,
  "iu",
);
const trailingQuantityPattern = new RegExp(
  `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${gramsUnitPattern}$`,
  "iu",
);
const embeddedQuantityPattern = new RegExp(
  `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${gramsUnitPattern}\\s+(.+)$`,
  "iu",
);
const servingQuantityPattern = /^(\d+(?:[.,]\d+)?)\s+(.+)$/iu;
const nutritionHintPattern = new RegExp(
  `^\\d+(?:[.,]\\d+)?\\s*${gramsUnitPattern}\\s+(?:белка|белок|protein)$`,
  "iu",
);

const conversationalWrapperWords = new Set([
  "сегодня",
  "ел",
  "ела",
  "съел",
  "съела",
  "пил",
  "пила",
  "выпил",
  "выпила",
  "покушал",
  "покушала",
  "съелa",
  "кушал",
  "кушала",
  "я",
]);

const numberWords: Record<string, number> = {
  один: 1,
  одна: 1,
  одно: 1,
  две: 2,
  два: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
};

const servingRules = [
  {
    terms: ["жарен", "жарё", "fried egg", "fried eggs"],
    normalizedLabel: "жареные яйца",
    unit: "piece",
    gramsPerServing: 50,
  },
  {
    terms: ["варен", "варё", "boiled egg", "boiled eggs"],
    normalizedLabel: "вареные яйца",
    unit: "piece",
    gramsPerServing: 50,
  },
  {
    terms: ["egg", "eggs", "яйцо", "яйца", "яиц", "яйцами"],
    normalizedLabel: "яйца",
    unit: "piece",
    gramsPerServing: 50,
  },
  {
    terms: ["protein bar", "протеиновый батончик", "протеиновый бар"],
    normalizedLabel: "протеиновый батончик",
    unit: "serving",
    gramsPerServing: 60,
  },
  {
    terms: [
      "protein",
      "scoop protein",
      "whey",
      "протеин",
      "протеина",
      "изолят",
      "изолята",
      "порция протеина",
      "порции протеина",
    ],
    normalizedLabel: "протеин",
    unit: "serving",
    gramsPerServing: 30,
  },
  {
    terms: ["батончик", "snack bar"],
    normalizedLabel: "батончик",
    unit: "serving",
    gramsPerServing: 50,
  },
  {
    terms: ["банан", "banana"],
    normalizedLabel: "банан",
    unit: "piece",
    gramsPerServing: 120,
  },
  {
    terms: ["яблок", "apple"],
    normalizedLabel: "яблоко",
    unit: "piece",
    gramsPerServing: 150,
  },
  {
    terms: ["кусок хлеб", "кусочка хлеб", "ломтик хлеб", "ломтика хлеб", "bread slice"],
    normalizedLabel: "хлеб",
    unit: "piece",
    gramsPerServing: 35,
  },
  {
    terms: ["лаваш", "lavash"],
    normalizedLabel: "лаваш",
    unit: "piece",
    gramsPerServing: 60,
  },
  {
    terms: ["тортилья", "тортильи", "tortilla"],
    normalizedLabel: "тортилья",
    unit: "piece",
    gramsPerServing: 60,
  },
] as const;

const quickMealRules = [
  {
    terms: ["протеиновый кофе", "кофе с протеином", "protein coffee"],
    normalizedLabel: "протеиновый кофе",
    grams: 330,
  },
  {
    terms: [
      "лаваш с курицей",
      "домашняя шаурма",
      "шаурма домашняя",
      "домашние шаурмы",
      "домашнюю шаурму",
      "chicken lavash wrap",
      "chicken wrap",
    ],
    normalizedLabel: "лаваш с курицей",
    grams: 250,
    isEstimate: true,
  },
  {
    terms: ["шаурма", "шаурмы", "шаурму", "shawarma"],
    normalizedLabel: "шаурма",
    grams: 350,
    isEstimate: true,
  },
  {
    terms: ["такос", "тако", "taco", "tacos"],
    normalizedLabel: "такос",
    grams: 180,
    isEstimate: true,
  },
  {
    terms: ["буррито", "burrito"],
    normalizedLabel: "буррито",
    grams: 350,
    isEstimate: true,
  },
  {
    terms: ["бутерброд", "бутерброда", "бутер", "сэндвич", "сэндвича", "sandwich"],
    normalizedLabel: "бутерброд",
    grams: 180,
    isEstimate: true,
  },
  {
    terms: ["рис с курицей", "курица с рисом", "chicken rice", "rice with chicken"],
    normalizedLabel: "рис с курицей",
    grams: 350,
    isEstimate: true,
  },
  {
    terms: ["паста с курицей", "макароны с курицей", "chicken pasta", "pasta with chicken"],
    normalizedLabel: "паста с курицей",
    grams: 350,
    isEstimate: true,
  },
  {
    terms: ["салат с курицей", "куриный салат", "chicken salad"],
    normalizedLabel: "салат с курицей",
    grams: 300,
    isEstimate: true,
  },
  {
    terms: ["протеиновый батончик", "протеиновый бар", "protein bar"],
    normalizedLabel: "протеиновый батончик",
    grams: 60,
  },
  {
    terms: ["кофе с молоком", "coffee with milk"],
    normalizedLabel: "кофе с молоком",
    grams: 250,
  },
  {
    terms: ["кофе", "coffee"],
    normalizedLabel: "кофе",
    grams: 200,
  },
  {
    terms: ["кола зеро", "cola zero", "coke zero", "zero cola"],
    normalizedLabel: "кола зеро",
    grams: 330,
  },
] as const;

export function parseFoodLogMessage(input: string): FoodLogParseResult {
  const ingredientSection = extractIngredientSection(input);

  if (ingredientSection) {
    return parseFoodLogMessage(ingredientSection);
  }

  const parts = splitFoodLogParts(input)
    .map((part) => part.trim())
    .filter(Boolean);

  const items: ParsedFoodItemCandidate[] = [];
  const rejectedParts: string[] = [];

  for (const part of parts) {
    if (isNutritionHintPart(part)) {
      if (items.length > 0) {
        continue;
      }

      rejectedParts.push(part);
      continue;
    }

    const parsed = parseFoodLogPart(part);

    if (parsed) {
      items.push(parsed);
    } else {
      rejectedParts.push(part);
    }
  }

  return {
    items,
    rejectedParts,
  };
}

function splitFoodLogParts(input: string): string[] {
  const parts: string[] = [];
  let current = "";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (char === ",") {
      const previous = input[index - 1] ?? "";
      const next = input[index + 1] ?? "";

      if (!isDigit(previous) || !isDigit(next)) {
        parts.push(current);
        current = "";
        continue;
      }
    }

    current += char;
  }

  parts.push(current);

  return parts
    .flatMap((part) => part.split(/\s*(?:[;\r\n]+|\+)\s*/u))
    .flatMap((part) => part.split(/\s+(?:and|и)\s+/iu));
}

function isDigit(value: string): boolean {
  return /^\d$/.test(value);
}

function parseFoodLogPart(part: string): ParsedFoodItemCandidate | null {
  const conversationalServing = buildConversationalServingParsedItem(part);

  if (conversationalServing) {
    return conversationalServing;
  }

  const quickMeal = buildQuickMealParsedItem(part);

  if (quickMeal) {
    return quickMeal;
  }

  const leadingMatch = part.match(leadingQuantityPattern);

  if (leadingMatch) {
    return buildParsedItem(leadingMatch[2], leadingMatch[1]);
  }

  const trailingMatch = part.match(trailingQuantityPattern);

  if (trailingMatch) {
    return buildParsedItem(trailingMatch[1], trailingMatch[2]);
  }

  const embeddedMatch = part.match(embeddedQuantityPattern);

  if (embeddedMatch) {
    return buildParsedItem(
      stripConversationalWrappers(
        [embeddedMatch[1], embeddedMatch[3]].filter(Boolean).join(" "),
      ),
      embeddedMatch[2],
    );
  }

  const servingMatch = part.match(servingQuantityPattern);

  if (servingMatch) {
    return buildServingParsedItem(servingMatch[2], servingMatch[1]);
  }

  return null;
}

function buildConversationalServingParsedItem(
  part: string,
): ParsedFoodItemCandidate | null {
  const label = part.trim();

  if (!label) {
    return null;
  }

  const normalizedLabel = normalizeFoodText(label);
  const strippedLabel = stripConversationalWrappers(normalizedLabel);

  if (isProteinCoffeeText(strippedLabel)) {
    return buildServingItem(label, "протеиновый кофе", 1, 330);
  }

  if (isCoffeeWithMilkText(strippedLabel)) {
    return buildServingItem(label, "кофе с молоком", 1, 250);
  }

  if (isPlainCoffeeText(strippedLabel)) {
    return buildServingItem(label, "кофе", 1, 200);
  }

  if (isProteinText(strippedLabel)) {
    const quantity = extractQuantityNearServingUnit(strippedLabel);

    if (quantity) {
      return buildServingItem(
        stripQuantityWords(strippedLabel),
        "протеин",
        quantity,
        quantity * 30,
      );
    }

    if (!extractAnyQuantity(strippedLabel)) {
      return buildServingItem(
        stripQuantityWords(strippedLabel),
        "протеин",
        1,
        30,
      );
    }
  }

  if (isEggText(strippedLabel)) {
    const quantity = extractAnyQuantity(strippedLabel);

    if (quantity) {
      const normalizedEggLabel = isFriedEggText(strippedLabel)
        ? "жареные яйца"
        : isBoiledEggText(strippedLabel)
          ? "вареные яйца"
          : "яйца";

      return {
        rawLabel: stripQuantityWords(strippedLabel),
        normalizedLabel: normalizedEggLabel,
        quantity,
        unit: "piece",
        grams: quantity * 50,
      };
    }
  }

  return null;
}

function buildQuickMealParsedItem(part: string): ParsedFoodItemCandidate | null {
  const label = part.trim();

  if (!label) {
    return null;
  }

  const normalizedLabel = normalizeFoodText(label);
  const strippedLabel = stripConversationalWrappers(normalizedLabel);
  const rule = findQuickMealRule(strippedLabel);

  if (!rule) {
    return null;
  }

  const quantity = extractAnyQuantity(strippedLabel) ?? 1;

  return {
    rawLabel: label,
    normalizedLabel: rule.normalizedLabel,
    quantity,
    unit: "serving",
    grams: quantity * rule.grams,
    ...("isEstimate" in rule && rule.isEstimate ? { isEstimate: true } : {}),
  };
}

function buildServingItem(
  rawLabel: string,
  normalizedLabel: string,
  quantity: number,
  grams: number,
): ParsedFoodItemCandidate {
  return {
    rawLabel,
    normalizedLabel,
    quantity,
    unit: "serving",
    grams,
  };
}

function buildParsedItem(
  rawLabel: string | undefined,
  rawQuantity: string | undefined,
): ParsedFoodItemCandidate | null {
  if (!rawLabel || !rawQuantity) {
    return null;
  }

  const quantity = Number(rawQuantity.replace(",", "."));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const label = rawLabel.trim();
  const strippedLabel = stripConversationalWrappers(label);

  if (!strippedLabel) {
    return null;
  }

  return {
    rawLabel: strippedLabel,
    normalizedLabel: normalizeFoodText(strippedLabel),
    quantity,
    unit: "g",
    grams: quantity,
  };
}

function buildServingParsedItem(
  rawLabel: string | undefined,
  rawQuantity: string | undefined,
): ParsedFoodItemCandidate | null {
  if (!rawLabel || !rawQuantity) {
    return null;
  }

  const quantity = Number(rawQuantity.replace(",", "."));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const label = rawLabel.trim();

  if (!label) {
    return null;
  }

  const normalizedLabel = normalizeFoodText(label);
  const rule = servingRules.find((candidate) =>
    candidate.terms.some((term) => normalizedLabel.includes(term)),
  );

  if (!rule) {
    return null;
  }

  return {
    rawLabel: label,
    normalizedLabel: rule.normalizedLabel,
    quantity,
    unit: rule.unit,
    grams: quantity * rule.gramsPerServing,
  };
}

function extractIngredientSection(input: string): string | null {
  const [prefix, ...rest] = input.split(":");

  if (!prefix || rest.length === 0) {
    return null;
  }

  const normalizedPrefix = stripConversationalWrappers(prefix);

  if (!findQuickMealRule(normalizedPrefix)) {
    return null;
  }

  const ingredientText = rest.join(":").trim();

  return ingredientText.length > 0 ? ingredientText : null;
}

function findQuickMealRule(value: string): (typeof quickMealRules)[number] | null {
  const strippedValue = stripQuantityWords(value);

  return (
    quickMealRules.find((candidate) =>
      candidate.terms.some((term) => {
        const normalizedTerm = normalizeFoodText(term);

        return (
          strippedValue === normalizedTerm ||
          isTokenSubsetMatch(strippedValue, normalizedTerm)
        );
      }),
    ) ?? null
  );
}

function stripConversationalWrappers(value: string): string {
  return normalizeFoodText(value)
    .split(" ")
    .filter((token) => !conversationalWrapperWords.has(token))
    .join(" ")
    .trim();
}

function isNutritionHintPart(part: string): boolean {
  return nutritionHintPattern.test(normalizeFoodText(part));
}

function isProteinText(value: string): boolean {
  return (
    value.includes("протеин") ||
    value.includes("изолят") ||
    /\b(?:protein|whey|isolate)\b/iu.test(value)
  );
}

function isProteinCoffeeText(value: string): boolean {
  return hasToken(value, "кофе") && isProteinText(value);
}

function isCoffeeWithMilkText(value: string): boolean {
  return hasToken(value, "кофе") && value.includes("молок");
}

function isPlainCoffeeText(value: string): boolean {
  return hasToken(value, "кофе") || /\bcoffee\b/iu.test(value);
}

function isEggText(value: string): boolean {
  return /(?:^|\s)я(?:й|и)ц/iu.test(value) || /\beggs?\b/iu.test(value);
}

function isFriedEggText(value: string): boolean {
  return value.includes("жарен") || value.includes("жарё") || value.includes("fried");
}

function isBoiledEggText(value: string): boolean {
  return value.includes("варен") || value.includes("варё") || value.includes("boiled");
}

function hasToken(value: string, token: string): boolean {
  return value.split(" ").includes(token);
}

function extractQuantityNearServingUnit(value: string): number | null {
  const tokens = value.split(" ");

  for (let index = 0; index < tokens.length; index += 1) {
    const quantity = parseQuantityToken(tokens[index] ?? "");

    if (!quantity) {
      continue;
    }

    const nearbyTokens = tokens.slice(index + 1, index + 4).join(" ");

    if (/(?:порци|ложк|scoop|serving)/iu.test(nearbyTokens)) {
      return quantity;
    }
  }

  return null;
}

function extractAnyQuantity(value: string): number | null {
  for (const token of value.split(" ")) {
    const quantity = parseQuantityToken(token);

    if (quantity) {
      return quantity;
    }
  }

  return null;
}

function parseQuantityToken(value: string): number | null {
  const normalizedValue = normalizeFoodText(value);

  if (/^\d+(?:[.,]\d+)?$/.test(normalizedValue)) {
    const quantity = Number(normalizedValue.replace(",", "."));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
  }

  return numberWords[normalizedValue] ?? null;
}

function stripQuantityWords(value: string): string {
  return value
    .split(" ")
    .filter(
      (token) =>
        !parseQuantityToken(token) &&
        !/^(?:шт|штук|штуки|штука)$/iu.test(token),
    )
    .join(" ")
    .trim();
}

function isTokenSubsetMatch(value: string, term: string): boolean {
  const valueTokens = getMeaningfulTokens(value);
  const termTokens = getMeaningfulTokens(term);

  if (valueTokens.length < 2 || termTokens.length < 2) {
    return false;
  }

  const valueTokenSet = new Set(valueTokens);
  const termTokenSet = new Set(termTokens);

  return (
    termTokens.every((token) => valueTokenSet.has(token)) ||
    valueTokens.every((token) => termTokenSet.has(token))
  );
}

function getMeaningfulTokens(value: string): string[] {
  return normalizeFoodText(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !parseQuantityToken(token) &&
        !/^(?:шт|штук|штуки|штука)$/iu.test(token),
    );
}
```

### src/nutrition/nutrition-calculator.ts

```ts
import type {
  CalculatedMeal,
  CalculatedMealItem,
  CalculatedMealTotals,
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "./food.types.js";

export function calculateMealItem(
  food: NutritionFoodRecord,
  parsedItem: ParsedFoodItemCandidate,
  matchedName: string,
): CalculatedMealItem {
  const multiplier = parsedItem.grams / 100;

  return {
    food,
    matchedName,
    rawLabel: parsedItem.rawLabel,
    quantity: parsedItem.quantity,
    unit: parsedItem.unit,
    grams: parsedItem.grams,
    ...(parsedItem.isEstimate ? { isEstimate: true } : {}),
    calories: toNumber(food.caloriesPer100g) * multiplier,
    proteinG: toNumber(food.proteinPer100g) * multiplier,
    fatG: toNumber(food.fatPer100g) * multiplier,
    carbsG: toNumber(food.carbsPer100g) * multiplier,
  };
}

export function calculateMeal(items: CalculatedMealItem[]): CalculatedMeal {
  return {
    items,
    totals: calculateTotals(items),
  };
}

function calculateTotals(items: CalculatedMealItem[]): CalculatedMealTotals {
  return items.reduce<CalculatedMealTotals>(
    (totals, item) => ({
      calories: totals.calories + item.calories,
      proteinG: totals.proteinG + item.proteinG,
      fatG: totals.fatG + item.fatG,
      carbsG: totals.carbsG + item.carbsG,
    }),
    {
      calories: 0,
      proteinG: 0,
      fatG: 0,
      carbsG: 0,
    },
  );
}

function toNumber(value: unknown): number {
  return Number(value);
}
```

### src/bot/food-logging.ts

```ts
import { ConversationStep } from "@prisma/client";
import { InlineKeyboard, type Bot, type Context, type NextFunction } from "grammy";

import {
  claimConversationStep,
  getConversationState,
  resetConversationState,
  setConversationState,
} from "../conversation/conversation-state.service.js";
import type { ConversationPayload } from "../conversation/conversation-state.types.js";
import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import {
  createMealEntry,
  deleteLatestMealEntry,
  getDailyNutritionSummary,
  getLatestMealEntry,
  getRecentFoods,
  quickRelogMeal,
  updateLatestMealEntry,
  type DailyNutritionSummary,
  type LatestMealEntry,
} from "../meals/meals.service.js";
import {
  type CalculatedMeal,
  type NutritionFoodRecord,
  type ParsedFoodItemCandidate,
  type RecentFood,
} from "../nutrition/food.types.js";
import {
  parseCustomFoodInput,
  upsertCustomFood,
} from "../nutrition/custom-food.service.js";
import { matchFoodCandidate } from "../nutrition/food-matcher.js";
import {
  resolveFoodFallback,
  resolveParsedFoodItemWithFallback,
} from "../nutrition/food-fallback-resolver.js";
import { parseFoodLogMessage } from "../nutrition/food-parser.js";
import { getActiveNutritionFoods } from "../nutrition/food.repository.js";
import { calculateMeal, calculateMealItem } from "../nutrition/nutrition-calculator.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../users/user.service.js";
import { beginOrResumeOnboarding } from "./onboarding.js";

type FoodEntryPayload = {
  rawText: string;
  parsedItems: ParsedFoodItemCandidate[];
  selectedFoodIdsByIndex: Record<string, string>;
};

const foodChoicePattern = /^food:choose:(\d+):(.+)$/;
const foodRelogPattern = /^food:relog:(.+)$/;
const lastMealEditPattern = /^lastmeal:edit:(.+)$/;
const lastMealDeletePattern = /^lastmeal:delete:(.+)$/;
const lastMealConfirmDeletePattern = /^lastmeal:confirm_delete:(.+)$/;
const lastMealCancelAction = "lastmeal:cancel";

export function registerFoodLoggingHandlers(bot: Bot): void {
  bot.command("lastmeal", handleLastMealCommand);
  bot.command("customfood", handleCustomFoodCommand);
  bot.command("recentfoods", handleRecentFoodsCommand);
  bot.callbackQuery(foodChoicePattern, handleFoodChoiceCallback);
  bot.callbackQuery(foodRelogPattern, handleFoodRelogCallback);
  bot.callbackQuery(lastMealEditPattern, handleLastMealEditCallback);
  bot.callbackQuery(lastMealDeletePattern, handleLastMealDeleteCallback);
  bot.callbackQuery(lastMealConfirmDeletePattern, handleLastMealConfirmDeleteCallback);
  bot.callbackQuery(lastMealCancelAction, handleLastMealCancelCallback);
  bot.on("message:text", handleFoodText);
}

export function formatDailyTotals(
  language: SupportedLanguage,
  dailySummary: DailyNutritionSummary,
): string {
  const { totals, targets } = dailySummary;

  if (!targets) {
    return [
      t(language, "today.title"),
      t(language, "today.noTargets"),
      formatMacroLine(language, totals),
    ].join("\n");
  }

  return [
    t(language, "today.title"),
    t(language, "today.calories", {
      current: Math.round(totals.calories),
      target: targets.caloriesTarget,
    }),
    t(language, "today.protein", {
      current: Math.round(totals.proteinG),
      target: targets.proteinTargetG,
    }),
    t(language, "today.fat", {
      current: Math.round(totals.fatG),
      target: targets.fatTargetG,
    }),
    t(language, "today.carbs", {
      current: Math.round(totals.carbsG),
      target: targets.carbsTargetG,
    }),
  ].join("\n");
}

async function handleFoodText(ctx: Context, next: NextFunction): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    await next();
    return;
  }

  const rawText = ctx.message.text.trim();

  if (rawText.startsWith("/")) {
    await next();
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );
  const state = await getConversationState(user.id);

  if (state.step === ConversationStep.MEAL_EDIT) {
    await handleMealEditText(ctx, user.id, BigInt(ctx.from.id), language, rawText, state.payload);
    return;
  }

  if (!profile?.onboardingCompletedAt) {
    await beginOrResumeOnboarding(ctx, user.id, language);
    return;
  }

  await processFoodLog(ctx, user.id, BigInt(ctx.from.id), rawText, language);
}

async function handleLastMealCommand(ctx: Context): Promise<void> {
  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  const meal = await getLatestMealEntry(identity.userId);

  if (!meal) {
    await ctx.reply(t(identity.language, "lastMeal.empty"));
    return;
  }

  await ctx.reply(formatLatestMeal(identity.language, meal), {
    reply_markup: lastMealKeyboard(identity.language, meal.id),
  });
}

async function handleCustomFoodCommand(ctx: Context): Promise<void> {
  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  const rawInput = getCommandArgument(ctx);

  if (!rawInput) {
    await ctx.reply(t(identity.language, "customFood.help"));
    return;
  }

  const parsed = parseCustomFoodInput(rawInput);

  if (parsed.status === "invalid") {
    await ctx.reply(t(identity.language, "customFood.invalid"));
    await ctx.reply(t(identity.language, "customFood.help"));
    return;
  }

  const food = await upsertCustomFood({
    userId: identity.userId,
    ...parsed.value,
  });

  await ctx.reply(t(identity.language, "customFood.saved", { name: food.name }));
}

async function handleRecentFoodsCommand(ctx: Context): Promise<void> {
  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  const recentFoods = await getRecentFoods(identity.userId);

  if (recentFoods.length === 0) {
    await ctx.reply(t(identity.language, "recentFoods.empty"));
    return;
  }

  await ctx.reply(formatRecentFoods(identity.language, recentFoods), {
    reply_markup: recentFoodsKeyboard(identity.language, recentFoods),
  });
}

async function handleLastMealEditCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getFoodIdentity(ctx);
  const mealEntryId = ctx.callbackQuery?.data?.match(lastMealEditPattern)?.[1];

  if (!identity || !mealEntryId) {
    return;
  }

  await setConversationState(identity.userId, ConversationStep.MEAL_EDIT, {
    mealEntryId,
  });
  await ctx.reply(t(identity.language, "lastMeal.editPrompt"));
}

async function handleLastMealDeleteCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getFoodIdentity(ctx);
  const mealEntryId = ctx.callbackQuery?.data?.match(lastMealDeletePattern)?.[1];

  if (!identity || !mealEntryId) {
    return;
  }

  await setConversationState(identity.userId, ConversationStep.MEAL_DELETE, {
    mealEntryId,
  });
  await ctx.reply(t(identity.language, "lastMeal.deleteConfirm"), {
    reply_markup: lastMealDeleteConfirmKeyboard(identity.language, mealEntryId),
  });
}

async function handleLastMealConfirmDeleteCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getFoodIdentity(ctx);
  const mealEntryId = ctx.callbackQuery?.data?.match(lastMealConfirmDeletePattern)?.[1];

  if (!identity || !mealEntryId) {
    return;
  }

  const state = await getConversationState(identity.userId);
  const payload = readLatestMealPayload(state.payload);

  if (state.step !== ConversationStep.MEAL_DELETE || payload?.mealEntryId !== mealEntryId) {
    await ctx.reply(t(identity.language, "lastMeal.expired"));
    return;
  }

  const claimed = await claimConversationStep(identity.userId, ConversationStep.MEAL_DELETE);

  if (!claimed) {
    await ctx.reply(t(identity.language, "lastMeal.expired"));
    return;
  }

  const deleted = await deleteLatestMealEntry({
    userId: identity.userId,
    mealEntryId,
  });

  await ctx.reply(
    deleted
      ? t(identity.language, "lastMeal.deleted")
      : t(identity.language, "lastMeal.expired"),
  );
}

async function handleLastMealCancelCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  await resetConversationState(identity.userId);
  await ctx.reply(t(identity.language, "lastMeal.cancelled"));
}

async function handleFoodChoiceCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );
  const state = await getConversationState(user.id);
  const callbackData = ctx.callbackQuery?.data;
  const match = callbackData?.match(foodChoicePattern);

  if (state.step !== ConversationStep.FOOD_ENTRY || !match) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  const payload = readFoodEntryPayload(state.payload);

  if (!payload) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    await resetConversationState(user.id);
    return;
  }

  const [, rawIndex, foodId] = match;

  if (!rawIndex || !foodId) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  await continueFoodLogWithSelection(
    ctx,
    user.id,
    BigInt(ctx.from.id),
    language,
    {
      ...payload,
      selectedFoodIdsByIndex: {
        ...payload.selectedFoodIdsByIndex,
        [rawIndex]: foodId,
      },
    },
    { requireFoodEntryClaim: true },
  );
}

async function handleFoodRelogCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const identity = await getFoodIdentity(ctx);
  const match = ctx.callbackQuery?.data?.match(foodRelogPattern);
  const mealEntryItemId = match?.[1];

  if (!identity || !mealEntryItemId) {
    return;
  }

  const meal = await quickRelogMeal({
    userId: identity.userId,
    telegramUserId: BigInt(ctx.from.id),
    mealEntryItemId,
  });

  if (!meal) {
    await ctx.reply(t(identity.language, "recentFoods.expired"));
    return;
  }

  const item = meal.items[0];
  const dailySummary = await getDailyNutritionSummary(identity.userId);

  await ctx.reply(
    [
      t(identity.language, "recentFoods.logged", {
        name: item?.matchedName ?? t(identity.language, "recentFoods.itemFallback"),
      }),
      "",
      formatDailyTotals(identity.language, dailySummary),
    ].join("\n"),
  );
}

async function handleMealEditText(
  ctx: Context,
  userId: string,
  telegramUserId: bigint,
  language: SupportedLanguage,
  rawText: string,
  payload: ConversationPayload | null,
): Promise<void> {
  const editPayload = readLatestMealPayload(payload);

  if (!editPayload) {
    await resetConversationState(userId);
    await ctx.reply(t(language, "lastMeal.expired"));
    return;
  }

  const parsedMeal = await parseDeterministicMealForUser(userId, rawText, language);

  if (parsedMeal.status === "invalid") {
    await ctx.reply(t(language, "lastMeal.editInvalid"));
    return;
  }

  const claimed = await claimConversationStep(userId, ConversationStep.MEAL_EDIT);

  if (!claimed) {
    await ctx.reply(t(language, "lastMeal.expired"));
    return;
  }

  const updated = await updateLatestMealEntry({
    userId,
    mealEntryId: editPayload.mealEntryId,
    rawText,
    meal: parsedMeal.meal,
  });

  if (!updated) {
    await ctx.reply(t(language, "lastMeal.expired"));
    return;
  }

  const dailySummary = await getDailyNutritionSummary(userId);
  await ctx.reply(
    [
      t(language, "lastMeal.updated"),
      "",
      formatMealRecorded(language, parsedMeal.meal, dailySummary),
    ].join("\n"),
  );
}

async function processFoodLog(
  ctx: Context,
  userId: string,
  telegramUserId: bigint,
  rawText: string,
  language: SupportedLanguage,
): Promise<void> {
  const parsed = parseFoodLogMessage(rawText);

  if (parsed.items.length > 0 && parsed.rejectedParts.length === 0) {
    await continueFoodLogWithSelection(ctx, userId, telegramUserId, language, {
      rawText,
      parsedItems: parsed.items,
      selectedFoodIdsByIndex: {},
    });
    return;
  }

  const fallback = await resolveFoodFallback({
    userId,
    rawInput: rawText,
    language,
  });

  if (fallback.status !== "resolved") {
    await ctx.reply(t(language, "food.parseFailed"));
    return;
  }

  const meal = calculateMeal([
    calculateMealItem(
      fallback.food,
      fallback.parsedItem,
      getFoodDisplayName(fallback.food, language),
    ),
  ]);

  await createMealEntry({
    userId,
    telegramUserId,
    rawText,
    meal,
  });

  const dailySummary = await getDailyNutritionSummary(userId);
  await ctx.reply(formatMealRecorded(language, meal, dailySummary));
}

async function parseDeterministicMealForUser(
  userId: string,
  rawText: string,
  language: SupportedLanguage,
): Promise<
  | {
      status: "ok";
      meal: CalculatedMeal;
    }
  | {
      status: "invalid";
    }
> {
  const parsed = parseFoodLogMessage(rawText);

  if (parsed.items.length === 0 || parsed.rejectedParts.length > 0) {
    return { status: "invalid" };
  }

  const foods = await getActiveNutritionFoods(userId);
  const calculatedItems = [];

  for (const item of parsed.items) {
    const match = matchFoodCandidate(item, foods);

    if (match.status !== "matched") {
      return { status: "invalid" };
    }

    calculatedItems.push(
      calculateMealItem(
        match.food,
        item,
        getFoodDisplayName(match.food, language),
      ),
    );
  }

  return {
    status: "ok",
    meal: calculateMeal(calculatedItems),
  };
}

async function continueFoodLogWithSelection(
  ctx: Context,
  userId: string,
  telegramUserId: bigint,
  language: SupportedLanguage,
  payload: FoodEntryPayload,
  options: { requireFoodEntryClaim?: boolean } = {},
): Promise<void> {
  const foods = await getActiveNutritionFoods(userId);
  const calculatedItems = [];
  const unmatchedItems: ParsedFoodItemCandidate[] = [];

  for (const [index, item] of payload.parsedItems.entries()) {
    const selectedFoodId = payload.selectedFoodIdsByIndex[String(index)];
    const selectedFood = selectedFoodId
      ? foods.find((food) => food.id === selectedFoodId)
      : undefined;

    if (selectedFood) {
      calculatedItems.push(
        calculateMealItem(selectedFood, item, getFoodDisplayName(selectedFood, language)),
      );
      continue;
    }

    const match = await resolveParsedFoodItemWithFallback({
      item,
      foods,
      userId,
      language,
    });

    if (match.status === "not_found") {
      unmatchedItems.push(item);
      continue;
    }

    if (match.status === "ambiguous") {
      await setConversationState(
        userId,
        ConversationStep.FOOD_ENTRY,
        payload as unknown as ConversationPayload,
      );
      await ctx.reply(t(language, "food.ambiguous", { label: item.rawLabel }), {
        reply_markup: foodOptionsKeyboard(index, match.options, language),
      });
      return;
    }

    calculatedItems.push(
      calculateMealItem(
        match.food,
        match.parsedItem,
        getFoodDisplayName(match.food, language),
      ),
    );
  }

  if (calculatedItems.length === 0) {
    await resetConversationState(userId);
    await ctx.reply(
      t(language, "food.notFound", {
        label: formatUnmatchedLabels(unmatchedItems),
      }),
    );
    return;
  }

  const meal = calculateMeal(calculatedItems);

  if (options.requireFoodEntryClaim) {
    const claimed = await claimConversationStep(userId, ConversationStep.FOOD_ENTRY);

    if (!claimed) {
      await ctx.reply(t(language, "food.clarificationExpired"));
      return;
    }
  }

  await createMealEntry({
    userId,
    telegramUserId,
    rawText: payload.rawText,
    meal,
  });
  await resetConversationState(userId);

  const dailySummary = await getDailyNutritionSummary(userId);
  const recordedMessage = formatMealRecorded(language, meal, dailySummary);

  await ctx.reply(
    unmatchedItems.length > 0
      ? [
          recordedMessage,
          t(language, "food.partialUnmatched", {
            matched: formatMatchedLabels(meal),
            unmatched: formatUnmatchedLabels(unmatchedItems),
          }),
        ].join("\n")
      : recordedMessage,
  );
}

function foodOptionsKeyboard(
  itemIndex: number,
  options: NutritionFoodRecord[],
  language: SupportedLanguage,
): InlineKeyboard {
  return options.slice(0, 5).reduce(
    (keyboard, food) =>
      keyboard
        .text(
          getFoodDisplayName(food, language),
          `food:choose:${itemIndex}:${food.id}`,
        )
        .row(),
    new InlineKeyboard(),
  );
}

export function formatLatestMeal(
  language: SupportedLanguage,
  meal: LatestMealEntry,
): string {
  return [
    t(language, "lastMeal.title"),
    t(language, "lastMeal.summary", {
      calories: Math.round(Number(meal.totalCalories)),
      items: meal.items.length,
    }),
    ...meal.items.slice(0, 3).map((item) =>
      t(language, "lastMeal.item", {
        name: item.matchedName,
        grams: Math.round(Number(item.grams)),
      }),
    ),
  ].join("\n");
}

function lastMealKeyboard(language: SupportedLanguage, mealEntryId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "lastLog.button.edit"), `lastmeal:edit:${mealEntryId}`)
    .text(t(language, "lastLog.button.delete"), `lastmeal:delete:${mealEntryId}`)
    .row()
    .text(t(language, "lastLog.button.cancel"), lastMealCancelAction);
}

function lastMealDeleteConfirmKeyboard(
  language: SupportedLanguage,
  mealEntryId: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "lastLog.button.confirmDelete"), `lastmeal:confirm_delete:${mealEntryId}`)
    .row()
    .text(t(language, "lastLog.button.cancel"), lastMealCancelAction);
}

export function formatRecentFoods(
  language: SupportedLanguage,
  recentFoods: RecentFood[],
): string {
  return [
    t(language, "recentFoods.title"),
    ...recentFoods.map((food, index) =>
      t(language, "recentFoods.line", {
        index: index + 1,
        name: food.name,
        grams: roundForDisplay(food.grams, 0),
        calories: Math.round(food.calories),
      }),
    ),
  ].join("\n");
}

function recentFoodsKeyboard(
  language: SupportedLanguage,
  recentFoods: RecentFood[],
): InlineKeyboard {
  return recentFoods.reduce(
    (keyboard, food) =>
      keyboard
        .text(
          t(language, "recentFoods.relogButton", {
            name: food.name,
            grams: roundForDisplay(food.grams, 0),
          }),
          `food:relog:${food.id}`,
        )
        .row(),
    new InlineKeyboard(),
  );
}

function formatMealRecorded(
  language: SupportedLanguage,
  meal: CalculatedMeal,
  dailySummary: DailyNutritionSummary,
): string {
  return [
    t(language, "food.recorded"),
    t(language, "food.estimatedNote"),
    "",
    ...meal.items.flatMap((item) => [
      t(language, "food.itemLine", {
        name: item.isEstimate
          ? `${item.matchedName} (${t(language, "food.estimatedDishSuffix")})`
          : item.matchedName,
        grams: roundForDisplay(item.grams, 0),
      }),
      formatMacroLine(language, item),
      "",
    ]),
    t(language, "food.total"),
    formatMacroLine(language, meal.totals),
    "",
    formatDailyTotals(language, dailySummary),
  ].join("\n");
}

function formatMacroLine(
  language: SupportedLanguage,
  values: {
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  },
): string {
  return t(language, "food.macroLine", {
    calories: Math.round(values.calories),
    protein: roundForDisplay(values.proteinG, 1),
    fat: roundForDisplay(values.fatG, 1),
    carbs: roundForDisplay(values.carbsG, 1),
  });
}

function getFoodDisplayName(
  food: NutritionFoodRecord,
  language: SupportedLanguage,
): string {
  return language === "ru" ? food.nameRu : food.nameEn;
}

function roundForDisplay(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits);
}

function formatUnmatchedLabels(items: ParsedFoodItemCandidate[]): string {
  return items.map((item) => item.rawLabel).join(", ");
}

function formatMatchedLabels(meal: CalculatedMeal): string {
  return meal.items.map((item) => item.matchedName).join(", ");
}

function readFoodEntryPayload(
  payload: ConversationPayload | null,
): FoodEntryPayload | null {
  if (!payload || typeof payload.rawText !== "string") {
    return null;
  }

  if (!Array.isArray(payload.parsedItems)) {
    return null;
  }

  const selectedFoodIdsByIndex =
    typeof payload.selectedFoodIdsByIndex === "object" &&
    payload.selectedFoodIdsByIndex !== null &&
    !Array.isArray(payload.selectedFoodIdsByIndex)
      ? Object.fromEntries(
          Object.entries(payload.selectedFoodIdsByIndex).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  const parsedItems = payload.parsedItems.filter(
    (item): item is ParsedFoodItemCandidate =>
      isRecord(item) &&
      typeof item.rawLabel === "string" &&
      typeof item.normalizedLabel === "string" &&
      typeof item.quantity === "number" &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      typeof item.unit === "string" &&
      ["g", "piece", "serving"].includes(item.unit) &&
      typeof item.grams === "number" &&
      Number.isFinite(item.grams) &&
      item.grams > 0,
  );

  if (parsedItems.length !== payload.parsedItems.length) {
    return null;
  }

  return {
    rawText: payload.rawText,
    parsedItems,
    selectedFoodIdsByIndex,
  };
}

function readLatestMealPayload(
  payload: ConversationPayload | null,
): { mealEntryId: string } | null {
  if (!payload || typeof payload.mealEntryId !== "string") {
    return null;
  }

  return {
    mealEntryId: payload.mealEntryId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getFoodIdentity(ctx: Context): Promise<{
  userId: string;
  language: SupportedLanguage;
} | null> {
  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return null;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );

  return {
    userId: user.id,
    language,
  };
}

function getCommandArgument(ctx: Context): string | null {
  const match = ctx.match;

  if (typeof match !== "string") {
    return null;
  }

  const trimmedMatch = match.trim();
  return trimmedMatch.length > 0 ? trimmedMatch : null;
}
```

### src/nutrition/learned-food.repository.ts

```ts
import type { LearnedFoodCandidate, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import { normalizeFoodText } from "./food-normalization.js";
import type { NutritionFoodRecord } from "./food.types.js";

export type StructuredLearnedFoodFallback = {
  canonicalName: string;
  displayName: string;
  aliases: string[];
  category?: string | null;
  servingGrams?: number | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  confidence: number;
  isEstimate: boolean;
  needsClarification: boolean;
};

export type SaveOpenAiLearnedFoodInput = {
  userId: string | null;
  rawInput: string;
  normalizedInput?: string;
  fallback: StructuredLearnedFoodFallback;
};

export type LearnedFoodCandidateRecord = {
  id: string;
  userId: string | null;
  rawInput: string;
  normalizedInput: string;
  canonicalName: string;
  displayName: string;
  category: string | null;
  servingGrams: unknown;
  caloriesPer100g: unknown;
  proteinPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
  confidence: unknown;
  isEstimate: boolean;
  aliasesJson: unknown;
  source: string;
  timesSeen: number;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
};

type LearnedFoodDelegate = PrismaClient["learnedFoodCandidate"];

export async function findLearnedFoodCandidateMatch(
  userId: string,
  rawInput: string,
  delegate: Pick<LearnedFoodDelegate, "findMany"> = prisma.learnedFoodCandidate,
): Promise<LearnedFoodCandidateRecord | null> {
  const normalizedInput = normalizeFoodText(rawInput);

  if (!normalizedInput) {
    return null;
  }

  const candidates = await delegate.findMany({
    where: {
      rejectedAt: null,
      OR: [
        {
          userId,
        },
        {
          userId: null,
        },
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 100,
  });

  return (
    findExactNormalizedMatch(candidates, normalizedInput, userId) ??
    findExactAliasMatch(candidates, normalizedInput, userId)
  );
}

export async function incrementLearnedFoodTimesSeen(
  record: LearnedFoodCandidateRecord,
  delegate: Pick<LearnedFoodDelegate, "update"> = prisma.learnedFoodCandidate,
): Promise<LearnedFoodCandidateRecord> {
  return delegate.update({
    where: {
      id: record.id,
    },
    data: {
      timesSeen: {
        increment: 1,
      },
    },
  });
}

export async function saveOpenAiLearnedFoodCandidate(
  input: SaveOpenAiLearnedFoodInput,
  delegate: Pick<LearnedFoodDelegate, "create" | "findFirst" | "update"> =
    prisma.learnedFoodCandidate,
): Promise<LearnedFoodCandidateRecord> {
  const normalizedInput =
    input.normalizedInput ?? normalizeFoodText(input.rawInput);
  const existing = await delegate.findFirst({
    where: {
      userId: input.userId,
      normalizedInput,
      rejectedAt: null,
    },
  });

  if (existing) {
    return delegate.update({
      where: {
        id: existing.id,
      },
      data: {
        ...buildLearnedFoodCandidateUpdateData(input),
        timesSeen: {
          increment: 1,
        },
      },
    });
  }

  return delegate.create({
    data: buildLearnedFoodCandidateCreateData({
      ...input,
      normalizedInput,
    }),
  });
}

export function buildLearnedFoodCandidateCreateData(
  input: SaveOpenAiLearnedFoodInput,
): Prisma.LearnedFoodCandidateUncheckedCreateInput {
  const normalizedInput =
    input.normalizedInput ?? normalizeFoodText(input.rawInput);

  return {
    userId: input.userId,
    rawInput: input.rawInput.trim(),
    normalizedInput,
    canonicalName: input.fallback.canonicalName.trim(),
    displayName: input.fallback.displayName.trim(),
    category: input.fallback.category?.trim() || null,
    servingGrams: input.fallback.servingGrams ?? null,
    caloriesPer100g: input.fallback.caloriesPer100g,
    proteinPer100g: input.fallback.proteinPer100g,
    fatPer100g: input.fallback.fatPer100g,
    carbsPer100g: input.fallback.carbsPer100g,
    confidence: input.fallback.confidence,
    isEstimate: input.fallback.isEstimate,
    aliasesJson: input.fallback.aliases,
    source: "openai_fallback",
    timesSeen: 1,
  };
}

export function learnedFoodCandidateToNutritionFoodRecord(
  record: LearnedFoodCandidateRecord,
): NutritionFoodRecord {
  const aliases = [
    record.rawInput,
    record.normalizedInput,
    ...readAliases(record.aliasesJson),
  ];

  return {
    id: record.id,
    slug: `learned-${record.id}`,
    nameRu: record.displayName,
    nameEn: record.displayName,
    isLearned: true,
    caloriesPer100g: record.caloriesPer100g,
    proteinPer100g: record.proteinPer100g,
    fatPer100g: record.fatPer100g,
    carbsPer100g: record.carbsPer100g,
    aliases: uniqueNormalizedAliases(aliases).map((alias) => ({
      alias,
      languageCode: "learned",
      normalizedAlias: normalizeFoodText(alias),
    })),
  };
}

function buildLearnedFoodCandidateUpdateData(
  input: SaveOpenAiLearnedFoodInput,
): Prisma.LearnedFoodCandidateUncheckedUpdateInput {
  return {
    rawInput: input.rawInput.trim(),
    canonicalName: input.fallback.canonicalName.trim(),
    displayName: input.fallback.displayName.trim(),
    category: input.fallback.category?.trim() || null,
    servingGrams: input.fallback.servingGrams ?? null,
    caloriesPer100g: input.fallback.caloriesPer100g,
    proteinPer100g: input.fallback.proteinPer100g,
    fatPer100g: input.fallback.fatPer100g,
    carbsPer100g: input.fallback.carbsPer100g,
    confidence: input.fallback.confidence,
    isEstimate: input.fallback.isEstimate,
    aliasesJson: input.fallback.aliases,
    source: "openai_fallback",
  };
}

function findExactNormalizedMatch(
  candidates: LearnedFoodCandidate[],
  normalizedInput: string,
  userId: string,
): LearnedFoodCandidateRecord | null {
  return (
    prioritizeUserCandidates(candidates, userId).find(
      (candidate) => candidate.normalizedInput === normalizedInput,
    ) ?? null
  );
}

function findExactAliasMatch(
  candidates: LearnedFoodCandidate[],
  normalizedInput: string,
  userId: string,
): LearnedFoodCandidateRecord | null {
  return (
    prioritizeUserCandidates(candidates, userId).find((candidate) =>
      readAliases(candidate.aliasesJson).some(
        (alias) => normalizeFoodText(alias) === normalizedInput,
      ),
    ) ?? null
  );
}

function prioritizeUserCandidates(
  candidates: LearnedFoodCandidate[],
  userId: string,
): LearnedFoodCandidate[] {
  return [...candidates].sort((left, right) => {
    if (left.userId === userId && right.userId !== userId) {
      return -1;
    }

    if (right.userId === userId && left.userId !== userId) {
      return 1;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

function readAliases(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((alias): alias is string => typeof alias === "string");
}

function uniqueNormalizedAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const alias of aliases) {
    const normalizedAlias = normalizeFoodText(alias);

    if (!normalizedAlias || seen.has(normalizedAlias)) {
      continue;
    }

    seen.add(normalizedAlias);
    result.push(alias.trim());
  }

  return result;
}
```

### src/nutrition/food-fallback-resolver.ts

```ts
import { z } from "zod";

import { env } from "../config/env.js";
import type { SupportedLanguage } from "../i18n/index.js";
import { matchFoodCandidate } from "./food-matcher.js";
import { normalizeFoodText } from "./food-normalization.js";
import type {
  FoodMatchResult,
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "./food.types.js";
import {
  findLearnedFoodCandidateMatch,
  incrementLearnedFoodTimesSeen,
  learnedFoodCandidateToNutritionFoodRecord,
  saveOpenAiLearnedFoodCandidate,
  type LearnedFoodCandidateRecord,
  type SaveOpenAiLearnedFoodInput,
  type StructuredLearnedFoodFallback,
} from "./learned-food.repository.js";
import { createOpenAiFoodFallbackAdapter } from "./openai-food-fallback.adapter.js";

export type StructuredFoodFallbackAdapter = {
  resolveFood(
    rawText: string,
    language: SupportedLanguage,
  ): Promise<
    | {
        status: "parsed";
        value: unknown;
      }
    | {
        status: "unavailable" | "failed";
      }
  >;
};

export type LearnedFoodRepository = {
  findMatch(
    userId: string,
    normalizedInput: string,
  ): Promise<LearnedFoodCandidateRecord | null>;
  incrementTimesSeen(
    record: LearnedFoodCandidateRecord,
  ): Promise<LearnedFoodCandidateRecord>;
  saveOpenAiResult(
    input: SaveOpenAiLearnedFoodInput,
  ): Promise<LearnedFoodCandidateRecord>;
};

export type FoodFallbackResolution =
  | {
      status: "resolved";
      source: "learned" | "openai";
      food: NutritionFoodRecord;
      parsedItem: ParsedFoodItemCandidate;
      matchedName: string;
    }
  | {
      status: "not_found";
    };

export type ParsedFoodItemResolution =
  | {
      status: "matched";
      source: "deterministic" | "learned" | "openai";
      food: NutritionFoodRecord;
      parsedItem: ParsedFoodItemCandidate;
      matchedName: string;
    }
  | Extract<FoodMatchResult, { status: "ambiguous" }>
  | {
      status: "not_found";
    };

const minimumConfidence = 0.65;

const structuredFallbackSchema = z.object({
  canonicalName: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
  aliases: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  servingGrams: z.number().positive().max(2000).nullable().optional(),
  caloriesPer100g: z.number().min(0).max(1000),
  proteinPer100g: z.number().min(0).max(100),
  fatPer100g: z.number().min(0).max(100),
  carbsPer100g: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  isEstimate: z.boolean(),
  needsClarification: z.boolean(),
});

const defaultAdapter = createOpenAiFoodFallbackAdapter({
  apiKey: env.OPENAI_API_KEY,
  model: env.OPENAI_FOOD_DRAFT_MODEL,
});

const defaultRepository: LearnedFoodRepository = {
  findMatch: findLearnedFoodCandidateMatch,
  incrementTimesSeen: incrementLearnedFoodTimesSeen,
  saveOpenAiResult: saveOpenAiLearnedFoodCandidate,
};

export async function resolveParsedFoodItemWithFallback(input: {
  item: ParsedFoodItemCandidate;
  foods: NutritionFoodRecord[];
  userId: string;
  language: SupportedLanguage;
  fallbackResolver?: (input: {
    userId: string;
    rawInput: string;
    language: SupportedLanguage;
    gramsHint?: number;
  }) => Promise<FoodFallbackResolution>;
}): Promise<ParsedFoodItemResolution> {
  const match = matchFoodCandidate(input.item, input.foods);

  if (match.status === "matched") {
    return {
      status: "matched",
      source: "deterministic",
      food: match.food,
      parsedItem: input.item,
      matchedName: match.matchedName,
    };
  }

  if (match.status === "ambiguous") {
    return match;
  }

  const fallbackResolver = input.fallbackResolver ?? resolveFoodFallback;
  const fallback = await fallbackResolver({
    userId: input.userId,
    rawInput: input.item.rawLabel,
    language: input.language,
    gramsHint: input.item.grams,
  });

  if (fallback.status !== "resolved") {
    return {
      status: "not_found",
    };
  }

  return {
    status: "matched",
    source: fallback.source,
    food: fallback.food,
    parsedItem: fallback.parsedItem,
    matchedName: fallback.matchedName,
  };
}

export async function resolveFoodFallback(input: {
  userId: string;
  rawInput: string;
  language: SupportedLanguage;
  gramsHint?: number;
  learnedRepository?: LearnedFoodRepository;
  adapter?: StructuredFoodFallbackAdapter;
}): Promise<FoodFallbackResolution> {
  const normalizedInput = normalizeFoodText(input.rawInput);

  if (!looksLikeFoodInput(normalizedInput)) {
    return {
      status: "not_found",
    };
  }

  const repository = input.learnedRepository ?? defaultRepository;
  const learned = await repository.findMatch(input.userId, normalizedInput);

  if (learned) {
    const updated = await repository.incrementTimesSeen(learned);
    return buildResolvedFallback(updated, "learned", input.gramsHint);
  }

  const adapter = input.adapter ?? defaultAdapter;
  const fallback = await adapter.resolveFood(input.rawInput, input.language);

  if (fallback.status !== "parsed") {
    return {
      status: "not_found",
    };
  }

  const validatedFallback = validateStructuredFallback(fallback.value);

  if (!validatedFallback) {
    return {
      status: "not_found",
    };
  }

  const saved = await repository.saveOpenAiResult({
    userId: input.userId,
    rawInput: input.rawInput,
    normalizedInput,
    fallback: validatedFallback,
  });

  return buildResolvedFallback(saved, "openai", input.gramsHint);
}

function validateStructuredFallback(
  value: unknown,
): StructuredLearnedFoodFallback | null {
  const result = structuredFallbackSchema.safeParse(value);

  if (!result.success) {
    return null;
  }

  if (
    result.data.needsClarification ||
    result.data.confidence < minimumConfidence
  ) {
    return null;
  }

  return {
    ...result.data,
    aliases: result.data.aliases,
    category: result.data.category ?? null,
    servingGrams: result.data.servingGrams ?? null,
  };
}

function buildResolvedFallback(
  record: LearnedFoodCandidateRecord,
  source: "learned" | "openai",
  gramsHint?: number,
): FoodFallbackResolution {
  const grams = gramsHint ?? Number(record.servingGrams ?? 0);

  if (!Number.isFinite(grams) || grams <= 0) {
    return {
      status: "not_found",
    };
  }

  const food = learnedFoodCandidateToNutritionFoodRecord(record);

  return {
    status: "resolved",
    source,
    food,
    matchedName: record.displayName,
    parsedItem: {
      rawLabel: record.rawInput,
      normalizedLabel: record.normalizedInput,
      quantity: gramsHint ?? 1,
      unit: gramsHint ? "g" : "serving",
      grams,
      ...(record.isEstimate ? { isEstimate: true } : {}),
    },
  };
}

function looksLikeFoodInput(normalizedInput: string): boolean {
  return (
    normalizedInput.length >= 2 &&
    normalizedInput.length <= 200 &&
    /\p{L}/u.test(normalizedInput)
  );
}
```

### src/nutrition/openai-food-fallback.adapter.ts

```ts
import type { SupportedLanguage } from "../i18n/index.js";
import { extractOpenAiResponseText } from "../meals/openai-food-draft.adapter.js";
import type { StructuredFoodFallbackAdapter } from "./food-fallback-resolver.js";

type OpenAiFoodFallbackConfig = {
  apiKey?: string | undefined;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const defaultTimeoutMs = 8_000;

export function createOpenAiFoodFallbackAdapter(
  config: OpenAiFoodFallbackConfig,
): StructuredFoodFallbackAdapter {
  return {
    async resolveFood(rawText: string, language: SupportedLanguage) {
      if (!config.apiKey) {
        return {
          status: "unavailable",
        };
      }

      try {
        const response = await fetchOpenAiFoodFallback(config, rawText, language);

        if (!response.ok) {
          console.warn("OpenAI food fallback failed", {
            status: response.status,
          });
          return {
            status: "failed",
          };
        }

        const responseBody = await response.json();
        const responseText = extractOpenAiResponseText(responseBody);

        if (!responseText) {
          return {
            status: "failed",
          };
        }

        return {
          status: "parsed",
          value: JSON.parse(responseText) as unknown,
        };
      } catch {
        console.warn("OpenAI food fallback failed");
        return {
          status: "failed",
        };
      }
    },
  };
}

async function fetchOpenAiFoodFallback(
  config: OpenAiFoodFallbackConfig,
  rawText: string,
  language: SupportedLanguage,
): Promise<Response> {
  const fetchFn = config.fetchFn ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? defaultTimeoutMs,
  );

  try {
    return await fetchFn(openAiResponsesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(
        buildOpenAiFoodFallbackRequest(config.model, rawText, language),
      ),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenAiFoodFallbackRequest(
  model: string,
  rawText: string,
  language: SupportedLanguage,
) {
  return {
    model,
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: [
              "Resolve one food logging input into structured nutrition data.",
              "Return a conservative generic estimate only when the text is clearly a food or drink.",
              "Do not provide medical advice, coaching, prose, markdown, or multiple options.",
              "If the food is ambiguous or not clearly food, set needsClarification=true.",
              "Values must be per 100g. servingGrams should be the likely serving for unitless input, or null if not inferable.",
            ].join(" "),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Language: ${language}\nFood text: ${rawText}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "food_fallback",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            canonicalName: {
              type: "string",
            },
            displayName: {
              type: "string",
            },
            aliases: {
              type: "array",
              items: {
                type: "string",
              },
            },
            category: {
              type: ["string", "null"],
            },
            servingGrams: {
              type: ["number", "null"],
            },
            caloriesPer100g: {
              type: "number",
            },
            proteinPer100g: {
              type: "number",
            },
            fatPer100g: {
              type: "number",
            },
            carbsPer100g: {
              type: "number",
            },
            confidence: {
              type: "number",
            },
            isEstimate: {
              type: "boolean",
            },
            needsClarification: {
              type: "boolean",
            },
          },
          required: [
            "canonicalName",
            "displayName",
            "aliases",
            "category",
            "servingGrams",
            "caloriesPer100g",
            "proteinPer100g",
            "fatPer100g",
            "carbsPer100g",
            "confidence",
            "isEstimate",
            "needsClarification",
          ],
        },
      },
    },
    max_output_tokens: 600,
  };
}
```

### tests/learned-food-fallback.test.ts

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeFoodText } from "../src/nutrition/food-normalization.js";
import {
  buildLearnedFoodCandidateCreateData,
  learnedFoodCandidateToNutritionFoodRecord,
  type LearnedFoodCandidateRecord,
} from "../src/nutrition/learned-food.repository.js";
import {
  resolveFoodFallback,
  resolveParsedFoodItemWithFallback,
  type StructuredFoodFallbackAdapter,
} from "../src/nutrition/food-fallback-resolver.js";
import type {
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "../src/nutrition/food.types.js";

const rice: NutritionFoodRecord = {
  id: "food_rice",
  slug: "white-rice-cooked",
  nameRu: "Рис белый, вареный",
  nameEn: "White rice, cooked",
  caloriesPer100g: 130,
  proteinPer100g: 2.38,
  fatPer100g: 0.21,
  carbsPer100g: 28.59,
  aliases: [
    {
      alias: "риса",
      languageCode: "ru",
      normalizedAlias: "риса",
    },
  ],
};

describe("learned food fallback resolver", () => {
  it("keeps deterministic catalog resolution before learned or OpenAI fallback", async () => {
    let fallbackCalls = 0;
    const parsed = candidateFor("риса", 200);
    const result = await resolveParsedFoodItemWithFallback({
      item: parsed,
      foods: [rice],
      userId: "user_1",
      language: "ru",
      fallbackResolver: async () => {
        fallbackCalls += 1;
        return { status: "not_found" };
      },
    });

    assert.equal(result.status, "matched");
    assert.equal(result.status === "matched" ? result.source : "", "deterministic");
    assert.equal(fallbackCalls, 0);
  });

  it("resolves learned exact normalized input before OpenAI", async () => {
    let openAiCalls = 0;
    const learned = learnedRecord({
      id: "learned_1",
      rawInput: "хинкали",
      normalizedInput: "хинкали",
      canonicalName: "khinkali",
      displayName: "Хинкали",
      servingGrams: 250,
      aliasesJson: ["хинкалии"],
    });
    const result = await resolveFoodFallback({
      userId: "user_1",
      rawInput: "хинкали",
      language: "ru",
      learnedRepository: {
        findMatch: async () => learned,
        incrementTimesSeen: async () => learned,
        saveOpenAiResult: async () => {
          throw new Error("should not save on learned hit");
        },
      },
      adapter: adapterFrom(async () => {
        openAiCalls += 1;
        return { status: "unavailable" };
      }),
    });

    assert.equal(result.status, "resolved");
    assert.equal(result.status === "resolved" ? result.source : "", "learned");
    assert.equal(result.status === "resolved" ? result.food.slug : "", "learned-learned_1");
    assert.equal(result.status === "resolved" ? result.parsedItem.grams : 0, 250);
    assert.equal(openAiCalls, 0);
  });

  it("calls OpenAI for unknown food, validates, saves learned memory, and returns estimate", async () => {
    const savedInputs: string[] = [];
    const result = await resolveFoodFallback({
      userId: "user_1",
      rawInput: "сырный раф",
      language: "ru",
      learnedRepository: {
        findMatch: async () => null,
        incrementTimesSeen: async (record) => record,
        saveOpenAiResult: async (input) => {
          savedInputs.push(input.normalizedInput);
          return learnedRecord({
            id: "learned_raf",
            rawInput: input.rawInput,
            normalizedInput: input.normalizedInput,
            canonicalName: input.fallback.canonicalName,
            displayName: input.fallback.displayName,
            category: input.fallback.category,
            servingGrams: input.fallback.servingGrams,
            caloriesPer100g: input.fallback.caloriesPer100g,
            proteinPer100g: input.fallback.proteinPer100g,
            fatPer100g: input.fallback.fatPer100g,
            carbsPer100g: input.fallback.carbsPer100g,
            confidence: input.fallback.confidence,
            isEstimate: input.fallback.isEstimate,
            aliasesJson: input.fallback.aliases,
          });
        },
      },
      adapter: adapterFrom(async () => ({
        status: "parsed",
        value: {
          canonicalName: "cheese raf coffee",
          displayName: "Сырный раф",
          aliases: ["сырный раф", "раф сырный"],
          category: "drink",
          servingGrams: 300,
          caloriesPer100g: 115,
          proteinPer100g: 3,
          fatPer100g: 6,
          carbsPer100g: 12,
          confidence: 0.82,
          isEstimate: true,
          needsClarification: false,
        },
      })),
    });

    assert.equal(result.status, "resolved");
    assert.deepEqual(savedInputs, ["сырный раф"]);
    assert.equal(result.status === "resolved" ? result.source : "", "openai");
    assert.equal(result.status === "resolved" ? result.food.isLearned : false, true);
    assert.equal(result.status === "resolved" ? result.parsedItem.isEstimate : false, true);
    assert.equal(result.status === "resolved" ? result.parsedItem.grams : 0, 300);
  });

  it("reuses a newly learned input on the next same phrase without another OpenAI call", async () => {
    let openAiCalls = 0;
    let stored: LearnedFoodCandidateRecord | null = null;
    const repository = {
      findMatch: async (_userId: string, normalizedInput: string) =>
        stored?.normalizedInput === normalizedInput ? stored : null,
      incrementTimesSeen: async (record: LearnedFoodCandidateRecord) => ({
        ...record,
        timesSeen: record.timesSeen + 1,
      }),
      saveOpenAiResult: async (input: Parameters<
        NonNullable<Parameters<typeof resolveFoodFallback>[0]["learnedRepository"]>["saveOpenAiResult"]
      >[0]) => {
        stored = learnedRecord({
          id: "learned_2",
          rawInput: input.rawInput,
          normalizedInput: input.normalizedInput,
          canonicalName: input.fallback.canonicalName,
          displayName: input.fallback.displayName,
          servingGrams: input.fallback.servingGrams,
          caloriesPer100g: input.fallback.caloriesPer100g,
          proteinPer100g: input.fallback.proteinPer100g,
          fatPer100g: input.fallback.fatPer100g,
          carbsPer100g: input.fallback.carbsPer100g,
          confidence: input.fallback.confidence,
          isEstimate: input.fallback.isEstimate,
          aliasesJson: input.fallback.aliases,
        });
        return stored;
      },
    };
    const adapter = adapterFrom(async () => {
      openAiCalls += 1;
      return {
        status: "parsed",
        value: {
          canonicalName: "protein cheesecake",
          displayName: "Протеиновый чизкейк",
          aliases: ["протеиновый чизкейк"],
          category: "dessert",
          servingGrams: 180,
          caloriesPer100g: 210,
          proteinPer100g: 18,
          fatPer100g: 8,
          carbsPer100g: 16,
          confidence: 0.86,
          isEstimate: true,
          needsClarification: false,
        },
      };
    });

    const first = await resolveFoodFallback({
      userId: "user_1",
      rawInput: "протеиновый чизкейк",
      language: "ru",
      learnedRepository: repository,
      adapter,
    });
    const second = await resolveFoodFallback({
      userId: "user_1",
      rawInput: "протеиновый чизкейк",
      language: "ru",
      learnedRepository: repository,
      adapter,
    });

    assert.equal(first.status, "resolved");
    assert.equal(second.status, "resolved");
    assert.equal(second.status === "resolved" ? second.source : "", "learned");
    assert.equal(openAiCalls, 1);
  });

  it("fails safely for invalid, clarifying, or low-confidence OpenAI output", async () => {
    const cases: StructuredFoodFallbackAdapter[] = [
      adapterFrom(async () => ({ status: "failed" })),
      adapterFrom(async () => ({
        status: "parsed",
        value: {
          canonicalName: "unknown",
          displayName: "Unknown",
          aliases: [],
          category: "unknown",
          servingGrams: 100,
          caloriesPer100g: 100,
          proteinPer100g: 1,
          fatPer100g: 1,
          carbsPer100g: 1,
          confidence: 0.4,
          isEstimate: true,
          needsClarification: false,
        },
      })),
      adapterFrom(async () => ({
        status: "parsed",
        value: {
          canonicalName: "coffee",
          displayName: "Coffee",
          aliases: ["кофе"],
          category: "drink",
          servingGrams: 200,
          caloriesPer100g: 2,
          proteinPer100g: 0,
          fatPer100g: 0,
          carbsPer100g: 0,
          confidence: 0.9,
          isEstimate: true,
          needsClarification: true,
        },
      })),
    ];

    for (const adapter of cases) {
      const result = await resolveFoodFallback({
        userId: "user_1",
        rawInput: "непонятная штука",
        language: "ru",
        learnedRepository: emptyRepository(),
        adapter,
      });

      assert.equal(result.status, "not_found");
    }
  });

  it("keeps learned data separate from the core catalog record shape", () => {
    const learned = learnedRecord({
      id: "learned_3",
      canonicalName: "khachapuri",
      displayName: "Хачапури",
      normalizedInput: "хачапури",
      aliasesJson: ["лодочка"],
    });
    const record = learnedFoodCandidateToNutritionFoodRecord(learned);

    assert.equal(record.isLearned, true);
    assert.equal(record.isCustom, undefined);
    assert.equal(record.slug, "learned-learned_3");
    assert.equal(record.aliases.some((alias) => alias.normalizedAlias === "лодочка"), true);
  });

  it("builds normalized learned create data for persistence", () => {
    const data = buildLearnedFoodCandidateCreateData({
      userId: "user_1",
      rawInput: "  Сырный раф  ",
      fallback: {
        canonicalName: "cheese raf coffee",
        displayName: "Сырный раф",
        aliases: ["раф сырный"],
        category: "drink",
        servingGrams: 300,
        caloriesPer100g: 115,
        proteinPer100g: 3,
        fatPer100g: 6,
        carbsPer100g: 12,
        confidence: 0.82,
        isEstimate: true,
        needsClarification: false,
      },
    });

    assert.equal(data.normalizedInput, normalizeFoodText("Сырный раф"));
    assert.equal(data.source, "openai_fallback");
    assert.equal(data.isEstimate, true);
    assert.equal(data.timesSeen, 1);
  });
});

function candidateFor(label: string, grams: number): ParsedFoodItemCandidate {
  return {
    rawLabel: label,
    normalizedLabel: normalizeFoodText(label),
    quantity: grams,
    unit: "g",
    grams,
  };
}

function adapterFrom(
  resolve: StructuredFoodFallbackAdapter["resolveFood"],
): StructuredFoodFallbackAdapter {
  return {
    resolveFood: resolve,
  };
}

function emptyRepository() {
  return {
    findMatch: async () => null,
    incrementTimesSeen: async (record: LearnedFoodCandidateRecord) => record,
    saveOpenAiResult: async () => {
      throw new Error("should not save");
    },
  };
}

function learnedRecord(
  input: Partial<LearnedFoodCandidateRecord>,
): LearnedFoodCandidateRecord {
  return {
    id: input.id ?? "learned_1",
    userId: input.userId ?? "user_1",
    rawInput: input.rawInput ?? "хинкали",
    normalizedInput: input.normalizedInput ?? "хинкали",
    canonicalName: input.canonicalName ?? "khinkali",
    displayName: input.displayName ?? "Хинкали",
    category: input.category ?? "meal",
    servingGrams: input.servingGrams ?? 250,
    caloriesPer100g: input.caloriesPer100g ?? 235,
    proteinPer100g: input.proteinPer100g ?? 10,
    fatPer100g: input.fatPer100g ?? 9,
    carbsPer100g: input.carbsPer100g ?? 28,
    confidence: input.confidence ?? 0.82,
    isEstimate: input.isEstimate ?? true,
    aliasesJson: input.aliasesJson ?? [],
    source: input.source ?? "openai_fallback",
    timesSeen: input.timesSeen ?? 1,
    createdAt: input.createdAt ?? new Date("2026-06-12T00:00:00.000Z"),
    updatedAt: input.updatedAt ?? new Date("2026-06-12T00:00:00.000Z"),
    approvedAt: input.approvedAt ?? null,
    rejectedAt: input.rejectedAt ?? null,
  };
}
```

### tests/openai-food-fallback.test.ts

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createOpenAiFoodFallbackAdapter } from "../src/nutrition/openai-food-fallback.adapter.js";

describe("OpenAI learned food fallback adapter", () => {
  it("returns unavailable when API key is missing", async () => {
    const adapter = createOpenAiFoodFallbackAdapter({
      apiKey: undefined,
      model: "test-model",
      fetchFn: async () => {
        throw new Error("should not fetch without key");
      },
    });

    const result = await adapter.resolveFood("сырный раф", "ru");

    assert.deepEqual(result, { status: "unavailable" });
  });

  it("returns structured provider JSON as parsed value", async () => {
    const adapter = createOpenAiFoodFallbackAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              canonicalName: "cheese raf coffee",
              displayName: "Сырный раф",
              aliases: ["сырный раф"],
              category: "drink",
              servingGrams: 300,
              caloriesPer100g: 115,
              proteinPer100g: 3,
              fatPer100g: 6,
              carbsPer100g: 12,
              confidence: 0.82,
              isEstimate: true,
              needsClarification: false,
            }),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
    });

    const result = await adapter.resolveFood("сырный раф", "ru");

    assert.equal(result.status, "parsed");
    assert.equal(
      result.status === "parsed" ? (result.value as any).displayName : "",
      "Сырный раф",
    );
  });

  it("returns failed for malformed provider JSON", async () => {
    const adapter = createOpenAiFoodFallbackAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetchFn: async () =>
        new Response(JSON.stringify({ output_text: "not-json" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
    });

    const result = await adapter.resolveFood("сырный раф", "ru");

    assert.deepEqual(result, { status: "failed" });
  });
});
```

### tests/meals.test.ts

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CalculatedMeal } from "../src/nutrition/food.types.js";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const { formatDailyTotals, formatRecentFoods } = await import(
  "../src/bot/food-logging.js"
);
const {
  buildMealEntryCreateData,
  buildMealEntryItemsDeleteWhere,
  buildMealEntryUpdateData,
  buildLatestMealDeleteWhere,
  buildQuickRelogMealEntryCreateData,
  selectLatestMealEntry,
  selectRecentFoodsFromItems,
  sumDailyTotals,
} = await import(
  "../src/meals/meals.service.js"
);
const {
  buildCustomFoodUpsertData,
  parseCustomFoodInput,
} = await import("../src/nutrition/custom-food.service.js");
const { matchFoodCandidate } = await import("../src/nutrition/food-matcher.js");
const { getZonedDayRange } = await import("../src/time/timezone.js");

const meal: CalculatedMeal = {
  items: [
    {
      food: {
        id: "food_chicken_breast",
        slug: "chicken-breast-cooked-skinless",
        nameRu: "Куриная грудка",
        nameEn: "Chicken breast",
        caloriesPer100g: 165,
        proteinPer100g: 31,
        fatPer100g: 3.6,
        carbsPer100g: 0,
        aliases: [],
      },
      matchedName: "Chicken breast",
      rawLabel: "chicken breast",
      quantity: 200,
      unit: "g",
      grams: 200,
      calories: 330,
      proteinG: 62,
      fatG: 7.2,
      carbsG: 0,
    },
  ],
  totals: {
    calories: 330,
    proteinG: 62,
    fatG: 7.2,
    carbsG: 0,
  },
};

describe("meal logging", () => {
  it("builds MealEntry create data with MealEntryItem rows", () => {
    const data = buildMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      rawText: "200 g chicken breast",
      meal,
      consumedAt: new Date("2026-06-06T10:00:00.000Z"),
    }) as any;

    assert.equal(data.rawText, "200 g chicken breast");
    assert.equal(data.totalCalories, 330);
    assert.equal(data.totalProteinG, 62);
    assert.equal(data.items.create.length, 1);
    assert.equal(data.items.create[0].matchedName, "Chicken breast");
    assert.equal(data.items.create[0].grams, 200);
  });

  it("builds MealEntry create data for custom foods", () => {
    const data = buildMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      rawText: "150 g house yogurt",
      meal: {
        items: [
          {
            ...meal.items[0]!,
            food: {
              ...meal.items[0]!.food,
              id: "custom_food_1",
              isCustom: true,
            },
            matchedName: "House yogurt",
          },
        ],
        totals: meal.totals,
      },
      consumedAt: new Date("2026-06-06T10:00:00.000Z"),
    }) as any;

    assert.equal(data.items.create[0].customFood.connect.id, "custom_food_1");
    assert.equal(data.items.create[0].food, undefined);
  });

  it("builds MealEntry create data for learned fallback foods without catalog promotion", () => {
    const data = buildMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      rawText: "сырный раф",
      meal: {
        items: [
          {
            ...meal.items[0]!,
            food: {
              ...meal.items[0]!.food,
              id: "learned_food_1",
              slug: "learned-learned_food_1",
              isLearned: true,
            },
            matchedName: "Сырный раф",
          },
        ],
        totals: meal.totals,
      },
      consumedAt: new Date("2026-06-06T10:00:00.000Z"),
    }) as any;

    assert.equal(data.items.create[0].matchedName, "Сырный раф");
    assert.equal(data.items.create[0].food, undefined);
    assert.equal(data.items.create[0].customFood, undefined);
  });
});

describe("latest meal edit/delete", () => {
  it("selects the latest meal by consumedAt and createdAt", () => {
    const latest = selectLatestMealEntry([
      mealEntrySummary("older", "2026-06-08T10:00:00.000Z", "2026-06-08T10:00:01.000Z"),
      mealEntrySummary("tie-older-created", "2026-06-09T10:00:00.000Z", "2026-06-09T10:00:01.000Z"),
      mealEntrySummary("latest", "2026-06-09T10:00:00.000Z", "2026-06-09T10:00:02.000Z"),
    ]);

    assert.equal(latest?.id, "latest");
  });

  it("builds latest meal update data without mutating original identity", () => {
    const data = buildMealEntryUpdateData({
      rawText: "200 g chicken breast",
      meal,
    }) as any;

    assert.equal(data.rawText, "200 g chicken breast");
    assert.equal(data.totalCalories, 330);
    assert.equal(data.items.create.length, 1);
    assert.equal(data.items.create[0].food.connect.id, "food_chicken_breast");
  });

  it("builds user-scoped latest meal delete filters", () => {
    assert.deepEqual(buildLatestMealDeleteWhere({
      userId: "user_1",
      mealEntryId: "meal_1",
    }), {
      id: "meal_1",
      userId: "user_1",
    });
    assert.deepEqual(buildMealEntryItemsDeleteWhere({
      userId: "user_1",
      mealEntryId: "meal_1",
    }), {
      mealEntryId: "meal_1",
      mealEntry: {
        userId: "user_1",
      },
    });
  });
});

describe("custom foods", () => {
  it("parses custom food command input", () => {
    assert.deepEqual(parseCustomFoodInput("House yogurt | 90 | 10,5 | 2 | 4"), {
      status: "valid",
      value: {
        name: "House yogurt",
        caloriesPer100g: 90,
        proteinPer100g: 10.5,
        fatPer100g: 2,
        carbsPer100g: 4,
      },
    });
  });

  it("rejects invalid custom food command input", () => {
    assert.deepEqual(parseCustomFoodInput("House yogurt 90 10 2 4"), {
      status: "invalid",
    });
  });

  it("builds deterministic custom food upsert data", () => {
    const data = buildCustomFoodUpsertData({
      userId: "user_1",
      name: "House Yogurt",
      caloriesPer100g: 90,
      proteinPer100g: 10,
      fatPer100g: 2,
      carbsPer100g: 4,
    });

    assert.deepEqual(data.where, {
      userId_normalizedName: {
        userId: "user_1",
        normalizedName: "house yogurt",
      },
    });
    assert.equal((data.create as any).normalizedName, "house yogurt");
    assert.equal((data.update as any).isActive, true);
  });

  it("matches a custom food through the existing matcher", () => {
    const match = matchFoodCandidate(
      {
        rawLabel: "house yogurt",
        normalizedLabel: "house yogurt",
        quantity: 150,
        unit: "g",
        grams: 150,
      },
      [
        {
          id: "custom_food_1",
          slug: "custom-custom_food_1",
          nameRu: "House yogurt",
          nameEn: "House yogurt",
          isCustom: true,
          caloriesPer100g: 90,
          proteinPer100g: 10,
          fatPer100g: 2,
          carbsPer100g: 4,
          aliases: [
            {
              alias: "House yogurt",
              languageCode: "custom",
              normalizedAlias: "house yogurt",
            },
          ],
        },
      ],
    );

    assert.equal(match.status, "matched");
    assert.equal(match.status === "matched" ? match.food.isCustom : false, true);
  });
});

describe("recent foods", () => {
  it("deduplicates recent foods by source while keeping latest amounts", () => {
    const recentFoods = selectRecentFoodsFromItems([
      recentItem("item_latest", "food_rice", null, "Rice", 250, "2026-06-08T10:00:00.000Z"),
      recentItem("item_old", "food_rice", null, "Rice", 100, "2026-06-07T10:00:00.000Z"),
      recentItem("item_custom", null, "custom_yogurt", "House yogurt", 150, "2026-06-06T10:00:00.000Z"),
    ]);

    assert.deepEqual(
      recentFoods.map((food) => ({
        id: food.id,
        grams: food.grams,
      })),
      [
        { id: "item_latest", grams: 250 },
        { id: "item_custom", grams: 150 },
      ],
    );
  });

  it("builds quick re-log create data from a global food item", () => {
    const data = buildQuickRelogMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      sourceItem: {
        foodId: "food_rice",
        customFoodId: null,
        matchedName: "Rice",
        quantity: 250,
        unit: "g",
        grams: 250,
        calories: 325,
        proteinG: 5.95,
        fatG: 0.525,
        carbsG: 71.475,
      },
      consumedAt: new Date("2026-06-08T10:00:00.000Z"),
    }) as any;

    assert.equal(data.rawText, "relog:Rice");
    assert.equal(data.totalCalories, 325);
    assert.equal(data.items.create[0].food.connect.id, "food_rice");
  });

  it("builds quick re-log create data from a custom food item", () => {
    const data = buildQuickRelogMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      sourceItem: {
        foodId: null,
        customFoodId: "custom_yogurt",
        matchedName: "House yogurt",
        quantity: 150,
        unit: "g",
        grams: 150,
        calories: 135,
        proteinG: 15,
        fatG: 3,
        carbsG: 6,
      },
    }) as any;

    assert.equal(data.items.create[0].customFood.connect.id, "custom_yogurt");
    assert.equal(data.items.create[0].food, undefined);
  });

  it("formats recent foods for quick re-log", () => {
    const text = formatRecentFoods("en", [
      {
        id: "item_1",
        name: "Rice",
        grams: 250,
        calories: 325,
        proteinG: 5.95,
        fatG: 0.525,
        carbsG: 71.475,
        consumedAt: new Date("2026-06-08T10:00:00.000Z"),
      },
    ]);

    assert.match(text, /Recent foods:/);
    assert.match(text, /1\. Rice  250 g, 325 kcal/);
  });
});

describe("daily totals", () => {
  it("computes day boundaries in the user's timezone", () => {
    const referenceDate = new Date("2026-06-07T22:30:00.000Z");
    const parisRange = getZonedDayRange(referenceDate, "Europe/Paris");
    const newYorkRange = getZonedDayRange(referenceDate, "America/New_York");

    assert.equal(parisRange.start.toISOString(), "2026-06-07T22:00:00.000Z");
    assert.equal(parisRange.end.toISOString(), "2026-06-08T22:00:00.000Z");
    assert.equal(newYorkRange.start.toISOString(), "2026-06-07T04:00:00.000Z");
    assert.equal(newYorkRange.end.toISOString(), "2026-06-08T04:00:00.000Z");
  });

  it("sums todays meals", () => {
    const totals = sumDailyTotals([
      {
        totalCalories: 330,
        totalProteinG: 62,
        totalFatG: 7.2,
        totalCarbsG: 0,
      },
      {
        totalCalories: 325,
        totalProteinG: 5.95,
        totalFatG: 0.525,
        totalCarbsG: 71.475,
      },
    ]);

    assert.equal(totals.calories, 655);
    assert.equal(totals.proteinG, 67.95);
    assertApproxEqual(totals.fatG, 7.725);
    assert.equal(totals.carbsG, 71.475);
  });

  it("formats totals against targets", () => {
    const text = formatDailyTotals("en", {
      totals: {
        calories: 655,
        proteinG: 67.95,
        fatG: 7.725,
        carbsG: 71.475,
      },
      targets: {
        caloriesTarget: 2300,
        proteinTargetG: 160,
        fatTargetG: 70,
        carbsTargetG: 250,
      },
    });

    assert.match(text, /Calories 655 \/ 2300/);
    assert.match(text, /Protein 68 \/ 160/);
    assert.match(text, /Fat 8 \/ 70/);
    assert.match(text, /Carbs 71 \/ 250/);
  });
});

function assertApproxEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 0.000001);
}

function recentItem(
  id: string,
  foodId: string | null,
  customFoodId: string | null,
  matchedName: string,
  grams: number,
  consumedAt: string,
) {
  return {
    id,
    foodId,
    customFoodId,
    matchedName,
    grams,
    calories: grams,
    proteinG: 1,
    fatG: 2,
    carbsG: 3,
    mealEntry: {
      consumedAt: new Date(consumedAt),
    },
  };
}

function mealEntrySummary(id: string, consumedAt: string, createdAt: string) {
  return {
    id,
    consumedAt: new Date(consumedAt),
    createdAt: new Date(createdAt),
  };
}
```

## 2. Behavior Explanation

### Exact Resolution Order
1. Deterministic parser and deterministic catalog/custom-food matching run first.
2. If a parsed item is not found, learned memory lookup runs by exact normalized input or exact learned alias.
3. If learned memory does not match, structured OpenAI fallback may run.
4. If OpenAI is unavailable, invalid, low confidence, or asks for clarification, the bot returns the existing graceful unsupported response.

### When OpenAI Is Called
OpenAI is called only from `resolveFoodFallback` after deterministic matching fails and learned lookup returns no candidate. Parse-failure text also enters `resolveFoodFallback`, so learned memory is checked before OpenAI there as well.

### When OpenAI Is Skipped
OpenAI is skipped for deterministic supported foods, deterministic custom foods, learned exact normalized hits, learned exact alias hits, empty/noisy inputs that do not look food-like, missing API key, and existing ambiguous deterministic matches.

### Normalized Input Storage
Learned memory uses `normalizeFoodText(rawInput)` and stores it in `LearnedFoodCandidate.normalizedInput`. The original text is kept in `rawInput`. Aliases are stored separately in `aliasesJson`.

### Learned Lookup
V1 lookup is conservative: fetch non-rejected learned candidates for the user or global scope, prefer user-specific rows, then match exact `normalizedInput`, then exact normalized alias from `aliasesJson`. No fuzzy matching is used.

### Repeated Inputs
Repeated same normalized inputs resolve from learned memory and increment `timesSeen`; OpenAI is not called again.

### Invalid OpenAI Responses
OpenAI adapter failures return `failed` or `unavailable`. Resolver validates the parsed payload with zod, rejects malformed payloads, `confidence < 0.65`, or `needsClarification=true`, and returns `not_found` without saving or inventing macros.

### Learned Data Separation
Learned data is stored in `LearnedFoodCandidate`, not `NutritionFood`. Learned `NutritionFoodRecord` values are transient for calculation and have `isLearned: true`; meal item persistence stores macros and matched name without connecting `foodId` or `customFoodId`.

### Estimate vs Exact
OpenAI payload includes `isEstimate`; it is saved to learned memory and propagated to parsed/calculated items. Existing item formatting appends the estimate suffix for estimated items. Exact fallback outputs may set `isEstimate=false`, but unsupported/low-confidence cases fail closed.

### Deterministic Supported Foods
Deterministic supported foods still bypass OpenAI because `resolveParsedFoodItemWithFallback` returns immediately on `matchFoodCandidate(...).status === "matched"`.

## 3. Verification Evidence

### Build Output
```text
> forma-prime@1.0.0 build
> tsc
```

### Targeted Test Output
```text
node_modules\.bin\tsx.cmd --test tests\learned-food-fallback.test.ts tests\openai-food-fallback.test.ts tests\meals.test.ts tests\nutrition.test.ts tests\polish.test.ts
tests 83
suites 16
pass 83
fail 0
```

### Full Suite Output
```text
npm.cmd test
tests 162
suites 37
pass 162
fail 0
```

### git status --short
```text

```

### git log --oneline -5
```text
9da2b0b test: cover learned fallback reuse and safe failures
5cfcdb8 feat: add structured OpenAI food fallback resolver
43ca9de feat: add learned food memory lookup
c4d44aa feat: add learned food fallback persistence schema
50c1de8 test: cover expanded food parsing and dish estimates
```