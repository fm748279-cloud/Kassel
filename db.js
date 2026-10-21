/* طبقة البيانات: Supabase عند توفر الإعدادات، وإلا وضع تجريبي محلي */
(function () {
  const C = window.KASSEP_CONFIG || {};
  const LIVE = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
  const sb = LIVE ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey) : null;

  /* ---------- أدوات ---------- */
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + Math.random().toString(16).slice(2));
  const orderCode = () => "K" + Date.now().toString(36).toUpperCase().slice(-5) + Math.floor(Math.random() * 90 + 10);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("kassep_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("kassep_" + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  const mem = {};
  const dget = (k, d) => (k in mem ? mem[k] : (mem[k] = store.get(k, d)));
  const dset = (k, v) => { mem[k] = v; store.set(k, v); };

  /* تصغير الصورة قبل الرفع (صور الجوال كبيرة) */
  function resizeImage(file, max = 1400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => (b ? resolve(b) : reject(new Error("تعذر تجهيز الصورة"))), "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("ملف الصورة غير صالح")); };
      img.src = url;
    });
  }
  const blobToDataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

  /* ---------- بيانات تجريبية ---------- */
  const F = (make, model, from, to) => ({ make, model, from, to });
  const SEED = [
    { name: "فلتر زيت أصلي", part_number: "04152-YZZA6", brand: "Toyota", category: "فلاتر", condition: "new", price: 38, stock: 120, fits: [F("تويوتا","كامري",2012,2024), F("تويوتا","كورولا",2014,2024), F("لكزس","ES",2013,2024)] },
    { name: "تيل فرامل أمامي", part_number: "04465-33471", brand: "Toyota", category: "فرامل", condition: "new", price: 265, stock: 24, fits: [F("تويوتا","كامري",2018,2024)] },
    { name: "بواجي إيريديوم (4 حبات)", part_number: "90919-01253", brand: "Denso", category: "كهرباء المحرك", condition: "new", price: 180, stock: 40, fits: [F("تويوتا","كامري",2012,2017), F("تويوتا","كورولا",2010,2019)] },
    { name: "مساعد أمامي يمين", part_number: "48510-80742", brand: "KYB", category: "نظام التعليق", condition: "new", price: 420, stock: 6, fits: [F("تويوتا","هايلكس",2016,2024)] },
    { name: "فلتر زيت", part_number: "26300-35505", brand: "Hyundai Mobis", category: "فلاتر", condition: "new", price: 32, stock: 150, fits: [F("هيونداي","سوناتا",2011,2023), F("هيونداي","النترا",2011,2023), F("كيا","أوبتيما",2011,2020)] },
    { name: "رديتر ماء", part_number: "25310-F2000", brand: "Hyundai Mobis", category: "تبريد", condition: "new", price: 690, stock: 3, fits: [F("هيونداي","النترا",2016,2020)] },
    { name: "بطارية 70 أمبير", part_number: "AMR-70L", brand: "AC Delco", category: "كهرباء", condition: "new", price: 395, stock: 30, fits: [F("تويوتا","كامري",2007,2024), F("هيونداي","سوناتا",2011,2024), F("نيسان","التيما",2013,2024)] },
    { name: "فلتر مكيف كربون", part_number: "27277-4M425", brand: "Nissan", category: "فلاتر", condition: "new", price: 45, stock: 80, fits: [F("نيسان","التيما",2013,2018), F("نيسان","صني",2012,2020)] },
    { name: "زيت محرك 5W-30 (4 لتر)", part_number: "08880-83388", brand: "Toyota", category: "زيوت وسوائل", condition: "new", price: 145, stock: 200, fits: [F("تويوتا","كامري",2007,2024), F("تويوتا","كورولا",2007,2024), F("تويوتا","هايلكس",2007,2024)] },
    { name: "قماشات فرامل أمامية", part_number: "DG1Z-2001-A", brand: "Motorcraft", category: "فرامل", condition: "new", price: 310, stock: 12, fits: [F("فورد","إكسبلورر",2013,2019)] },
    { name: "شمعة أمامية LED يمين", part_number: "81110-06C40", brand: "Toyota", category: "إضاءة وبودي", condition: "used", price: 650, stock: 1, fits: [F("تويوتا","كامري",2018,2020)], description: "مستعملة بحالة ممتازة، بدون كسور أو خدوش في العدسة. الكهرباء سليمة ومجرّبة.", source_vehicle: "كامري 2019" },
    { name: "كمبروسر مكيف", part_number: "97701-C1001", brand: "Hanon", category: "تكييف", condition: "used", price: 900, stock: 1, fits: [F("هيونداي","سوناتا",2015,2019)], description: "مجرّب على السيارة قبل الفك. ضمان تشغيل 7 أيام.", source_vehicle: "سوناتا 2017" },
    { name: "قير أوتوماتيك كامل", part_number: "U760E", brand: "Aisin", category: "القير", condition: "scrap", price: 3200, stock: 1, fits: [F("تويوتا","كامري",2012,2017)], description: "قير تشليح من سيارة ممشاها 140 ألف كم. نظيف وبدون تسريب. ضمان تركيب 14 يوم.", source_vehicle: "كامري 2015 — تشليح" },
    { name: "مكينة كاملة 2.5", part_number: "2AR-FE", brand: "Toyota", category: "المحرك", condition: "scrap", price: 6500, stock: 1, fits: [F("تويوتا","كامري",2012,2017)], description: "مكينة تشليح كاملة مع الملحقات. الكمبريشن ممتاز. يمكن الفحص قبل الشراء.", source_vehicle: "كامري 2016 — تشليح" },
    { name: "باب أمامي يسار", part_number: "67002-06190", brand: "Toyota", category: "إضاءة وبودي", condition: "scrap", price: 850, stock: 1, fits: [F("تويوتا","كامري",2018,2024)], description: "باب كامل مع الزجاج والمرآة والقفل. اللون أبيض لؤلؤي.", source_vehicle: "كامري 2020 — تشليح" },
    { name: "طرمبة بنزين", part_number: "17040-3TA0A", brand: "Nissan", category: "الوقود", condition: "scrap", price: 350, stock: 1, fits: [F("نيسان","التيما",2013,2018)], description: "مجرّبة وشغالة.", source_vehicle: "التيما 2016 — تشليح" },
    { name: "دينمو كهرباء", part_number: "37300-2G400", brand: "Hyundai Mobis", category: "كهرباء", condition: "used", price: 550, stock: 1, fits: [F("هيونداي","سوناتا",2011,2019), F("كيا","أوبتيما",2011,2019)], description: "مفحوص على جهاز الشحن.", source_vehicle: "أوبتيما 2016" },
    { name: "شبك أمامي", part_number: "53111-0E270", brand: "Toyota", category: "إضاءة وبودي", condition: "scrap", price: 280, stock: 2, fits: [F("تويوتا","هايلكس",2016,2020)], description: "بدون كسور.", source_vehicle: "هايلكس 2018 — تشليح" }
  ];
  function seedParts() {
    const now = Date.now();
    return SEED.map((p, i) => ({ id: uid(), images: [], description: "", source_vehicle: "", is_active: true, created_at: new Date(now - i * 3600e3).toISOString(), ...p }));
  }
  const dParts = () => dget("parts", null) || (dset("parts", seedParts()), mem.parts);

  /* ---------- الواجهة الموحدة ---------- */
  const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  window.DB = {
    live: LIVE,

    async listParts() {
      if (LIVE) return must(await sb.from("parts").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(5000));
      return dParts().filter(p => p.is_active);
    },
    async listAllParts() {
      if (LIVE) return must(await sb.from("parts").select("*").order("created_at", { ascending: false }).limit(5000));
      return dParts();
    },
    async savePart(p) {
      const row = { ...p };
      ["price", "stock"].forEach(k => { row[k] = row[k] === "" || row[k] == null ? null : Number(row[k]); });
      if (row.stock == null) row.stock = 0;
      if (LIVE) {
        delete row.created_at; delete row.updated_at;
        if (row.id) return must(await sb.from("parts").update(row).eq("id", row.id).select().single());
        delete row.id;
        return must(await sb.from("parts").insert(row).select().single());
      }
      const list = dParts();
      if (row.id) { const i = list.findIndex(x => x.id === row.id); list[i] = { ...list[i], ...row }; }
      else { row.id = uid(); row.created_at = new Date().toISOString(); list.unshift(row); }
      if (!store.set("parts", list)) throw new Error("مساحة المتصفح ممتلئة في الوضع التجريبي — جرّب صوراً أقل");
      mem.parts = list;
      return row;
    },
    async deletePart(id) {
      if (LIVE) return must(await sb.from("parts").delete().eq("id", id));
      dset("parts", dParts().filter(p => p.id !== id));
    },
    async uploadImage(file) {
      if (LIVE) {
        const blob = await resizeImage(file);
        const path = `${new Date().toISOString().slice(0, 7)}/${uid()}.jpg`;
        must(await sb.storage.from("parts").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" }));
        return sb.storage.from("parts").getPublicUrl(path).data.publicUrl;
      }
      return blobToDataUrl(await resizeImage(file, 700, 0.7));
    },

    async createOrder(o) {
      const row = { ...o, code: orderCode(), status: "new" };
      if (LIVE) { must(await sb.from("orders").insert(row)); return row; }
      dset("orders", [{ id: uid(), created_at: new Date().toISOString(), ...row }, ...dget("orders", [])]);
      return row;
    },
    async listOrders() {
      if (LIVE) return must(await sb.from("orders").select("*").order("created_at", { ascending: false }).limit(500));
      return dget("orders", []);
    },
    async updateOrder(id, patch) {
      if (LIVE) return must(await sb.from("orders").update(patch).eq("id", id));
      dset("orders", dget("orders", []).map(o => (o.id === id ? { ...o, ...patch } : o)));
    },

    async createRequest(r) {
      const row = { ...r, status: "new" };
      if (LIVE) { must(await sb.from("part_requests").insert(row)); return row; }
      dset("requests", [{ id: uid(), created_at: new Date().toISOString(), ...row }, ...dget("requests", [])]);
      return row;
    },
    async listRequests() {
      if (LIVE) return must(await sb.from("part_requests").select("*").order("created_at", { ascending: false }).limit(500));
      return dget("requests", []);
    },
    async updateRequest(id, patch) {
      if (LIVE) return must(await sb.from("part_requests").update(patch).eq("id", id));
      dset("requests", dget("requests", []).map(o => (o.id === id ? { ...o, ...patch } : o)));
    },

    /* ---------- توافق القطع مع السيارات ---------- */
    async fitmentForParts(keys) {
      if (!keys.length) return [];
      if (LIVE) return must(await sb.from("part_fitment").select("*").in("part_key", keys.slice(0, 200)));
      return dget("fitment", []).filter(f => keys.includes(f.part_key));
    },
    async fitmentForCar(make, model) {
      if (LIVE) { let q = sb.from("part_fitment").select("*").eq("make", make).limit(3000); if (model) q = q.eq("model", model); return must(await q); }
      return dget("fitment", []).filter(f => f.make === make && (!model || f.model === model));
    },
    async listFitment() {
      if (LIVE) return must(await sb.from("part_fitment").select("*").order("created_at", { ascending: false }).limit(1000));
      return dget("fitment", []);
    },
    async addFitment(rows) {
      if (LIVE) return must(await sb.from("part_fitment").upsert(rows, { onConflict: "part_key,make,model,year_from,year_to", ignoreDuplicates: true }).select());
      const list = dget("fitment", []), key = f => [f.part_key, f.make, f.model, f.year_from, f.year_to].join("|");
      const have = new Set(list.map(key)), added = [];
      rows.forEach(r => { if (!have.has(key(r))) { const row = { id: uid(), created_at: new Date().toISOString(), ...r }; list.unshift(row); added.push(row); have.add(key(r)); } });
      if (!store.set("fitment", list)) throw new Error("مساحة المتصفح ممتلئة في الوضع التجريبي");
      mem.fitment = list;
      return added;
    },
    async deleteFitment(id) {
      if (LIVE) return must(await sb.from("part_fitment").delete().eq("id", id));
      dset("fitment", dget("fitment", []).filter(f => f.id !== id));
    },

    /* ---------- الدخول ---------- */
    async session() {
      if (!LIVE) return { demo: true };
      return (await sb.auth.getSession()).data.session;
    },
    async signIn(email, password) {
      if (!LIVE) return { demo: true };
      return must(await sb.auth.signInWithPassword({ email, password }));
    },
    async signOut() { if (LIVE) await sb.auth.signOut(); },
    async isAdmin() {
      if (!LIVE) return true;
      const s = await this.session(); if (!s) return false;
      const { data } = await sb.from("admins").select("user_id").eq("user_id", s.user.id).maybeSingle();
      return !!data;
    },
    resetDemo() { ["parts", "orders", "requests", "fitment"].forEach(k => { delete mem[k]; try { localStorage.removeItem("kassep_" + k); } catch (e) {} }); }
  };

  /* ---------- السيارات (للاختيار في البحث والطلبات) ---------- */
  const VEHICLES = {
    "تويوتا": ["كامري", "كورولا", "كورولا كروس", "يارس", "راف فور", "هايلاندر", "فورتشنر", "هايلكس", "لاندكروزر", "لاندكروزر بيك أب", "برادو", "أفالون", "إنوفا", "راش", "فيلوز", "رايز", "C-HR", "كراون", "سيكويا", "تندرا", "جرانفيا", "هايس", "كوستر", "FJ كروزر", "بريوس"],
    "هيونداي": ["أكسنت", "النترا", "سوناتا", "أزيرا", "جراندير", "توسان", "سنتافي", "كريتا", "كونا", "فينيو", "باليسيد", "ستاريا", "H1", "i10", "فيلوستر", "جينيسيس"],
    "كيا": ["بيجاس", "ريو", "سيراتو", "K3", "K5", "أوبتيما", "K8", "كادينزا", "ستينجر", "سبورتاج", "سورينتو", "سيلتوس", "سونيت", "كارنفال", "تيلورايد", "موهافي", "بيكانتو", "سول"],
    "نيسان": ["صني", "سنترا", "التيما", "ماكسيما", "باترول", "باترول سفاري", "باترول بيك أب", "باثفايندر", "إكس تريل", "كيكس", "مورانو", "أرمادا", "جوك", "نافارا", "أورفان"],
    "هوندا": ["سيتي", "سيفيك", "أكورد", "CR-V", "HR-V", "ZR-V", "بايلوت", "أوديسي", "جاز"],
    "شفروليه": ["تاهو", "سوبربان", "سلفرادو", "كابريس", "ماليبو", "إمبالا", "كمارو", "تريل بليزر", "بليزر", "كابتيفا", "إكوينوكس", "ترافرس", "جروف", "سبارك", "أفيو", "كروز"],
    "جمس": ["يوكن", "يوكن XL", "سييرا", "أكاديا", "تيرين", "سافانا", "إنفوي"],
    "لكزس": ["ES", "IS", "GS", "LS", "RX", "NX", "UX", "GX", "LX", "LM", "TX", "RC"],
    "فورد": ["توروس", "فيوجن", "موستنج", "إكسبلورر", "إكسبيديشن", "إيدج", "إسكيب", "تيريتوري", "برونكو", "رينجر", "F-150", "كراون فكتوريا"],
    "ميتسوبيشي": ["أتراج", "ميراج", "لانسر", "إكسباندر", "ASX", "إكلبس كروس", "أوتلاندر", "باجيرو", "مونتيرو سبورت", "L200"],
    "شانجان": ["CS35", "CS35 بلس", "CS75", "CS75 بلس", "CS85", "CS95", "إيدو", "السفن", "UNI-T", "UNI-K", "UNI-V", "هانتر"],
    "هافال": ["H6", "H9", "جوليان", "دارجو", "H2"],
    "جينيسيس": ["G70", "G80", "G90", "GV70", "GV80"],
    "إنفينيتي": ["Q50", "Q60", "Q70", "QX50", "QX60", "QX70", "QX80"],
    "كاديلاك": ["إسكاليد", "CT4", "CT5", "CT6", "XT4", "XT5", "XT6", "CTS", "ATS"],
    "لينكون": ["نافيجيتور", "أفياتور", "نوتيلوس", "MKZ", "MKX"],
    "دودج": ["تشارجر", "تشالنجر", "دورانجو", "رام"],
    "جيب": ["رانجلر", "جراند شيروكي", "شيروكي", "كومباس", "جلادياتور"],
    "كرايسلر": ["300", "باسيفيكا"],
    "مازدا": ["2", "3", "6", "CX-3", "CX-30", "CX-5", "CX-9", "CX-90"],
    "سوزوكي": ["سويفت", "ديزاير", "سياز", "بالينو", "جراند فيتارا", "جيمني", "إرتيجا", "APV"],
    "إيسوزو": ["دي ماكس", "MU-X", "NPR"],
    "مرسيدس": ["A", "C", "E", "S", "CLA", "GLA", "GLC", "GLE", "GLS", "G", "سبرينتر"],
    "بي إم دبليو": ["الفئة الثالثة", "الفئة الخامسة", "الفئة السابعة", "X1", "X3", "X5", "X6", "X7"],
    "أودي": ["A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8"],
    "فولكس واجن": ["جولف", "جيتا", "باسات", "تيجوان", "تيرامونت", "طوارق"],
    "لاند روفر": ["رنج روفر", "رنج روفر سبورت", "رنج روفر فيلار", "رنج روفر إيفوك", "ديفندر", "ديسكفري"],
    "بورش": ["كايين", "ماكان", "باناميرا", "911"],
    "جيلي": ["إمجراند", "كولراي", "أزكارا", "مونجارو", "توجيلا"],
    "إم جي": ["MG5", "MG6", "GT", "ZS", "HS", "RX5", "RX8"],
    "شيري": ["أريزو 5", "أريزو 6", "أريزو 8", "تيجو 4", "تيجو 7", "تيجو 8"],
    "بي واي دي": ["F3", "سونغ", "تانغ", "هان"],
    "جيتور": ["X70", "X90", "T2", "داشينغ"]
  };
  // أول خانات رقم الهيكل تدل على الصانع (الأدق أولاً)
  const WMI = {
    "لكزس": ["JTH", "JTJ", "2T2", "58A"], "تويوتا": ["JT", "4T", "5T", "2T", "MR0", "MR1", "MR2", "6T1", "AHT", "NMT", "SB1", "8AJ", "9BR"],
    "جينيسيس": ["KMT"], "هيونداي": ["KMH", "KM8", "5NP", "5NM", "MAL", "TMA", "NLH"], "كيا": ["KNA", "KND", "KNC", "5XY", "5XX", "3KP", "U5Y"],
    "إنفينيتي": ["JNK", "JNR", "5N3"], "نيسان": ["JN", "1N4", "1N6", "3N1", "3N6", "5N1", "MNT", "SJN", "VSK"],
    "هوندا": ["JHM", "JHL", "1HG", "2HG", "2HK", "5FN", "5J6", "SHH", "MRH"], "ميتسوبيشي": ["JA3", "JA4", "JMB", "JMY", "MMB", "ML3"],
    "إيسوزو": ["JAA", "JAL", "MPA"], "كاديلاك": ["1GY", "1G6"], "جمس": ["1GK", "1GT", "2GK", "3GT"], "شفروليه": ["1GC", "1GN", "1G1", "2G1", "3GC", "3GN", "KL1"],
    "لينكون": ["1LN", "2LM", "5LM"], "فورد": ["1FA", "1FD", "1FM", "1FT", "2FM", "3FA"], "مازدا": ["JM1", "JM3", "JMZ"], "سوزوكي": ["JS2", "JS3", "MA3", "TSM"],
    "مرسيدس": ["WDB", "WDD", "WDC", "W1K", "W1N"], "بي إم دبليو": ["WBA", "WBS", "WBX", "5UX"], "أودي": ["WAU", "WA1"], "فولكس واجن": ["WVW", "WVG", "3VW"],
    "لاند روفر": ["SAL"], "بورش": ["WP0", "WP1"], "شانجان": ["LS5"], "هافال": ["LGW"]
  };
  const THIS_YEAR = new Date().getFullYear();

  /* ---------- أدوات مشتركة للواجهات ---------- */
  window.K = {
    C,
    CONDITIONS: { new: "جديد", used: "مستعمل", scrap: "تشليح" },
    ICONS: { "فلاتر": "🧴", "فرامل": "🛑", "كهرباء المحرك": "⚡", "كهرباء": "🔋", "نظام التعليق": "🔩", "تبريد": "🌡️", "تكييف": "❄️", "المحرك": "⚙️", "القير": "🕹️", "الوقود": "⛽", "إضاءة وبودي": "🚗", "زيوت وسوائل": "🛢️" },
    VEHICLES,
    MAKES: Object.keys(VEHICLES),
    YEARS: Array.from({ length: THIS_YEAR + 2 - 1985 }, (_, i) => THIS_YEAR + 1 - i),
    vinOk: v => /^[A-HJ-NPR-Z0-9]{17}$/.test(String(v || "").toUpperCase()),
    vinInfo(v) {
      v = String(v || "").toUpperCase();
      if (/[IOQ]/.test(v)) return { ok: false, msg: "رقم الهيكل ما فيه حروف I أو O أو Q، غالباً المقصود ١ أو ٠" };
      if (!/^[A-Z0-9]*$/.test(v)) return { ok: false, msg: "رقم الهيكل حروف إنجليزية وأرقام فقط" };
      if (v.length !== 17) return { ok: false, msg: `${v.length.toLocaleString("ar-SA")} من ١٧ خانة` };
      const make = (Object.entries(WMI).find(([, codes]) => codes.some(c => v.startsWith(c))) || [""])[0];
      return { ok: true, make };
    },
    CATEGORIES: ["فلاتر","فرامل","المحرك","القير","نظام التعليق","كهرباء","كهرباء المحرك","تبريد","تكييف","الوقود","إضاءة وبودي","زيوت وسوائل"],
    esc: s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    money: n => (n == null || n === "" ? "السعر عند الطلب" : Number(n).toLocaleString("ar-SA") + " " + (C.currency || "ر.س")),
    norm: s => String(s ?? "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[\s\-_.\/]/g, ""),
    wa: (text, phone) => `https://wa.me/${phone || C.whatsapp}?text=${encodeURIComponent(text)}`,
    date: iso => new Date(iso).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }),
    toast(m) {
      let t = document.getElementById("toast");
      if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
      t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200);
    }
  };
})();
