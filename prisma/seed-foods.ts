import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedFood = {
  slug: string;
  nameRu: string;
  nameEn: string;
  category: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  aliases: {
    en: string[];
    ru: string[];
  };
};

const source = {
  sourceType: "CURATED_GENERIC",
  sourceName: "Forma Prime generic v1",
  sourceUrl: "https://fdc.nal.usda.gov/",
  sourceUpdatedAt: new Date("2026-06-06T00:00:00.000Z"),
  isVerified: true,
  isActive: true,
};

const foods: SeedFood[] = [
  {
    slug: "chicken-breast-cooked-skinless",
    nameRu: "Куриная грудка, готовая, без кожи",
    nameEn: "Chicken breast, cooked, skinless",
    category: "protein",
    caloriesPer100g: 165,
    proteinPer100g: 31,
    fatPer100g: 3.6,
    carbsPer100g: 0,
    aliases: {
      en: ["chicken breast", "cooked chicken breast", "chicken fillet"],
      ru: ["куриная грудка", "куриной грудки", "куриное филе", "куриного филе"],
    },
  },
  {
    slug: "chicken-thigh-cooked-skinless",
    nameRu: "Куриное бедро, готовое, без кожи",
    nameEn: "Chicken thigh, cooked, skinless",
    category: "protein",
    caloriesPer100g: 209,
    proteinPer100g: 26,
    fatPer100g: 10.9,
    carbsPer100g: 0,
    aliases: {
      en: ["chicken thigh", "cooked chicken thigh"],
      ru: ["куриное бедро", "куриного бедра", "бедро куриное"],
    },
  },
  {
    slug: "egg-whole",
    nameRu: "Яйцо куриное",
    nameEn: "Egg, whole",
    category: "protein",
    caloriesPer100g: 143,
    proteinPer100g: 12.6,
    fatPer100g: 9.5,
    carbsPer100g: 0.7,
    aliases: {
      en: ["egg", "eggs", "whole egg"],
      ru: ["яйцо", "яйца", "куриное яйцо", "куриные яйца"],
    },
  },
  {
    slug: "cottage-cheese-5-percent",
    nameRu: "Творог 5%",
    nameEn: "Cottage cheese 5%",
    category: "protein",
    caloriesPer100g: 121,
    proteinPer100g: 17,
    fatPer100g: 5,
    carbsPer100g: 1.8,
    aliases: {
      en: ["cottage cheese", "tvorog", "quark"],
      ru: ["творог", "творога", "творог 5"],
    },
  },
  {
    slug: "tuna-canned-in-water",
    nameRu: "Тунец консервированный в воде",
    nameEn: "Tuna, canned in water",
    category: "protein",
    caloriesPer100g: 116,
    proteinPer100g: 25.5,
    fatPer100g: 0.8,
    carbsPer100g: 0,
    aliases: {
      en: ["tuna", "canned tuna", "tuna in water"],
      ru: ["тунец", "тунца", "консервированный тунец"],
    },
  },
  {
    slug: "beef-lean-cooked",
    nameRu: "Говядина постная, готовая",
    nameEn: "Beef, lean, cooked",
    category: "protein",
    caloriesPer100g: 217,
    proteinPer100g: 26.1,
    fatPer100g: 11.8,
    carbsPer100g: 0,
    aliases: {
      en: ["beef", "lean beef", "cooked beef"],
      ru: ["говядина", "говядины", "постная говядина"],
    },
  },
  {
    slug: "turkey-breast-cooked",
    nameRu: "Индейка грудка, готовая",
    nameEn: "Turkey breast, cooked",
    category: "protein",
    caloriesPer100g: 135,
    proteinPer100g: 29,
    fatPer100g: 1.6,
    carbsPer100g: 0,
    aliases: {
      en: ["turkey", "turkey breast", "cooked turkey"],
      ru: ["индейка", "индейки", "грудка индейки"],
    },
  },
  {
    slug: "salmon-cooked",
    nameRu: "Лосось, готовый",
    nameEn: "Salmon, cooked",
    category: "protein",
    caloriesPer100g: 206,
    proteinPer100g: 22.1,
    fatPer100g: 12.4,
    carbsPer100g: 0,
    aliases: {
      en: ["salmon", "cooked salmon"],
      ru: ["лосось", "лосося", "семга", "семги"],
    },
  },
  {
    slug: "white-rice-cooked",
    nameRu: "Рис белый, вареный",
    nameEn: "White rice, cooked",
    category: "carb",
    caloriesPer100g: 130,
    proteinPer100g: 2.38,
    fatPer100g: 0.21,
    carbsPer100g: 28.59,
    aliases: {
      en: ["cooked rice", "white rice", "rice"],
      ru: ["рис", "риса", "вареный рис", "белый рис"],
    },
  },
  {
    slug: "buckwheat-cooked",
    nameRu: "Гречка, вареная",
    nameEn: "Buckwheat, cooked",
    category: "carb",
    caloriesPer100g: 92,
    proteinPer100g: 3.4,
    fatPer100g: 0.6,
    carbsPer100g: 19.9,
    aliases: {
      en: ["buckwheat", "cooked buckwheat"],
      ru: ["гречка", "гречки", "вареная гречка", "гречневая каша"],
    },
  },
  {
    slug: "oatmeal-cooked-water",
    nameRu: "Овсянка на воде",
    nameEn: "Oatmeal on water",
    category: "carb",
    caloriesPer100g: 71,
    proteinPer100g: 2.5,
    fatPer100g: 1.5,
    carbsPer100g: 12,
    aliases: {
      en: ["oatmeal", "oatmeal on water", "cooked oats"],
      ru: ["овсянка", "овсянки", "овсяная каша", "овсянка на воде"],
    },
  },
  {
    slug: "potato-boiled",
    nameRu: "Картофель вареный",
    nameEn: "Potato, boiled",
    category: "carb",
    caloriesPer100g: 87,
    proteinPer100g: 1.9,
    fatPer100g: 0.1,
    carbsPer100g: 20.1,
    aliases: {
      en: ["potato", "boiled potato", "potatoes"],
      ru: ["картофель", "картофеля", "картошка", "вареная картошка"],
    },
  },
  {
    slug: "pasta-cooked",
    nameRu: "Паста вареная",
    nameEn: "Pasta, cooked",
    category: "carb",
    caloriesPer100g: 158,
    proteinPer100g: 5.8,
    fatPer100g: 0.9,
    carbsPer100g: 30.9,
    aliases: {
      en: ["pasta", "cooked pasta", "macaroni"],
      ru: ["паста", "пасты", "макароны", "макарон"],
    },
  },
  {
    slug: "banana",
    nameRu: "Банан",
    nameEn: "Banana",
    category: "fruit",
    caloriesPer100g: 89,
    proteinPer100g: 1.1,
    fatPer100g: 0.3,
    carbsPer100g: 22.8,
    aliases: {
      en: ["banana", "bananas"],
      ru: ["банан", "банана", "бананы"],
    },
  },
  {
    slug: "olive-oil",
    nameRu: "Оливковое масло",
    nameEn: "Olive oil",
    category: "fat",
    caloriesPer100g: 884,
    proteinPer100g: 0,
    fatPer100g: 100,
    carbsPer100g: 0,
    aliases: {
      en: ["olive oil"],
      ru: ["оливковое масло", "оливкового масла"],
    },
  },
  {
    slug: "butter",
    nameRu: "Сливочное масло",
    nameEn: "Butter",
    category: "fat",
    caloriesPer100g: 717,
    proteinPer100g: 0.9,
    fatPer100g: 81.1,
    carbsPer100g: 0.1,
    aliases: {
      en: ["butter"],
      ru: ["сливочное масло", "масло сливочное", "сливочного масла"],
    },
  },
  {
    slug: "peanuts",
    nameRu: "Арахис",
    nameEn: "Peanuts",
    category: "fat",
    caloriesPer100g: 567,
    proteinPer100g: 25.8,
    fatPer100g: 49.2,
    carbsPer100g: 16.1,
    aliases: {
      en: ["peanuts", "nuts"],
      ru: ["арахис", "арахиса", "орехи", "орехов"],
    },
  },
  {
    slug: "peanut-butter",
    nameRu: "Арахисовая паста",
    nameEn: "Peanut butter",
    category: "fat",
    caloriesPer100g: 588,
    proteinPer100g: 25,
    fatPer100g: 50,
    carbsPer100g: 20,
    aliases: {
      en: ["peanut butter"],
      ru: ["арахисовая паста", "арахисовой пасты"],
    },
  },
  {
    slug: "bread-white",
    nameRu: "Белый хлеб",
    nameEn: "White bread",
    category: "basic",
    caloriesPer100g: 265,
    proteinPer100g: 9,
    fatPer100g: 3.2,
    carbsPer100g: 49,
    aliases: {
      en: ["bread", "white bread"],
      ru: ["хлеб", "хлеба", "белый хлеб"],
    },
  },
  {
    slug: "cheese-hard",
    nameRu: "Сыр твердый",
    nameEn: "Hard cheese",
    category: "basic",
    caloriesPer100g: 402,
    proteinPer100g: 25,
    fatPer100g: 33,
    carbsPer100g: 1.3,
    aliases: {
      en: ["cheese", "hard cheese"],
      ru: ["сыр", "сыра", "твердый сыр"],
    },
  },
  {
    slug: "milk-2-5-percent",
    nameRu: "Молоко 2.5%",
    nameEn: "Milk 2.5%",
    category: "basic",
    caloriesPer100g: 52,
    proteinPer100g: 3,
    fatPer100g: 2.5,
    carbsPer100g: 4.8,
    aliases: {
      en: ["milk", "milk 2.5"],
      ru: ["молоко", "молока", "молоко 2.5"],
    },
  },
  {
    slug: "kefir-2-5-percent",
    nameRu: "Кефир 2.5%",
    nameEn: "Kefir 2.5%",
    category: "basic",
    caloriesPer100g: 53,
    proteinPer100g: 3,
    fatPer100g: 2.5,
    carbsPer100g: 4,
    aliases: {
      en: ["kefir"],
      ru: ["кефир", "кефира"],
    },
  },
  {
    slug: "yogurt-plain",
    nameRu: "Йогурт натуральный",
    nameEn: "Plain yogurt",
    category: "basic",
    caloriesPer100g: 61,
    proteinPer100g: 3.5,
    fatPer100g: 3.3,
    carbsPer100g: 4.7,
    aliases: {
      en: ["yogurt", "plain yogurt"],
      ru: ["йогурт", "йогурта", "натуральный йогурт"],
    },
  },
];

function normalizeFoodText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function seedFoods(): Promise<void> {
  for (const food of foods) {
    const savedFood = await prisma.nutritionFood.upsert({
      where: { slug: food.slug },
      create: {
        slug: food.slug,
        nameRu: food.nameRu,
        nameEn: food.nameEn,
        category: food.category,
        baseAmount: 100,
        baseUnit: "g",
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        fatPer100g: food.fatPer100g,
        carbsPer100g: food.carbsPer100g,
        ...source,
      },
      update: {
        nameRu: food.nameRu,
        nameEn: food.nameEn,
        category: food.category,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        fatPer100g: food.fatPer100g,
        carbsPer100g: food.carbsPer100g,
        ...source,
      },
    });

    await prisma.nutritionFoodAlias.deleteMany({
      where: { foodId: savedFood.id },
    });

    for (const [languageCode, aliases] of Object.entries(food.aliases)) {
      for (const alias of aliases) {
        await prisma.nutritionFoodAlias.create({
          data: {
            foodId: savedFood.id,
            alias,
            languageCode,
            normalizedAlias: normalizeFoodText(alias),
          },
        });
      }
    }
  }
}

seedFoods()
  .then(async () => {
    console.info(`Seeded ${foods.length} nutrition foods.`);
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Food seed failed", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
