# Alimentación y recetas — contrato de datos

## data/foods.json (alimentos base, valores por 100 g en crudo salvo que el nombre diga "cocido")
```
[{ "id": "pechuga_pollo",            // slug ascii, único
   "name": "Pechuga de pollo sin piel",
   "cat": "Proteína animal",          // Proteína animal, Pescados y mariscos, Lácteos y huevo, Leguminosas, Cereales y tubérculos, Verduras, Frutas, Grasas y semillas, Proteína vegetal, Suplementos, Condimentos y salsas, Bebidas, Otros
   "kcal": 120, "p": 22.5, "c": 0, "f": 2.6, "fiber": 0,      // por 100 g
   "unit": {"name": "pieza mediana", "g": 200} | null,           // porción casera opcional
   "protein_pick": true|false,        // aparece en el submenú "Proteínas populares"
   "keywords": ["pollo", "chicken breast"] }]
```
- 180–250 alimentos comunes en México (supermercado, mercado, tianguis). Valores consistentes con USDA FoodData Central / tablas mexicanas (SMAE). kcal ≈ 4p + 4c + 9f (±10 %).
- `protein_pick: true` en 30–40 proteínas populares: pollo, res (cortes), pavo, atún en agua, salmón, tilapia, camarón, huevo, claras, queso panela, cottage, yogur griego, proteína whey, tofu, lentejas, frijol, etc. (cerdo puede existir pero sin `protein_pick`).

## data/src/recipes_<cat>.json (fuente escrita a mano, una por categoría)
Categorías (id → nombre): mexicanas → Mexicanas · italianas → Italianas · mediterraneas → Mediterráneas · ensaladas → Ensaladas · asiaticas → Asiáticas · desayunos → Desayunos · fitness → Altas en proteína · sopas → Sopas y caldos · snacks → Snacks y colaciones · postres → Postres saludables · vegetarianas → Vegetarianas · bowls → Bowls y tazones.
```
[{ "id": "mex_tinga_pollo",           // prefijo de categoría + slug, único global
   "name": "Tinga de pollo",
   "servings": 4, "time_min": 35, "level": "fácil"|"media",
   "ingredients": [{"food": "pechuga_pollo", "g": 600, "note": "cocida y deshebrada"}],  // food = id de foods.json, g = gramos totales de la receta
   "steps": ["...", "...", "..."],    // 3–6 pasos cortos en español de México
   "tags": ["sin lácteos", "meal prep", "alta en proteína"] }]
```
100 recetas por categoría, nombres sin repetir, realistas (cantidades que una persona cocina en casa), ingredientes accesibles en México.

## data/recipes.json (GENERADO por tools/build_recipes.py; no editar a mano)
Igual que la fuente + `"cat"` y `"per_serving": {"kcal","p","c","f","fiber"}` redondeado, + `"total_g"`.
`data/recipe_categories.json`: `[{"id","name","count"}]`.

## Cálculo de metas (perfil)
- TMB Mifflin-St Jeor; actividad por días de entreno: 2→1.375, 3→1.45, 4→1.5, 5→1.6, 6→1.7.
- Meta: subir → +10 % (máx +300 kcal); bajar → −20 % (mín TMB × 1.1); igual → mantenimiento.
- Proteína 2.0 g/kg (bajar: 2.2 g/kg), grasa 0.9 g/kg (mín 20 % kcal), carbohidratos = resto. Fibra 14 g/1000 kcal.
- Comidas por día elegidas por el usuario (3–6); reparto de kcal y proteína por comida.
