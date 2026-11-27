#!/usr/bin/env python3
"""Genera data/recipes.json y data/recipe_categories.json a partir de data/src/recipes_<cat>.json y data/foods.json.
Calcula los macros por porción y valida todo. Uso: python3 tools/build_recipes.py [--check-only] [cat ...]"""
import json, sys, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATS = [("mexicanas", "Mexicanas"), ("italianas", "Italianas"), ("mediterraneas", "Mediterráneas"), ("ensaladas", "Ensaladas"),
        ("asiaticas", "Asiáticas"), ("desayunos", "Desayunos"), ("fitness", "Altas en proteína"), ("sopas", "Sopas y caldos"),
        ("snacks", "Snacks y colaciones"), ("postres", "Postres saludables"), ("vegetarianas", "Vegetarianas"), ("bowls", "Bowls y tazones")]
PREFIX = {"mexicanas": "mex", "italianas": "ita", "mediterraneas": "med", "ensaladas": "ens", "asiaticas": "asi", "desayunos": "des",
          "fitness": "fit", "sopas": "sop", "snacks": "sna", "postres": "pos", "vegetarianas": "veg", "bowls": "bow"}
TARGET = 100

def load(p):
    with open(p, encoding="utf-8") as f: return json.load(f)

def norm(s):
    s = s.lower()
    for a, b in zip("áéíóúüñ", "aeiouun"): s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def check_cat(cat, recs, foods, errors, seen_ids, seen_names):
    pre = PREFIX[cat] + "_"
    if len(recs) != TARGET: errors.append(f"{cat}: {len(recs)} recetas (se esperan {TARGET})")
    out = []
    for r in recs:
        rid = r.get("id", "?"); where = f"{cat}/{rid}"
        for k in ("id", "name", "servings", "time_min", "level", "ingredients", "steps", "tags"):
            if k not in r: errors.append(f"{where}: falta {k}")
        if not str(rid).startswith(pre): errors.append(f"{where}: el id debe empezar con {pre}")
        if rid in seen_ids: errors.append(f"{where}: id repetido")
        seen_ids.add(rid)
        n = norm(r.get("name", ""))
        if n in seen_names: errors.append(f"{where}: nombre repetido ({r.get('name')}) también en {seen_names[n]}")
        seen_names[n] = where
        sv = r.get("servings", 0)
        if not isinstance(sv, int) or not 1 <= sv <= 12: errors.append(f"{where}: servings inválido {sv}")
        if not 3 <= len(r.get("steps", [])) <= 8: errors.append(f"{where}: {len(r.get('steps', []))} pasos")
        if r.get("level") not in ("fácil", "media"): errors.append(f"{where}: level inválido")
        tot = dict(kcal=0.0, p=0.0, c=0.0, f=0.0, fiber=0.0); g_tot = 0
        ings = r.get("ingredients", [])
        if len(ings) < 2: errors.append(f"{where}: muy pocos ingredientes")
        for ing in ings:
            fd = foods.get(ing.get("food"))
            g = ing.get("g", 0)
            if fd is None: errors.append(f"{where}: alimento desconocido '{ing.get('food')}'"); continue
            if not isinstance(g, (int, float)) or g <= 0 or g > 3000: errors.append(f"{where}: gramos inválidos {g} en {ing['food']}"); continue
            g_tot += g
            for k in tot: tot[k] += fd.get(k, 0) * g / 100
        if sv and isinstance(sv, int):
            ps = {k: round(v / sv, 1) for k, v in tot.items()}; ps["kcal"] = round(tot["kcal"] / sv)
            if not 40 <= ps["kcal"] <= 1200: errors.append(f"{where}: {ps['kcal']} kcal por porción (fuera de 40–1200)")
            o = dict(r); o["cat"] = cat; o["per_serving"] = ps; o["total_g"] = round(g_tot)
            out.append(o)
    return out

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check_only = "--check-only" in sys.argv
    foods = {f["id"]: f for f in load(os.path.join(ROOT, "data", "foods.json"))}
    errors, allrecs, cats_out = [], [], []
    seen_ids, seen_names = set(), {}
    for cat, name in CATS:
        if args and cat not in args: continue
        p = os.path.join(ROOT, "data", "src", f"recipes_{cat}.json")
        if not os.path.exists(p): errors.append(f"{cat}: falta {p}"); continue
        recs = check_cat(cat, load(p), foods, errors, seen_ids, seen_names)
        allrecs += recs; cats_out.append({"id": cat, "name": name, "count": len(recs)})
    for e in errors: print("ERROR", e)
    print(f"{len(allrecs)} recetas, {len(errors)} errores")
    if errors or check_only or args: sys.exit(1 if errors else 0)
    with open(os.path.join(ROOT, "data", "recipes.json"), "w", encoding="utf-8") as f: json.dump(allrecs, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ROOT, "data", "recipe_categories.json"), "w", encoding="utf-8") as f: json.dump(cats_out, f, ensure_ascii=False, indent=1)
    print("escrito data/recipes.json y data/recipe_categories.json")

if __name__ == "__main__":
    main()
