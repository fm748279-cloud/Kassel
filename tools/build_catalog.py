"""
بناء كتالوج أسعار كاسب من ملف Excel.

الاستخدام:
    python3 tools/build_catalog.py "ملف_الأسعار.xlsx"

كل ورقة (وكل عمود سعر في ورقة GMC) تعتبر مورداً مستقلاً برقم يطابق رقم الورقة في الملف
(نيسان 1 = مورد ١، نيسان 2 = مورد ٢ ...). يوحّد أرقام القطع (يحذف بادئات الموردين والشرطات
والمسافات)، ويجمع أسعار كل الموردين لنفس القطعة مرتبة من الأقل مع كود القطعة عند كل مورد،
ثم يكتب ملفات صغيرة في catalog/ يبحث فيها الموقع برقم القطعة.
"""
import json, os, re, shutil, sys, time
from datetime import datetime, timezone

import openpyxl

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "catalog")

MAKES = ["تويوتا", "هيونداي", "كيا", "نيسان", "هوندا", "ميتسوبيشي", "جمس / شفروليه", "شانجان", "هافال"]
M = {m: i for i, m in enumerate(MAKES)}

# pn: عمود رقم القطعة | desc: أعمدة الوصف | strip: بادئة المورد قبل الرقم | alt: عمود الرقم البديل
# sources: الموردون في الورقة: (رقم المورد، أعمدة السعر[، اسم المصدر])
# pick: إذا للمورد أكثر من عمود سعر — first = أول سعر صالح بالترتيب
#       (نيسان 3: الأعمدة أسعار مؤرخة من الأحدث للأقدم)، max = الأعلى (MI: سعر البيع وسعر بعد الخصم)
# factor: معامل على السعر (كيا 1 مكتوب عليها قبل الضريبة)
SHEETS = {
    "شانجان":  dict(make="شانجان", pn=0, desc=[1], sources=[(1, [2])]),
    "هافال":   dict(make="هافال", pn=0, desc=[1], sources=[(1, [2])]),
    "هوندا 1": dict(make="هوندا", pn=0, desc=[1], sources=[(1, [2])]),
    "هوندا 2": dict(make="هوندا", pn=0, desc=[1], sources=[(2, [2])]),
    "هوندا 3": dict(make="هوندا", pn=0, desc=[1], sources=[(3, [2])]),
    "GMC":     dict(make="جمس / شفروليه", pn=0, desc=[],
                    sources=[(1, [1], "GMC - جمس شفر 1"), (2, [2], "GMC - جمس شفر 2"), (3, [3], "GMC - جمس شفر 3")]),
    "MI1":     dict(make="ميتسوبيشي", pn=0, desc=[1], sources=[(1, [2, 3])], pick="max", strip="MI"),
    "MI2":     dict(make="ميتسوبيشي", pn=0, desc=[2], sources=[(2, [3, 4])], pick="max", strip="MI", alt=1),
    "نيسان 1": dict(make="نيسان", pn=0, desc=[1], sources=[(1, [2])], strip="N"),
    "نيسان 2": dict(make="نيسان", pn=0, desc=[1], sources=[(2, [2])], strip="N"),
    "نيسان 3": dict(make="نيسان", pn=0, desc=[], sources=[(3, [1, 2, 3, 4, 5, 6, 7])], pick="first", strip="N", alt=8),
    "كيا 1":   dict(make="كيا", pn=0, desc=[1], sources=[(1, [2])], strip="K", factor=1.15),
    "كيا 2":   dict(make="كيا", pn=0, desc=[1], sources=[(2, [2])], strip="W"),
    "كيا 3":   dict(make="كيا", pn=0, desc=[1, 2], sources=[(3, [3])], strip="K"),
    "كيا 4":   dict(make="كيا", pn=0, desc=[1], sources=[(4, [2])], strip="KM"),
    "hy":      dict(make="هيونداي", pn=2, desc=[3], sources=[(1, [4])], strip="HY"),
    "hy25":    dict(make="هيونداي", pn=0, desc=[1], sources=[(2, [2])]),
    "TOY1":    dict(make="تويوتا", pn=0, desc=[1], sources=[(1, [2])]),
    "TOY2":    dict(make="تويوتا", pn=0, desc=[], sources=[(2, [1])]),
    "TOY3":    dict(make="تويوتا", pn=0, desc=[], sources=[(3, [1])]),
}

MIN_PRICE = 0.05          # أسعار مثل 0.02 تعني قطعة موقوفة
SHARD_MAX = 220_000       # حجم الملف قبل تقسيمه لبادئة أطول
ARABIC = re.compile(r"[؀-ۿ]")
NORM = re.compile(r"[^0-9A-Z]")
DIGIT = re.compile(r"\d")


def norm(s):
    return NORM.sub("", str(s).upper())


def cell_str(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).replace("\xa0", " ").strip()


def to_num(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def strip_prefix(code, prefix):
    if prefix and code.upper().startswith(prefix) and len(code) > len(prefix) + 3:
        code = code[len(prefix):]
    return code.strip(" -")


def clean_alt(row, cfg, key):
    i = cfg.get("alt")
    if i is None or i >= len(row):
        return ""
    a = strip_prefix(cell_str(row[i]), cfg.get("strip", ""))
    k = norm(a)
    if len(k) < 5 or not DIGIT.search(k) or k == key:
        return ""
    return a


def fmt(p):
    return int(p) if p == int(p) else p


def main(path):
    t0 = time.time()
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    groups = {}          # (make, key) -> [display, desc, alt, offers]   offers: [[src, price, code], ...]
    sources, src_index = [], {}

    for ws in wb.worksheets:
        title = ws.title.strip()
        cfg = SHEETS.get(title)
        if not cfg:
            print(f"  تخطي ورقة غير معرّفة: {ws.title}")
            continue
        mk = M[cfg["make"]]
        strip = cfg.get("strip", "")
        factor = cfg.get("factor", 1.0)
        pick = cfg.get("pick", "first")
        srcs = []
        for s in cfg["sources"]:
            sno, cols = s[0], s[1]
            name = s[2] if len(s) > 2 else title
            if (mk, sno) not in src_index:
                src_index[(mk, sno)] = len(sources)
                sources.append([mk, sno, name])
            srcs.append((src_index[(mk, sno)], cols))

        ok = skipped = 0
        for row in ws.iter_rows(values_only=True):
            if not row or len(row) <= cfg["pn"]:
                continue
            raw = cell_str(row[cfg["pn"]])
            display = strip_prefix(raw, strip) if raw else ""
            key = norm(display)
            if len(key) < 3:
                skipped += 1
                continue
            found = []
            for src, cols in srcs:
                prices = [p for p in (to_num(row[i]) for i in cols if i < len(row)) if p is not None and p > MIN_PRICE]
                if prices:
                    p = max(prices) if pick == "max" else prices[0]
                    found.append((src, round(p * factor, 2)))
            if not found:
                skipped += 1
                continue

            desc = " - ".join(d for d in (cell_str(row[i]) for i in cfg["desc"] if i < len(row)) if d)
            desc = re.sub(r"\s+", " ", desc).strip(" -")[:120]
            alt = clean_alt(row, cfg, key)
            code = raw if raw != display else ""

            g = groups.get((mk, key))
            if g is None:
                g = groups[(mk, key)] = [display, desc, alt, []]
            else:
                if desc and (not g[1] or (ARABIC.search(desc) and not ARABIC.search(g[1]))):
                    g[1] = desc
                if alt and not g[2]:
                    g[2] = alt
                if "-" in display and "-" not in g[0]:
                    g[0] = display
            offers = g[3]
            for src, price in found:
                for o in offers:
                    if o[0] == src:            # نفس المورد مكرر داخل ورقته: الأقل
                        if price < o[1]:
                            o[1], o[2] = price, code
                        break
                else:
                    offers.append([src, price, code])
            ok += 1
        print(f"  {ws.title}: {ok:,} صف مقروء، {skipped:,} متجاهل")

    # ترتيب العروض من الأقل، وتجميع حسب البادئة
    buckets, total_offers, multi = {}, 0, 0
    per_make = {}
    for (mk, key), (display, desc, alt, offers) in groups.items():
        offers.sort(key=lambda o: o[1])
        offs = []
        for src, price, code in offers:
            o = [src, fmt(price)]
            if code and code != display:
                o.append(code)
            offs.append(o)
        total_offers += len(offs)
        multi += len(offs) > 1
        per_make[MAKES[mk]] = per_make.get(MAKES[mk], 0) + 1
        rec = [display, mk, desc, offs]
        if alt:
            rec.append(alt)
        buckets.setdefault(key[:2], []).append((key, rec))
    groups.clear()

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

    for k2, rows in buckets.items():
        size = sum(len(json.dumps(r, ensure_ascii=False)) for _, r in rows)
        if size <= SHARD_MAX:
            write(k2, rows)
        else:
            sub = {}
            for key, rec in rows:
                sub.setdefault(key[:3], []).append((key, rec))
            for k3, r3 in sub.items():
                write(k3, r3)

    count = sum(per_make.values())
    manifest = {
        "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": count,
        "offers": total_offers,
        "makes": MAKES,
        "sources": sources,          # [ماركة، رقم المورد، اسم الورقة]
        "perMake": per_make,
        "shards": sorted(shards),
    }
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\nتم: {count:,} قطعة، {total_offers:,} سعر، منها {multi:,} قطعة عند أكثر من مورد")
    print(f"{len(shards):,} ملف ({total_bytes/1e6:.1f} MB) خلال {time.time()-t0:.0f} ثانية")
    for m, c in sorted(per_make.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c:,}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
