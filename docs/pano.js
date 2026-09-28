/* Bilgi Ekranı — web sitesi çekirdeği
   Veriler GitHub Actions tarafından toplanıp veri/<modül id>.json dosyalarına yazılır; bu sayfa onları okur.
   Her modül (eklenti) plugins/<ad>/ klasöründedir:
     veri.js    → Pano.kaynak("<ad>", { yenileme: saniye, async veri(ayar, y) { ... return {...} } })
                  İnternetten veriyi çeker. y: yardımcılar (getir, json, rss, temiz, kucuk)
     widget.js  → Pano.eklenti("<ad>", { ciz(govde, veri, ayar, durum) { ... } })
                  Veriyi ekrana çizer.
     widget.css → (isteğe bağlı) stil
   Hangi modüllerin görüneceği config.json'da (uygulama içinde: Ayarlar) belirlenir. */
(() => {
  const eklentiler = {}, kaynaklar = {}, uyariKaynaklari = {}, calisanlar = [];
  let pencereZamani = null, cfg = null, uyariAcik = false;
  const ONCELIK = { kirmizi: 0, siyah: 1, turuncu: 2, sari: 3 };
  const ANDROID = window.Android || null;

  const depo = {
    al(k, v = null) { try { const x = localStorage.getItem(k); return x == null ? v : JSON.parse(x); } catch (e) { return v; } },
    koy(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    sil(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  /* ── İnternet yardımcıları (veri.js dosyaları kullanır) ─────────────── */
  async function getir(url, secenek = {}) {
    const q = new URLSearchParams({ url });
    if (secenek.basliklar) q.set("h", JSON.stringify(secenek.basliklar));
    const ctrl = new AbortController(), zaman = setTimeout(() => ctrl.abort(), (secenek.zamanAsimi || 30) * 1000);
    try {
      const r = await fetch("/vekil?" + q.toString(), { signal: ctrl.signal });
      const metin = await r.text();
      const durum = Number(r.headers.get("X-Durum") || r.status);
      if (!r.ok || durum >= 400 || durum === 0) throw new Error(`${new URL(url).hostname} cevap vermedi (${durum || "bağlantı yok"})`);
      return metin;
    } catch (e) {
      if (e.name === "AbortError") throw new Error(`${new URL(url).hostname} zaman aşımı`);
      throw e;
    } finally { clearTimeout(zaman); }
  }
  const kucuk = s => (s || "").toLocaleLowerCase("tr");
  const temiz = s => {
    if (!s) return "";
    const d = new DOMParser().parseFromString(`<body>${s}</body>`, "text/html");
    return (d.body.textContent || "").replace(/\s+/g, " ").trim();
  };
  function uyumlu(baslik, ozet, detay) {   // bazı sitelerin beslemesi yanlış habere ait metin gönderebiliyor
    const kel = new Set((kucuk(baslik + " " + ozet).match(/[\p{L}\p{N}]{5,}/gu) || []));
    if (!kel.size) return true;
    const d = kucuk(detay);
    let n = 0; kel.forEach(w => { if (d.includes(w.slice(0, 6))) n++; });
    return n >= Math.max(2, kel.size * 0.25);
  }
  async function rss(url, kaynakAdi, adet = 30) {
    const xml = new DOMParser().parseFromString(await getir(url), "text/xml");
    if (xml.querySelector("parsererror")) throw new Error("besleme okunamadı");
    const tek = (o, ...adlar) => { for (const a of adlar) { const e = o.getElementsByTagName(a)[0]; if (e) return e; } return null; };
    const yazi = (o, ...adlar) => { const e = tek(o, ...adlar); return e ? e.textContent : ""; };
    let ogeler = [...xml.getElementsByTagName("item")];
    if (!ogeler.length) ogeler = [...xml.getElementsByTagName("entry")];
    const kanal = kaynakAdi || temiz(yazi(xml, "title"));
    return ogeler.slice(0, adet).map(o => {
      const aciklama = yazi(o, "description", "summary"), icerik = yazi(o, "content:encoded", "content");
      let link = yazi(o, "link").trim();
      if (!link) { const l = tek(o, "link"); link = l ? l.getAttribute("href") || "" : ""; }
      let gorsel = null;
      const enc = tek(o, "enclosure");
      if (enc && /image/.test(enc.getAttribute("type") || "image")) gorsel = enc.getAttribute("url");
      if (!gorsel) { const m = tek(o, "media:content", "media:thumbnail"); if (m) gorsel = m.getAttribute("url"); }
      if (!gorsel) { const m = (aciklama + icerik).match(/<img[^>]+src=["']([^"']+)/i); if (m) gorsel = m[1]; }
      const baslik = temiz(yazi(o, "title")), ozet = temiz(aciklama);
      let detay = temiz(icerik);
      if (detay && !uyumlu(baslik, ozet, detay)) detay = "";
      if (detay && ozet && !detay.startsWith(ozet.slice(0, 40))) detay = ozet + " " + detay;
      const t = new Date(yazi(o, "pubDate", "updated", "published"));
      return { baslik, link, ozet: ozet.slice(0, 280), detay: (detay || ozet).slice(0, 1800),
               tarih: isNaN(t) ? null : t.toISOString(), gorsel, kaynak: kanal };
    });
  }
  const yardim = { getir, json: async (u, s) => JSON.parse(await getir(u, s)), rss, temiz, kucuk, depo };

  /* ── Genel API ─────────────────────────────────────────────────────── */
  const Pano = window.Pano = {
    eklenti(tur, tanim) { eklentiler[tur] = tanim; },
    kaynak(tur, tanim) { kaynaklar[tur] = tanim; },
    yardim, depo,
    izgaraModu: () => matchMedia("(min-width:900px) and (min-height:600px) and (orientation:landscape)").matches,

    /* Önemli uyarıları ekranın üstündeki "Önemli uyarılar" bölümüne bildirir.
       liste: [{ seviye: "kirmizi"|"siyah"|"turuncu"|"sari", etiket, baslik, alt, tarih, ac: () => {...} }]
       Boş liste ya da null o kaynağın uyarılarını kaldırır. */
    uyari(kaynak, liste) {
      if (liste && liste.length) uyariKaynaklari[kaynak] = liste; else delete uyariKaynaklari[kaynak];
      uyariCiz();
    },
    alarm(kaynak, metin, tur = "uyari") {   // eski eklentiler için
      Pano.uyari(kaynak, metin ? [{ seviye: tur === "taziye" ? "siyah" : "kirmizi", etiket: "Uyarı", baslik: metin }] : null);
    },
    el(etiket, sinif, metin) {
      const e = document.createElement(etiket);
      if (sinif) e.className = sinif;
      if (metin != null) e.textContent = metin;
      return e;
    },
    once(iso) {
      if (!iso) return "";
      const dk = Math.round((Date.now() - new Date(iso)) / 60000);
      if (dk < 1) return "şimdi";
      if (dk < 60) return `${dk} dk önce`;
      const sa = Math.round(dk / 60);
      if (sa < 24) return `${sa} saat önce`;
      return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    },
    mesaj(govde, baslik, aciklama) {
      govde.replaceChildren();
      const d = Pano.el("div", "modul-hata");
      d.appendChild(Pano.el("strong", null, baslik));
      if (aciklama) d.appendChild(Pano.el("span", null, aciklama));
      govde.appendChild(d);
    },
    /* Dış bağlantıyı telefonun tarayıcısında açan düğme */
    disBaglanti(url, metin) {
      const a = Pano.el("a", "dugme", metin);
      a.href = url; a.target = "_blank"; a.rel = "noopener";
      return a;
    },
    pencere(icerik, sure = 0) {
      Pano.pencereKapat();
      const arka = Pano.el("div", "pencere-arka"), kutu = Pano.el("div", "pencere");
      const ust = Pano.el("div", "pencere-ust"), kapat = Pano.el("button", "pencere-kapat", "Kapat");
      kapat.type = "button"; ust.appendChild(kapat);
      kutu.append(ust, icerik); arka.appendChild(kutu);
      arka.addEventListener("click", e => { if (e.target === arka) Pano.pencereKapat(); });
      kapat.addEventListener("click", Pano.pencereKapat);
      document.body.appendChild(arka);
      document.body.style.overflow = "hidden";
      if (sure) pencereZamani = setTimeout(Pano.pencereKapat, sure * 1000);
    },
    pencereKapat() {
      clearTimeout(pencereZamani);
      document.querySelectorAll(".pencere-arka").forEach(e => e.remove());
      document.body.style.overflow = "";
    },
    pencereAcik: () => !!document.querySelector(".pencere-arka"),
    /* Android geri tuşu: açık pencere varsa kapatır (true döner) */
    geri() { if (Pano.pencereAcik()) { Pano.pencereKapat(); return true; } return false; },
    /* Uygulama öne gelince eskimiş verileri tazele */
    onOn() { calisanlar.forEach(c => c(false)); },
  };

  /* Kaydırılarak kaldırılan uyarılar bir daha gösterilmez (30 gün hatırlanır) */
  const GIZLI_ANAHTAR = "pano-gizlenen-uyarilar";
  const uyariKimligi = u => u.id || `${u.etiket}|${u.baslik}`;
  function gizlenenler() {
    const g = depo.al(GIZLI_ANAHTAR, {}), sinir = Date.now() - 30 * 86400000;
    let degisti = false;
    for (const k in g) if (g[k] < sinir) { delete g[k]; degisti = true; }
    if (degisti) depo.koy(GIZLI_ANAHTAR, g);
    return g;
  }
  function uyariGizle(u) {
    const g = gizlenenler(); g[uyariKimligi(u)] = Date.now(); depo.koy(GIZLI_ANAHTAR, g);
  }
  Pano.gizlenenleriGeriGetir = () => { depo.sil(GIZLI_ANAHTAR); uyariCiz(); };

  /* Kartı parmakla yana kaydırınca kaldırır; dikey kaydırma (sayfayı gezme) etkilenmez */
  function kaydirilabilir(li, kaldir) {
    let x0 = 0, y0 = 0, dx = 0, surukleniyor = false, yatay = null;
    li.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; surukleniyor = true; yatay = null;
      li.style.transition = "none";
    });
    li.addEventListener("pointermove", e => {
      if (!surukleniyor) return;
      const ddx = e.clientX - x0, ddy = e.clientY - y0;
      if (yatay === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
        yatay = Math.abs(ddx) > Math.abs(ddy);
        if (yatay) li.setPointerCapture(e.pointerId);
      }
      if (!yatay) return;
      dx = ddx;
      li.style.transform = `translateX(${dx}px)`;
      li.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / li.offsetWidth));
    });
    const birak = () => {
      if (!surukleniyor) return;
      surukleniyor = false;
      li.style.transition = "transform .22s ease-out, opacity .22s ease-out, max-height .25s ease .15s, margin .25s ease .15s, padding .25s ease .15s";
      if (yatay && Math.abs(dx) > li.offsetWidth * 0.3) {
        li.dataset.suruklendi = "1";
        li.style.transform = `translateX(${dx > 0 ? "110%" : "-110%"})`;
        li.style.opacity = "0";
        li.style.maxHeight = li.offsetHeight + "px";
        requestAnimationFrame(() => { li.style.maxHeight = "0"; li.style.paddingTop = li.style.paddingBottom = "0"; li.style.marginBottom = "-.45rem"; });
        setTimeout(kaldir, 420);
      } else {
        if (yatay && Math.abs(dx) > 8) { li.dataset.suruklendi = "1"; setTimeout(() => delete li.dataset.suruklendi, 50); }
        li.style.transform = ""; li.style.opacity = "";
      }
    };
    li.addEventListener("pointerup", birak);
    li.addEventListener("pointercancel", birak);
  }

  function uyariCiz() {
    const el = Pano.el, kutu = document.getElementById("uyariMerkezi");
    const gizli = gizlenenler();
    const tumu = Object.values(uyariKaynaklari).flat();
    const liste = tumu.filter(u => !gizli[uyariKimligi(u)]).sort((a, b) =>
      (ONCELIK[a.seviye] ?? 9) - (ONCELIK[b.seviye] ?? 9) || (b.tarih || "").localeCompare(a.tarih || ""));
    const gizliSayi = tumu.length - liste.length;
    const btn = document.getElementById("uyariBtn");
    btn.hidden = !liste.length;
    document.getElementById("uyariSayi").textContent = liste.length > 9 ? "9+" : String(liste.length);
    btn.classList.toggle("acil", liste.some(u => u.seviye === "kirmizi" || u.seviye === "siyah"));
    kutu.replaceChildren();
    if (!cfg) return;
    const geriGetir = () => {
      const b = el("button", "uy-geri", `Kaldırdığınız ${gizliSayi} uyarıyı yeniden göster`);
      b.type = "button"; b.addEventListener("click", Pano.gizlenenleriGeriGetir);
      return b;
    };
    if (!liste.length) {
      kutu.appendChild(el("div", "uy-sakin", "Şu an önemli bir uyarı yok"));
      if (gizliSayi) kutu.appendChild(geriGetir());
      return;
    }
    const ust = el("div", "uy-ust");
    ust.appendChild(el("h2", null, "Önemli uyarılar"));
    ust.appendChild(el("span", "uy-toplam", String(liste.length)));
    if (!depo.al("pano-kaydirma-ipucu-goruldu", false)) ust.appendChild(el("span", "uy-ipucu", "Kaldırmak için yana kaydırın"));
    kutu.appendChild(ust);
    const ul = el("ul", "uy-liste");
    const sinir = uyariAcik ? liste.length : (cfg.uyari_gosterim_sayisi || 4);
    liste.slice(0, sinir).forEach(u => {
      const li = el("li", "uy-kart uy-" + (u.seviye || "kirmizi"));
      li.appendChild(el("span", "uy-etiket", u.etiket || "Uyarı"));
      li.appendChild(el("span", "uy-baslik", u.baslik));
      if (u.alt) li.appendChild(el("span", "uy-alt", u.alt));
      if (u.ac) {
        li.classList.add("tiklanir"); li.tabIndex = 0;
        li.addEventListener("click", () => { if (!li.dataset.suruklendi) u.ac(); });
      }
      kaydirilabilir(li, () => { uyariGizle(u); depo.koy("pano-kaydirma-ipucu-goruldu", true); uyariCiz(); });
      ul.appendChild(li);
    });
    kutu.appendChild(ul);
    if (liste.length > sinir || uyariAcik) {
      const d = el("button", "uy-daha", uyariAcik ? "Daha az göster" : `${liste.length - sinir} uyarı daha`);
      d.type = "button";
      d.addEventListener("click", () => { uyariAcik = !uyariAcik; uyariCiz(); });
      kutu.appendChild(d);
    }
    if (gizliSayi) kutu.appendChild(geriGetir());
  }

  function saatiGuncelle() {
    const s = new Date();
    const hh = String(s.getHours()).padStart(2, "0"), mm = String(s.getMinutes()).padStart(2, "0");
    document.getElementById("saat").replaceChildren(hh, Pano.el("span", "ayrac", ":"), mm);
    document.getElementById("tarih").textContent = s.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "long" });
  }

  const dosyaYukle = (etiket, oz) => new Promise(coz => {
    const e = Object.assign(document.createElement(etiket), oz);
    e.onload = () => coz(true); e.onerror = () => { e.remove(); coz(false); };
    document.head.appendChild(e);
  });

  /* ── Ayarlar (config) ──────────────────────────────────────────────── */
  async function configYukle() { return (await fetch("config.json?t=" + Date.now(), { cache: "no-store" })).json(); }
  let sunucuDurumu = { moduller: [] };
  async function durumYukle() {
    try { sunucuDurumu = await (await fetch("veri/_durum.json?t=" + Date.now(), { cache: "no-store" })).json(); }
    catch (e) { /* ilk kurulumda henüz yok */ }
    return sunucuDurumu;
  }

  function gocEt(eski, yeni) {
    const c = JSON.parse(JSON.stringify(yeni));
    ["kurum_adi", "alt_baslik", "tema"].forEach(k => { if (eski[k] != null) c[k] = eski[k]; });
    const bul = (cf, tur) => (cf.moduller || []).find(m => m.tur === tur);
    const tasi = (tur, alanlar) => {
      const e = bul(eski, tur), y = bul(c, tur);
      if (!e || !y || !e.ayar) return;
      y.ayar ||= {};
      alanlar.forEach(a => { if (e.ayar[a] != null) y.ayar[a] = e.ayar[a]; });
    };
    tasi("duyuru", ["metinler", "etiket"]);
    tasi("x", ["hesaplar", "uyari_ifadeleri", "uyari_saat", "mod", "gizli"]);
    tasi("haber", ["kaynaklar", "vurgular", "filtre", "haric"]);
    return c;
  }

  function ayarlariAc() {
    const el = Pano.el, d = el("div", "ayarlar");
    d.appendChild(el("h2", null, "Bilgi"));
    const k = sunucuDurumu.kontrol ? new Date(sunucuDurumu.kontrol) : null;
    d.appendChild(el("p", null, k ? `Veriler en son ${k.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} tarihinde kontrol edildi. Yaklaşık 10 dakikada bir güncellenir.` : "Veriler henüz toplanmadı."));
    const hatalar = Object.entries(sunucuDurumu.hatalar || {});
    if (hatalar.length) d.appendChild(el("p", "ayar-mesaj hata", "Son kontrolde sorun çıkan modüller: " + hatalar.map(([id, h]) => `${id} (${h})`).join("; ")));
    const gizliAdet = Object.keys(gizlenenler()).length;
    if (gizliAdet) {
      d.appendChild(el("h3", null, "Kaldırılan uyarılar"));
      const gb = el("button", "dugme ikincil", `Kaldırılan ${gizliAdet} uyarıyı yeniden göster`); gb.type = "button";
      gb.addEventListener("click", () => { Pano.gizlenenleriGeriGetir(); gb.remove(); });
      d.appendChild(gb);
    }
    d.appendChild(el("h3", null, "Ayarları değiştirmek"));
    d.appendChild(el("p", null, "Haber siteleri, X hesapları, uyarı ifadeleri, duyurular ve kurum adı GitHub deposundaki config.json dosyasından değiştirilir. Dosyayı kaydettikten birkaç dakika sonra site kendiliğinden güncellenir."));
    Pano.pencere(d);
  }

  /* ── Modül çalıştırma ─────────────────────────────────────────────── */
  function modulOlustur(m, sira) {
    const k = m.konum || {};
    const kutu = Pano.el("section", "modul modul-" + m.tur);
    kutu.id = "modul-" + m.id;
    if (m.gizli) kutu.hidden = true;   // görünmez modül: verisini çeker, yalnızca üstteki uyarılara katkı verir
    kutu.style.gridColumn = `${k.sutun || 1} / span ${k.genislik || 4}`;
    kutu.style.gridRow = `${k.satir || 1} / span ${k.yukseklik || 2}`;
    kutu.style.order = m.telefon_sira != null ? m.telefon_sira : sira;
    let guncel = null;
    if (m.baslik) {
      const b = Pano.el("div", "modul-baslik");
      b.appendChild(Pano.el("h2", null, m.baslik));
      guncel = Pano.el("span", "guncel"); b.appendChild(guncel);
      kutu.appendChild(b);
    }
    const govde = Pano.el("div", "modul-govde");
    const uyari = Pano.el("div", "modul-uyari"); uyari.hidden = true;
    kutu.append(govde, uyari);
    document.getElementById("izgara").appendChild(kutu);
    return { kutu, govde, guncel, uyari };
  }

  function modulCalistir(m, sira) {
    const { kutu, govde, guncel, uyari } = modulOlustur(m, sira);
    const tanim = eklentiler[m.tur], kaynak = kaynaklar[m.tur];
    if (!tanim) return Pano.mesaj(govde, `"${m.tur}" modülü bulunamadı`, `plugins/${m.tur}/widget.js yok ya da hatalı.`);
    const ayar = m.ayar || {}, durum = { kutu, modul: m };
    const ciz = v => {
      try { tanim.ciz(govde, v, ayar, durum); }
      catch (e) { console.error(e); Pano.mesaj(govde, "Modül çizilemedi", String(e)); }
    };
    try { tanim.baslat && tanim.baslat(govde, ayar, durum); } catch (e) { console.error(e); }
    const verili = (sunucuDurumu.moduller || []).includes(m.id);
    if (!kaynak && !verili) { ciz(null); return; }

    const anahtar = "pano-veri-" + m.id;
    let sonZaman = null;
    const saatYaz = () => {
      const z = sunucuDurumu.kontrol || sonZaman;
      if (guncel) guncel.textContent = z ? "güncellendi " + new Date(z).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
    };
    const onbellek = depo.al(anahtar);
    if (onbellek) { ciz(onbellek.veri); sonZaman = onbellek.zaman; saatYaz(); }
    else govde.replaceChildren(Pano.el("div", "yukleniyor", "Yükleniyor…"));

    const tazele = async () => {
      try {
        const r = await fetch(`veri/${encodeURIComponent(m.id)}.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) throw new Error("veri dosyası henüz oluşmadı");
        const j = await r.json();
        if (j.zaman !== sonZaman) {
          sonZaman = j.zaman;
          depo.koy(anahtar, { zaman: j.zaman, veri: j.veri });
          ciz(j.veri);
        }
        saatYaz();
        uyari.hidden = !j.hata;
        if (j.hata) uyari.textContent = "Son kontrolde kaynağa ulaşılamadı, önceki veri gösteriliyor.";
      } catch (e) {
        if (!onbellek && sonZaman === null) Pano.mesaj(govde, "Veri alınamadı", e.message + ".");
      }
    };
    calisanlar.push(tazele);
    tazele();
    setInterval(tazele, (cfg.ekran_yenileme_saniye || 90) * 1000);
  }

  async function basla() {
    saatiGuncelle(); setInterval(saatiGuncelle, 1000);
    document.getElementById("ayarBtn").addEventListener("click", ayarlariAc);
    const yb = document.getElementById("yenileBtn");
    yb.addEventListener("click", async () => {
      yb.classList.add("donuyor");
      await durumYukle();
      await Promise.all(calisanlar.map(c => c(true)));
      yb.classList.remove("donuyor");
    });

    await durumYukle();
    setInterval(durumYukle, 60000);
    try { cfg = await configYukle(); }
    catch (e) {
      const k = document.getElementById("bilgiKutusu"); k.hidden = false;
      k.textContent = "Ayarlar okunamadı: " + e.message; return;
    }
    document.getElementById("kurumAdi").textContent = cfg.kurum_adi || "Bilgi Ekranı";
    document.getElementById("kurumAlt").textContent = cfg.alt_baslik || "";
    if (cfg.tema === "acik") document.body.classList.add("tema-acik");
    document.body.classList.toggle("telefon", !Pano.izgaraModu());
    const iz = document.getElementById("izgara"), g = cfg.izgara || {};
    iz.style.gridTemplateColumns = `repeat(${g.sutun || 12}, minmax(0,1fr))`;
    iz.style.gridTemplateRows = `repeat(${g.satir || 8}, minmax(0,1fr))`;
    iz.style.gap = "var(--bosluk)";

    const moduller = (cfg.moduller || []).filter(m => m.aktif !== false);
    for (const t of [...new Set(moduller.map(m => m.tur))]) {
      await dosyaYukle("link", { rel: "stylesheet", href: `plugins/${t}/widget.css` });
      await dosyaYukle("script", { src: `plugins/${t}/widget.js` });
    }
    moduller.forEach((m, i) => modulCalistir(m, i));
    uyariCiz();
    document.getElementById("uyariBtn").addEventListener("click", () => {
      Pano.pencereKapat();
      document.getElementById("uyariMerkezi").scrollIntoView({ behavior: "smooth", block: "start" });
      scrollTo({ top: 0, behavior: "smooth" });
    });
    // telefon döndürülünce (dikey ↔ yatay) düzen değişir: modülleri yeniden çiz
    let sonMod = Pano.izgaraModu();
    addEventListener("resize", () => { if (Pano.izgaraModu() !== sonMod) location.reload(); });
  }

  document.addEventListener("keydown", e => { if (e.key === "Escape") Pano.pencereKapat(); });
  document.addEventListener("DOMContentLoaded", basla);
})();
