"""
بناء كتالوج أسعار كاسب من ملف Excel.

الاستخدام:
    python3 tools/build_catalog.py "ملف_الأسعار.xlsx"

يقرأ كل ورقة حسب إعداداتها في SHEETS، يوحّد أرقام القطع (يحذف بادئات الموردين
والشرطات والمسافات)، ويأخذ أقل سعر للقطعة داخل نفس الماركة عند تكرارها بين الموردين،
ثم يكتب ملفات صغيرة في catalog/ يبحث فيها الموقع برقم القطعة.
"""
import json, re, sys, os, shutil, time
from datetime import datetime, timezone
import openpyxl

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "catalog")

MAKES = ["تويوتا", "هيونداي", "كيا", "نيسان", "هوندا", "ميتسوبيشي", "جمس / شفروليه", "شانجان", "هافال"]
M = {m: i for i, m in enumerate(MAKES)}

# pn: عمود رقم القطعة، desc: أعمدة الوصف، price: أعمدة السعر
# pick: min | max | first (أول سعر صالح بالترتيب)، strip: بادئة المورد، factor: معامل على السعر، alt: رقم بديل
SHEETS = {
    "شانجان":  dict(make="شانجان", pn=0, desc=[1], price=[2]),
    "هافال":   dict(make="هافال", pn=0, desc=[1], price=[2]),
    "هوندا 3": dict(make="هوندا", pn=0, desc=[1], price=[2]),
    "هوندا 2": dict(make="هوندا", pn=0, desc=[1], price=[2]),
    "هوندا 1": dict(make="هوندا", pn=0, desc=[1], price=[2]),
    "GMC":     dict(make="جمس / شفروليه", pn=0, desc=[], price=[1, 2, 3], pick="min"),
    "MI2":     dict(make="ميتسوبيشي", pn=0, desc=[2], price=[3, 4], pick="max", strip="MI"),
    "MI1":     dict(make="ميتسوبيشي", pn=0, desc=[1], price=[2, 3], pick="max", strip="MI"),
    "نيسان 3": dict(make="نيسان", pn=0, desc=[], price=[1, 2, 3, 4, 5, 6, 7], pick="first", strip="N", alt=8),
    "نيسان 2": dict(make="نيسان", pn=0, desc=[1], price=[2], strip="N"),
    "نيسان 1": dict(make="نيسان", pn=0, desc=[1], price=[2], strip="N"),
    "كيا 4":   dict(make="كيا", pn=0, desc=[1], price=[2], strip="KM"),
    "كيا 3":   dict(make="كيا", pn=0, desc=[1, 2], price=[3], strip="K"),
    "كيا 2":   dict(make="كيا", pn=0, desc=[1], price=[2], strip="W"),
    "كيا 1":   dict(make="كيا", pn=0, desc=[1], price=[2], strip="K", factor=1.15),  # السعر قبل الضريبة
    "hy":      dict(make="هيونداي", pn=2, desc=[3], price=[4], strip="HY"),
    "hy25":    dict(make="هيونداي", pn=0, desc=[1], price=[2]),
    "TOY3":    dict(make="تويوتا", pn=0, desc=[], price=[1]),
    "TOY2":    dict(make="تويوتا", pn=0, desc=[], price=[1]),
    "TOY1":    dict(make="تويوتا", pn=0, desc=[1], price=[2]),
}

MIN_PRICE = 0.05          # أسعار مثل 0.02 تعني قطعة موقوفة
SHARD_MAX = 220_000       # حجم الملف قبل تقسيمه لبادئة أطول
ARABIC = re.compile(r"[؀-ۿ]")
NORM = re.compile(r"[^0-9A-Z]")


def norm(s):
    return NORM.sub("", str(s).upper())


def cell_str(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).replace("\xa0", " ").strip()


def num(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def main(path):
    t0 = time.time()
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    items = {}          # (make_idx, norm_pn) -> [display, desc, price, alt]
    stats = {}
    for ws in wb.worksheets:
        cfg = SHEETS.get(ws.title.strip())
        if not cfg:
            print(f"  تخطي ورقة غير معرّفة: {ws.title}")
            continue
        mk = M[cfg["make"]]
        strip = cfg.get("strip", "")
        factor = cfg.get("factor", 1.0)
        pick = cfg.get("pick", "first")
        ok = skipped = 0
        for row in ws.iter_rows(values_only=True):
            if not row or len(row) <= cfg["pn"]:
                continue
            raw = cell_str(row[cfg["pn"]])
            prices = [num(row[i]) for i in cfg["price"] if i < len(row)]
            prices = [p for p in prices if p is not None and p > MIN_PRICE]
            if not raw or not prices:
                skipped += 1
                continue
            if pick == "min":
                price = min(prices)
            elif pick == "max":
                price = max(prices)
            else:
                price = prices[0]
            price = round(price * factor, 2)
            display = raw
            if strip and display.upper().startswith(strip) and len(display) > len(strip) + 3:
                display = display[len(strip):]
            display = display.strip(" -")
            key = norm(display)
            if len(key) < 3:
                skipped += 1
                continue
            desc = " - ".join(d for d in (cell_str(row[i]) for i in cfg["desc"] if i < len(row)) if d)
            desc = re.sub(r"\s+", " ", desc).strip(" -")[:120]
            alt = cell_str(row[cfg["alt"]]) if "alt" in cfg and cfg["alt"] < len(row) else ""
            cur = items.get((mk, key))
            if cur is None:
                items[(mk, key)] = [display, desc, price, alt]
            else:
                if price < cur[2]:
                    cur[2] = price
                if desc and (not cur[1] or (ARABIC.search(desc) and not ARABIC.search(cur[1]))):
                    cur[1] = desc
                if alt and not cur[3]:
                    cur[3] = alt
                if "-" in display and "-" not in cur[0]:
                    cur[0] = display
            ok += 1
        stats[ws.title] = (ok, skipped)
        print(f"  {ws.title}: {ok:,} صف مقروء، {skipped:,} متجاهل")

    # تجميع حسب البادئة
    groups = {}
    for (mk, key), (display, desc, price, alt) in items.items():
        rec = [display, mk, price]
        if desc or alt:
            rec.append(desc)
        if alt:
            rec.append(alt)
        groups.setdefault(key[:2], []).append((key, rec))

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "s"))
    shards, total_bytes = [], 0

    def write(k, rows):
        nonlocal total_bytes
        rows.sort(key=lambda x: x[0])
        data = json.dumps([r for _, r in rows], ensure_ascii=False, separators=(",", ":"))
        with open(os.path.join(OUT, "s", k + ".json"), "w", encoding="utf-8") as f:
            f.write(data)
        total_bytes += len(data.encode())
        shards.append(k)

    for k2, rows in groups.items():
        size = sum(len(json.dumps(r, ensure_ascii=False)) for _, r in rows)
        if size <= SHARD_MAX:
            write(k2, rows)
        else:
            sub = {}
            for key, rec in rows:
                sub.setdefault(key[:3], []).append((key, rec))
            for k3, r3 in sub.items():
                write(k3, r3)

    per_make = {}
    for (mk, _) in items:
        per_make[MAKES[mk]] = per_make.get(MAKES[mk], 0) + 1
    manifest = {
        "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(items),
        "makes": MAKES,
        "perMake": per_make,
        "shards": sorted(shards),
    }
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\nتم: {len(items):,} قطعة فريدة في {len(shards):,} ملف ({total_bytes/1e6:.1f} MB) خلال {time.time()-t0:.0f} ثانية")
    for m, c in sorted(per_make.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c:,}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
