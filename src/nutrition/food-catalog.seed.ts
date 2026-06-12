import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import { normalizeFoodText } from "./food-normalization.js";

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

const foodCatalogSource = {
  sourceType: "CURATED_GENERIC",
  sourceName: "Forma Prime starter catalog v1",
  sourceUrl: "https://fdc.nal.usda.gov/",
  sourceUpdatedAt: new Date("2026-06-11T00:00:00.000Z"),
  isVerified: true,
  isActive: true,
};

export const essentialSeedFoods: SeedFood[] = [
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
      ru: [
        "куриная грудка",
        "куриной грудки",
        "варёная куриная грудка",
        "вареная куриная грудка",
        "варёной куриной грудки",
        "вареной куриной грудки",
        "жареная грудка",
        "жареной грудки",
        "вареная грудка",
        "вареной грудки",
        "куриное филе",
        "куриного филе",
        "курица",
        "курицы",
        "грудка",
        "грудки",
      ],
    },
  },
  {
    slug: "chicken-breast-fried",
    nameRu: "Куриная грудка, жареная",
    nameEn: "Chicken breast, fried",
    category: "protein",
    caloriesPer100g: 190,
    proteinPer100g: 30,
    fatPer100g: 7,
    carbsPer100g: 0,
    aliases: {
      en: ["fried chicken breast", "pan fried chicken breast"],
      ru: [
        "жарёная куриная грудка",
        "жареная куриная грудка",
        "жарёной куриной грудки",
        "жареной куриной грудки",
      ],
    },
  },
  {
    slug: "turkey-cooked",
    nameRu: "Индейка, готовая",
    nameEn: "Turkey, cooked",
    category: "protein",
    caloriesPer100g: 135,
    proteinPer100g: 29,
    fatPer100g: 1.6,
    carbsPer100g: 0,
    aliases: {
      en: ["turkey", "cooked turkey", "turkey breast"],
      ru: ["индейка", "индейки", "филе индейки", "грудка индейки"],
    },
  },
  {
    slug: "beef-lean-cooked",
    nameRu: "Говядина постная, готовая",
    nameEn: "Lean beef, cooked",
    category: "protein",
    caloriesPer100g: 217,
    proteinPer100g: 26.1,
    fatPer100g: 11.8,
    carbsPer100g: 0,
    aliases: {
      en: ["beef", "lean beef", "cooked beef"],
      ru: ["говядина", "говядины", "постная говядина", "готовая говядина"],
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
      ru: ["тунец", "тунца", "консервированный тунец", "тунец в воде"],
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
      ru: [
        "яйцо",
        "яйца",
        "яиц",
        "куриное яйцо",
        "куриные яйца",
        "варенных яйца",
        "варенных яиц",
      ],
    },
  },
  {
    slug: "egg-boiled",
    nameRu: "Яйцо вареное",
    nameEn: "Boiled egg",
    category: "protein",
    caloriesPer100g: 155,
    proteinPer100g: 12.6,
    fatPer100g: 10.6,
    carbsPer100g: 1.1,
    aliases: {
      en: ["boiled egg", "boiled eggs", "hard boiled egg"],
      ru: [
        "варёное яйцо",
        "вареное яйцо",
        "варёные яйца",
        "вареные яйца",
        "варёных яйца",
        "вареных яйца",
        "варёных яиц",
        "вареных яиц",
      ],
    },
  },
  {
    slug: "egg-fried",
    nameRu: "Яйцо жареное",
    nameEn: "Fried egg",
    category: "protein",
    caloriesPer100g: 196,
    proteinPer100g: 13.6,
    fatPer100g: 14.8,
    carbsPer100g: 0.8,
    aliases: {
      en: ["fried egg", "fried eggs"],
      ru: [
        "жарёное яйцо",
        "жареное яйцо",
        "жарёные яйца",
        "жареные яйца",
        "жарёных яйца",
        "жареных яйца",
        "жарёных яиц",
        "жареных яиц",
      ],
    },
  },
  {
    slug: "cottage-cheese",
    nameRu: "Творог 5%",
    nameEn: "Cottage cheese 5%",
    category: "protein",
    caloriesPer100g: 121,
    proteinPer100g: 17,
    fatPer100g: 5,
    carbsPer100g: 1.8,
    aliases: {
      en: ["cottage cheese", "tvorog", "quark"],
      ru: ["творог", "творога", "творог 5", "творог 5%"],
    },
  },
  {
    slug: "greek-yogurt",
    nameRu: "Греческий йогурт",
    nameEn: "Greek yogurt",
    category: "protein",
    caloriesPer100g: 73,
    proteinPer100g: 9,
    fatPer100g: 2,
    carbsPer100g: 3.8,
    aliases: {
      en: ["greek yogurt", "plain greek yogurt"],
      ru: ["греческий йогурт", "греческого йогурта", "йогурт греческий"],
    },
  },
  {
    slug: "plain-yogurt",
    nameRu: "Йогурт натуральный",
    nameEn: "Plain yogurt",
    category: "protein",
    caloriesPer100g: 61,
    proteinPer100g: 3.5,
    fatPer100g: 3.3,
    carbsPer100g: 4.7,
    aliases: {
      en: ["yogurt", "plain yogurt", "natural yogurt"],
      ru: ["йогурт", "йогурта", "натуральный йогурт", "натурального йогурта"],
    },
  },
  {
    slug: "fruit-yogurt",
    nameRu: "Фруктовый йогурт",
    nameEn: "Fruit yogurt",
    category: "protein",
    caloriesPer100g: 95,
    proteinPer100g: 3.5,
    fatPer100g: 2.5,
    carbsPer100g: 14,
    aliases: {
      en: ["fruit yogurt", "sweet yogurt"],
      ru: ["фруктовый йогурт", "сладкий йогурт", "йогурт фруктовый"],
    },
  },
  {
    slug: "drinkable-yogurt",
    nameRu: "Питьевой йогурт",
    nameEn: "Drinkable yogurt",
    category: "protein",
    caloriesPer100g: 78,
    proteinPer100g: 3,
    fatPer100g: 2.5,
    carbsPer100g: 11,
    aliases: {
      en: ["drinkable yogurt", "drinking yogurt"],
      ru: ["питьевой йогурт", "йогурт питьевой"],
    },
  },
  {
    slug: "protein-yogurt",
    nameRu: "Протеиновый йогурт",
    nameEn: "Protein yogurt",
    category: "protein",
    caloriesPer100g: 80,
    proteinPer100g: 10,
    fatPer100g: 1.5,
    carbsPer100g: 6,
    aliases: {
      en: ["protein yogurt", "high protein yogurt"],
      ru: ["протеиновый йогурт", "йогурт протеиновый", "высокобелковый йогурт"],
    },
  },
  {
    slug: "omelet",
    nameRu: "Омлет",
    nameEn: "Omelet",
    category: "protein",
    caloriesPer100g: 154,
    proteinPer100g: 10.6,
    fatPer100g: 11.7,
    carbsPer100g: 1.6,
    aliases: {
      en: ["omelet", "omelette"],
      ru: ["омлет", "омлета"],
    },
  },
  {
    slug: "syrniki",
    nameRu: "Сырники",
    nameEn: "Syrniki",
    category: "quick_meal",
    caloriesPer100g: 230,
    proteinPer100g: 13,
    fatPer100g: 9,
    carbsPer100g: 24,
    aliases: {
      en: ["syrniki", "cottage cheese pancakes"],
      ru: ["сырники", "сырников", "творожные сырники"],
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
    slug: "cod-cooked",
    nameRu: "Треска, готовая",
    nameEn: "Cod, cooked",
    category: "protein",
    caloriesPer100g: 105,
    proteinPer100g: 23,
    fatPer100g: 0.9,
    carbsPer100g: 0,
    aliases: {
      en: ["cod", "cooked cod", "white fish"],
      ru: ["треска", "трески", "белая рыба", "рыба белая"],
    },
  },
  {
    slug: "shrimp-cooked",
    nameRu: "Креветки, готовые",
    nameEn: "Shrimp, cooked",
    category: "protein",
    caloriesPer100g: 99,
    proteinPer100g: 24,
    fatPer100g: 0.3,
    carbsPer100g: 0.2,
    aliases: {
      en: ["shrimp", "cooked shrimp", "prawns"],
      ru: ["креветки", "креветок", "креветки вареные"],
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
      ru: [
        "рис",
        "риса",
        "варёный рис",
        "вареный рис",
        "варёного риса",
        "вареного риса",
        "белый рис",
      ],
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
      ru: [
        "гречка",
        "гречки",
        "варёная гречка",
        "вареная гречка",
        "варёной гречки",
        "вареной гречки",
        "гречневая каша",
      ],
    },
  },
  {
    slug: "pasta-cooked",
    nameRu: "Макароны вареные",
    nameEn: "Pasta, cooked",
    category: "carb",
    caloriesPer100g: 158,
    proteinPer100g: 5.8,
    fatPer100g: 0.9,
    carbsPer100g: 30.9,
    aliases: {
      en: ["pasta", "cooked pasta", "macaroni"],
      ru: [
        "макароны",
        "макарон",
        "варёные макароны",
        "вареные макароны",
        "варёных макарон",
        "вареных макарон",
        "паста",
      ],
    },
  },
  {
    slug: "oats-dry",
    nameRu: "Овсяные хлопья",
    nameEn: "Oats, dry",
    category: "carb",
    caloriesPer100g: 389,
    proteinPer100g: 16.9,
    fatPer100g: 6.9,
    carbsPer100g: 66.3,
    aliases: {
      en: ["oats", "rolled oats", "oat flakes"],
      ru: ["овсянка", "овсянки", "овсяные хлопья", "геркулес"],
    },
  },
  {
    slug: "oatmeal-cooked",
    nameRu: "Овсяная каша",
    nameEn: "Oatmeal, cooked",
    category: "carb",
    caloriesPer100g: 88,
    proteinPer100g: 3,
    fatPer100g: 1.7,
    carbsPer100g: 15,
    aliases: {
      en: ["oatmeal cooked", "cooked oatmeal", "porridge"],
      ru: [
        "овсяная каша",
        "овсяной каши",
        "овсянка вареная",
        "овсянка варёная",
        "овсянка на молоке",
      ],
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
    slug: "lavash",
    nameRu: "Лаваш",
    nameEn: "Lavash",
    category: "carb",
    caloriesPer100g: 275,
    proteinPer100g: 9,
    fatPer100g: 1.2,
    carbsPer100g: 56,
    aliases: {
      en: ["lavash", "flatbread"],
      ru: ["лаваш", "лаваша", "1 лаваш"],
    },
  },
  {
    slug: "tortilla",
    nameRu: "Тортилья",
    nameEn: "Tortilla",
    category: "carb",
    caloriesPer100g: 310,
    proteinPer100g: 8,
    fatPer100g: 8,
    carbsPer100g: 52,
    aliases: {
      en: ["tortilla", "wrap tortilla"],
      ru: ["тортилья", "тортильи", "лепешка тортилья", "лепёшка тортилья"],
    },
  },
  {
    slug: "bread",
    nameRu: "Хлеб",
    nameEn: "Bread",
    category: "carb",
    caloriesPer100g: 250,
    proteinPer100g: 8,
    fatPer100g: 3,
    carbsPer100g: 49,
    aliases: {
      en: ["bread", "white bread", "slice of bread"],
      ru: ["хлеб", "хлеба", "кусок хлеба", "белый хлеб"],
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
    slug: "apple",
    nameRu: "Яблоко",
    nameEn: "Apple",
    category: "fruit",
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    fatPer100g: 0.2,
    carbsPer100g: 13.8,
    aliases: {
      en: ["apple", "apples"],
      ru: ["яблоко", "яблока", "яблоки"],
    },
  },
  {
    slug: "orange",
    nameRu: "Апельсин",
    nameEn: "Orange",
    category: "fruit",
    caloriesPer100g: 47,
    proteinPer100g: 0.9,
    fatPer100g: 0.1,
    carbsPer100g: 11.8,
    aliases: {
      en: ["orange", "oranges"],
      ru: ["апельсин", "апельсина", "апельсины"],
    },
  },
  {
    slug: "cucumber",
    nameRu: "Огурец",
    nameEn: "Cucumber",
    category: "vegetable",
    caloriesPer100g: 15,
    proteinPer100g: 0.7,
    fatPer100g: 0.1,
    carbsPer100g: 3.6,
    aliases: {
      en: ["cucumber", "cucumbers"],
      ru: ["огурец", "огурца", "огурцы"],
    },
  },
  {
    slug: "tomato",
    nameRu: "Помидор",
    nameEn: "Tomato",
    category: "vegetable",
    caloriesPer100g: 18,
    proteinPer100g: 0.9,
    fatPer100g: 0.2,
    carbsPer100g: 3.9,
    aliases: {
      en: ["tomato", "tomatoes"],
      ru: ["помидор", "помидора", "помидоры", "томат", "томаты"],
    },
  },
  {
    slug: "lettuce",
    nameRu: "Салат листовой",
    nameEn: "Lettuce",
    category: "vegetable",
    caloriesPer100g: 15,
    proteinPer100g: 1.4,
    fatPer100g: 0.2,
    carbsPer100g: 2.9,
    aliases: {
      en: ["lettuce", "salad leaves"],
      ru: ["салат", "листья салата", "листовой салат"],
    },
  },
  {
    slug: "vegetable-salad",
    nameRu: "Овощной салат",
    nameEn: "Vegetable salad",
    category: "quick_meal",
    caloriesPer100g: 45,
    proteinPer100g: 1.5,
    fatPer100g: 2,
    carbsPer100g: 5,
    aliases: {
      en: ["vegetable salad", "veggie salad"],
      ru: ["овощной салат", "салат овощной", "салат из овощей"],
    },
  },
  {
    slug: "mayo-salad",
    nameRu: "Салат с майонезом",
    nameEn: "Mayo-based salad",
    category: "quick_meal",
    caloriesPer100g: 220,
    proteinPer100g: 6,
    fatPer100g: 17,
    carbsPer100g: 10,
    aliases: {
      en: ["mayo salad", "mayonnaise salad"],
      ru: ["салат с майонезом", "майонезный салат", "калорийный салат"],
    },
  },
  {
    slug: "greens",
    nameRu: "Зелень",
    nameEn: "Greens",
    category: "vegetable",
    caloriesPer100g: 30,
    proteinPer100g: 2.5,
    fatPer100g: 0.5,
    carbsPer100g: 5,
    aliases: {
      en: ["greens", "herbs"],
      ru: ["зелень", "зелени", "укроп", "петрушка"],
    },
  },
  {
    slug: "carrot",
    nameRu: "Морковь",
    nameEn: "Carrot",
    category: "vegetable",
    caloriesPer100g: 41,
    proteinPer100g: 0.9,
    fatPer100g: 0.2,
    carbsPer100g: 9.6,
    aliases: {
      en: ["carrot", "carrots"],
      ru: ["морковь", "моркови", "морковка"],
    },
  },
  {
    slug: "cabbage",
    nameRu: "Капуста",
    nameEn: "Cabbage",
    category: "vegetable",
    caloriesPer100g: 25,
    proteinPer100g: 1.3,
    fatPer100g: 0.1,
    carbsPer100g: 5.8,
    aliases: {
      en: ["cabbage"],
      ru: ["капуста", "капусты"],
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
      ru: ["сливочное масло", "сливочного масла", "масло сливочное"],
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
    slug: "almonds",
    nameRu: "Миндаль",
    nameEn: "Almonds",
    category: "fat",
    caloriesPer100g: 579,
    proteinPer100g: 21.2,
    fatPer100g: 49.9,
    carbsPer100g: 21.6,
    aliases: {
      en: ["almonds", "nuts"],
      ru: ["миндаль", "миндаля", "орехи", "орехов"],
    },
  },
  {
    slug: "avocado",
    nameRu: "Авокадо",
    nameEn: "Avocado",
    category: "fat",
    caloriesPer100g: 160,
    proteinPer100g: 2,
    fatPer100g: 14.7,
    carbsPer100g: 8.5,
    aliases: {
      en: ["avocado"],
      ru: ["авокадо"],
    },
  },
  {
    slug: "ketchup-zero",
    nameRu: "Кетчуп zero",
    nameEn: "Ketchup zero",
    category: "sauce",
    caloriesPer100g: 30,
    proteinPer100g: 1,
    fatPer100g: 0,
    carbsPer100g: 6,
    aliases: {
      en: ["ketchup zero", "zero ketchup", "sugar free ketchup"],
      ru: ["кетчуп zero", "кетчуп зеро", "кетчуп без сахара"],
    },
  },
  {
    slug: "hot-sauce",
    nameRu: "Острый соус",
    nameEn: "Hot sauce",
    category: "sauce",
    caloriesPer100g: 25,
    proteinPer100g: 1,
    fatPer100g: 0,
    carbsPer100g: 5,
    aliases: {
      en: ["hot sauce", "chili sauce"],
      ru: ["острый соус", "чили соус", "соус чили"],
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
    slug: "hard-cheese",
    nameRu: "Сыр твердый",
    nameEn: "Hard cheese",
    category: "basic",
    caloriesPer100g: 402,
    proteinPer100g: 25,
    fatPer100g: 33,
    carbsPer100g: 1.3,
    aliases: {
      en: ["cheese", "hard cheese"],
      ru: ["сыр", "сыра", "твердый сыр", "твёрдый сыр"],
    },
  },
  {
    slug: "sour-cream",
    nameRu: "Сметана",
    nameEn: "Sour cream",
    category: "basic",
    caloriesPer100g: 206,
    proteinPer100g: 2.8,
    fatPer100g: 20,
    carbsPer100g: 3.2,
    aliases: {
      en: ["sour cream"],
      ru: ["сметана", "сметаны"],
    },
  },
  {
    slug: "honey",
    nameRu: "Мед",
    nameEn: "Honey",
    category: "basic",
    caloriesPer100g: 304,
    proteinPer100g: 0.3,
    fatPer100g: 0,
    carbsPer100g: 82.4,
    aliases: {
      en: ["honey"],
      ru: ["мед", "мёд", "меда", "мёда"],
    },
  },
  {
    slug: "whey-protein-powder",
    nameRu: "Протеин сывороточный",
    nameEn: "Whey protein powder",
    category: "protein",
    caloriesPer100g: 400,
    proteinPer100g: 80,
    fatPer100g: 6,
    carbsPer100g: 8,
    aliases: {
      en: ["protein", "protein powder", "whey protein", "scoop protein", "whey", "isolate"],
      ru: [
        "протеин",
        "протеина",
        "изолят",
        "изолята",
        "сывороточный изолят",
        "сывороточный протеин",
        "порция протеина",
        "порции протеина",
      ],
    },
  },
  {
    slug: "protein-coffee",
    nameRu: "Протеиновый кофе",
    nameEn: "Protein coffee",
    category: "quick_meal",
    caloriesPer100g: 60,
    proteinPer100g: 6,
    fatPer100g: 1.2,
    carbsPer100g: 5,
    aliases: {
      en: ["protein coffee"],
      ru: ["протеиновый кофе", "кофе с протеином"],
    },
  },
  {
    slug: "protein-ready-drink",
    nameRu: "Готовый протеиновый напиток",
    nameEn: "Ready-to-drink protein shake",
    category: "drink",
    caloriesPer100g: 55,
    proteinPer100g: 6.5,
    fatPer100g: 1.2,
    carbsPer100g: 4.5,
    aliases: {
      en: ["ready protein drink", "protein shake ready to drink"],
      ru: [
        "готовый протеиновый напиток",
        "магазинный протеиновый напиток",
        "протеиновый напиток",
      ],
    },
  },
  {
    slug: "coffee",
    nameRu: "Кофе",
    nameEn: "Coffee",
    category: "basic",
    caloriesPer100g: 2,
    proteinPer100g: 0.1,
    fatPer100g: 0,
    carbsPer100g: 0,
    aliases: {
      en: ["coffee", "black coffee"],
      ru: ["кофе", "черный кофе", "чёрный кофе"],
    },
  },
  {
    slug: "coffee-with-milk",
    nameRu: "Кофе с молоком",
    nameEn: "Coffee with milk",
    category: "quick_meal",
    caloriesPer100g: 24,
    proteinPer100g: 1.2,
    fatPer100g: 1.2,
    carbsPer100g: 2.2,
    aliases: {
      en: ["coffee with milk"],
      ru: ["кофе с молоком"],
    },
  },
  {
    slug: "cola-zero",
    nameRu: "Кола zero",
    nameEn: "Cola zero",
    category: "drink",
    caloriesPer100g: 1,
    proteinPer100g: 0,
    fatPer100g: 0,
    carbsPer100g: 0,
    aliases: {
      en: ["cola zero", "coke zero", "zero cola", "diet cola"],
      ru: ["кола зеро", "кола zero", "кока кола зеро", "напиток зеро"],
    },
  },
  {
    slug: "protein-bar",
    nameRu: "Протеиновый батончик",
    nameEn: "Protein bar",
    category: "quick_meal",
    caloriesPer100g: 333,
    proteinPer100g: 33,
    fatPer100g: 13,
    carbsPer100g: 30,
    aliases: {
      en: ["protein bar"],
      ru: ["протеиновый батончик", "протеиновый бар", "батончик протеиновый"],
    },
  },
  {
    slug: "chocolate",
    nameRu: "Шоколад",
    nameEn: "Chocolate",
    category: "sweet",
    caloriesPer100g: 535,
    proteinPer100g: 7.7,
    fatPer100g: 30,
    carbsPer100g: 59,
    aliases: {
      en: ["chocolate"],
      ru: ["шоколад", "шоколада", "шоколадка"],
    },
  },
  {
    slug: "cookie-sweet-snack",
    nameRu: "Сладость / печенье",
    nameEn: "Sweet snack / cookie",
    category: "sweet",
    caloriesPer100g: 450,
    proteinPer100g: 6,
    fatPer100g: 18,
    carbsPer100g: 66,
    aliases: {
      en: ["cookie", "sweet snack", "snack bar"],
      ru: ["печенье", "печенья", "сладость", "сладкое", "батончик"],
    },
  },
  {
    slug: "chicken-lavash-wrap",
    nameRu: "Лаваш с курицей",
    nameEn: "Chicken lavash wrap",
    category: "quick_meal",
    caloriesPer100g: 185,
    proteinPer100g: 13,
    fatPer100g: 6,
    carbsPer100g: 20,
    aliases: {
      en: ["chicken lavash wrap", "chicken wrap"],
      ru: [
        "лаваш с курицей",
        "домашняя шаурма",
        "шаурма домашняя",
        "домашние шаурмы",
        "домашнюю шаурму",
      ],
    },
  },
  {
    slug: "shawarma",
    nameRu: "Шаурма",
    nameEn: "Shawarma",
    category: "quick_meal",
    caloriesPer100g: 230,
    proteinPer100g: 11,
    fatPer100g: 10,
    carbsPer100g: 24,
    aliases: {
      en: ["shawarma"],
      ru: ["шаурма", "шаурмы", "шаурму"],
    },
  },
  {
    slug: "tacos",
    nameRu: "Такос",
    nameEn: "Tacos",
    category: "quick_meal",
    caloriesPer100g: 220,
    proteinPer100g: 11,
    fatPer100g: 10,
    carbsPer100g: 22,
    aliases: {
      en: ["taco", "tacos"],
      ru: ["такос", "тако"],
    },
  },
  {
    slug: "burrito",
    nameRu: "Буррито",
    nameEn: "Burrito",
    category: "quick_meal",
    caloriesPer100g: 210,
    proteinPer100g: 10,
    fatPer100g: 8,
    carbsPer100g: 25,
    aliases: {
      en: ["burrito"],
      ru: ["буррито"],
    },
  },
  {
    slug: "sandwich",
    nameRu: "Бутерброд / сэндвич",
    nameEn: "Sandwich",
    category: "quick_meal",
    caloriesPer100g: 240,
    proteinPer100g: 10,
    fatPer100g: 9,
    carbsPer100g: 30,
    aliases: {
      en: ["sandwich"],
      ru: ["бутерброд", "бутерброда", "бутер", "сэндвич", "сэндвича"],
    },
  },
  {
    slug: "chicken-sandwich",
    nameRu: "Сэндвич с курицей",
    nameEn: "Chicken sandwich",
    category: "quick_meal",
    caloriesPer100g: 210,
    proteinPer100g: 13,
    fatPer100g: 7,
    carbsPer100g: 24,
    aliases: {
      en: ["chicken sandwich"],
      ru: ["сэндвич с курицей", "бутерброд с курицей"],
    },
  },
  {
    slug: "cheese-sandwich",
    nameRu: "Сэндвич с сыром",
    nameEn: "Cheese sandwich",
    category: "quick_meal",
    caloriesPer100g: 270,
    proteinPer100g: 12,
    fatPer100g: 12,
    carbsPer100g: 28,
    aliases: {
      en: ["cheese sandwich"],
      ru: ["сэндвич с сыром", "бутерброд с сыром"],
    },
  },
  {
    slug: "burger",
    nameRu: "Бургер",
    nameEn: "Burger",
    category: "quick_meal",
    caloriesPer100g: 255,
    proteinPer100g: 12,
    fatPer100g: 12,
    carbsPer100g: 24,
    aliases: {
      en: ["burger", "hamburger"],
      ru: ["бургер", "гамбургер"],
    },
  },
  {
    slug: "cheeseburger",
    nameRu: "Чизбургер",
    nameEn: "Cheeseburger",
    category: "quick_meal",
    caloriesPer100g: 285,
    proteinPer100g: 14,
    fatPer100g: 15,
    carbsPer100g: 24,
    aliases: {
      en: ["cheeseburger"],
      ru: ["чизбургер"],
    },
  },
  {
    slug: "double-burger",
    nameRu: "Двойной бургер",
    nameEn: "Double burger",
    category: "quick_meal",
    caloriesPer100g: 295,
    proteinPer100g: 16,
    fatPer100g: 17,
    carbsPer100g: 20,
    aliases: {
      en: ["double burger", "double cheeseburger"],
      ru: ["двойной бургер", "двойной чизбургер"],
    },
  },
  {
    slug: "chicken-salad",
    nameRu: "Салат с курицей",
    nameEn: "Chicken salad",
    category: "quick_meal",
    caloriesPer100g: 120,
    proteinPer100g: 12,
    fatPer100g: 5,
    carbsPer100g: 6,
    aliases: {
      en: ["chicken salad"],
      ru: ["салат с курицей", "куриный салат"],
    },
  },
  {
    slug: "chicken-rice-bowl",
    nameRu: "Рис с курицей",
    nameEn: "Chicken rice bowl",
    category: "quick_meal",
    caloriesPer100g: 155,
    proteinPer100g: 13,
    fatPer100g: 3,
    carbsPer100g: 19,
    aliases: {
      en: ["chicken rice", "rice with chicken", "chicken rice bowl"],
      ru: ["рис с курицей", "курица с рисом"],
    },
  },
  {
    slug: "chicken-pasta",
    nameRu: "Паста с курицей",
    nameEn: "Chicken pasta",
    category: "quick_meal",
    caloriesPer100g: 170,
    proteinPer100g: 12,
    fatPer100g: 5,
    carbsPer100g: 20,
    aliases: {
      en: ["chicken pasta", "pasta with chicken"],
      ru: ["паста с курицей", "макароны с курицей"],
    },
  },
];

type NutritionFoodDelegate = PrismaClient["nutritionFood"];
type NutritionFoodAliasDelegate = PrismaClient["nutritionFoodAlias"];

export async function ensureEssentialNutritionFoodsSeeded(input: {
  nutritionFood?: Pick<NutritionFoodDelegate, "upsert">;
  nutritionFoodAlias?: Pick<NutritionFoodAliasDelegate, "findMany" | "create"> &
    Partial<Pick<NutritionFoodAliasDelegate, "deleteMany">>;
} = {}): Promise<void> {
  const nutritionFood = input.nutritionFood ?? prisma.nutritionFood;
  const nutritionFoodAlias = input.nutritionFoodAlias ?? prisma.nutritionFoodAlias;

  for (const food of essentialSeedFoods) {
    const savedFood = await nutritionFood.upsert(buildNutritionFoodUpsertArgs(food));
    const existingAliases = await nutritionFoodAlias.findMany({
      where: {
        foodId: savedFood.id,
      },
      select: {
        id: true,
        languageCode: true,
        normalizedAlias: true,
      },
    });

    const desiredAliases = buildNutritionFoodAliasCreateData(savedFood.id, food);
    const desiredAliasKeys = new Set(
      desiredAliases.map(
        (alias) => `${alias.languageCode}:${alias.normalizedAlias}`,
      ),
    );
    const existingAliasKeys = new Set(
      existingAliases.map(
        (alias) => `${alias.languageCode}:${alias.normalizedAlias}`,
      ),
    );
    const staleAliasIds = existingAliases
      .filter(
        (alias) =>
          !desiredAliasKeys.has(`${alias.languageCode}:${alias.normalizedAlias}`),
      )
      .map((alias) => alias.id);

    if (staleAliasIds.length > 0 && nutritionFoodAlias.deleteMany) {
      await nutritionFoodAlias.deleteMany({
        where: {
          id: {
            in: staleAliasIds,
          },
        },
      });
    }

    for (const aliasData of desiredAliases) {
      const key = `${aliasData.languageCode}:${aliasData.normalizedAlias}`;

      if (existingAliasKeys.has(key)) {
        continue;
      }

      await nutritionFoodAlias.create({
        data: aliasData,
      });
      existingAliasKeys.add(key);
    }
  }
}

export function buildNutritionFoodUpsertArgs(
  food: SeedFood,
): Prisma.NutritionFoodUpsertArgs {
  const data = {
    nameRu: food.nameRu,
    nameEn: food.nameEn,
    category: food.category,
    caloriesPer100g: food.caloriesPer100g,
    proteinPer100g: food.proteinPer100g,
    fatPer100g: food.fatPer100g,
    carbsPer100g: food.carbsPer100g,
    ...foodCatalogSource,
  };

  return {
    where: {
      slug: food.slug,
    },
    create: {
      slug: food.slug,
      baseAmount: 100,
      baseUnit: "g",
      ...data,
    },
    update: data,
  };
}

export function buildNutritionFoodAliasCreateData(
  foodId: string,
  food: SeedFood,
): Prisma.NutritionFoodAliasCreateInput[] {
  const seen = new Set<string>();
  const result: Prisma.NutritionFoodAliasCreateInput[] = [];

  for (const [languageCode, aliases] of Object.entries(food.aliases)) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeFoodText(alias);
      const key = `${languageCode}:${normalizedAlias}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push({
        food: {
          connect: {
            id: foodId,
          },
        },
        alias,
        languageCode,
        normalizedAlias,
      });
    }
  }

  return result;
}
