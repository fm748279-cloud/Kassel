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
    resetDemo() { ["parts", "orders", "requests"].forEach(k => { delete mem[k]; try { localStorage.removeItem("kassep_" + k); } catch (e) {} }); }
  };

  /* ---------- أدوات مشتركة للواجهات ---------- */
  window.K = {
    C,
    CONDITIONS: { new: "جديد", used: "مستعمل", scrap: "تشليح" },
    ICONS: { "فلاتر": "🧴", "فرامل": "🛑", "كهرباء المحرك": "⚡", "كهرباء": "🔋", "نظام التعليق": "🔩", "تبريد": "🌡️", "تكييف": "❄️", "المحرك": "⚙️", "القير": "🕹️", "الوقود": "⛽", "إضاءة وبودي": "🚗", "زيوت وسوائل": "🛢️" },
    MAKES: ["تويوتا","لكزس","هيونداي","كيا","نيسان","إنفينيتي","فورد","شفروليه","جي إم سي","كاديلاك","دودج","جيب","كرايسلر","هوندا","مازدا","ميتسوبيشي","سوزوكي","إيسوزو","مرسيدس","بي إم دبليو","أودي","فولكس واجن","لاند روفر","بورش","شانجان","جيلي","إم جي","هافال","شيري","بي واي دي"],
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
