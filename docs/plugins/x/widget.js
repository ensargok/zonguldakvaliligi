/* X paylaşımları.
   mod "otomatik" (varsayılan) / "rss" / "api": paylaşımlar sunucudan gelir, kart olarak listelenir.
     "uyari_ifadeleri" ile eşleşen son paylaşımlar en üstte ayrı gösterilir ve üst şeritte uyarı çıkar.
     Karta tıklayınca paylaşımın tamamı açılır.
   mod "gomulu": X'in kendi akış kutusu (otomatik mod çalışmazsa ekran buna kendiliğinden geçer)
   ayar: hesaplar, donme_saniye, gomulu_yenile_dakika (varsayılan 15) */
(() => {
  const el = (...a) => Pano.el(...a);

  function widgetsYukle() {
    if (window.__xWidgets) return window.__xWidgets;
    window.__xWidgets = new Promise(coz => {
      if (window.twttr && window.twttr.widgets) return coz(window.twttr);
      const s = document.createElement("script");
      s.src = "https://platform.twitter.com/widgets.js"; s.async = true; s.charset = "utf-8";
      s.onload = () => (window.twttr && twttr.ready ? twttr.ready(coz) : coz(window.twttr));
      s.onerror = () => coz(null);
      document.head.appendChild(s);
    });
    return window.__xWidgets;
  }

  function gomuluKur(govde, ayar, durum) {
    govde.replaceChildren();
    govde.classList.add("x-gomulu");
    const hesaplar = ayar.hesaplar || [];
    const kutular = hesaplar.map(h => {
      const kutu = el("div", "x-akis");
      const ust = el("div", "x-akis-ust");
      ust.appendChild(el("strong", null, "@" + h.kullanici.replace(/^@/, "")));
      if (h.ad) ust.appendChild(el("span", null, h.ad));
      const yer = el("div", "x-akis-yer");
      kutu.append(ust, yer);
      govde.appendChild(kutu);
      return { h, yer };
    });
    requestAnimationFrame(async () => {
      const twttr = await widgetsYukle();
      if (!twttr || !twttr.widgets) {
        return Pano.mesaj(govde, "X yüklenemedi", "platform.twitter.com adresine ulaşılamıyor. İnternet bağlantısını kontrol edin.");
      }
      const tema = document.body.classList.contains("tema-acik") ? "light" : "dark";
      for (const { h, yer } of kutular) {
        yer.replaceChildren();
        try {
          await twttr.widgets.createTimeline(
            { sourceType: "profile", screenName: h.kullanici.replace(/^@/, "") }, yer,
            { height: Math.max(200, yer.clientHeight), theme: tema, chrome: "noheader nofooter noborders transparent", lang: "tr", dnt: true });
        } catch (e) { console.error(e); }
      }
      setTimeout(() => {
        if (!govde.querySelector("iframe")) {
          const not = el("div", "x-not", "Paylaşımlar görünmüyorsa: bu bilgisayardaki Chrome'da x.com adresine girip bir X hesabıyla oturum açın, sonra ekranı yenileyin.");
          govde.appendChild(not);
        }
      }, 20000);
    });
  }

  function paylasimGoster(p) {
    const d = el("article", "x-detay" + (p.uyari ? " uyari" : ""));
    const ust = el("div", "x-ust");
    ust.appendChild(el("strong", null, (p.ad ? p.ad + " " : "") + "@" + p.kullanici));
    ust.appendChild(el("span", null, Pano.once(p.tarih)));
    d.appendChild(ust);
    if (p.uyari) d.appendChild(el("div", "x-uyari-etiket", "Uyarı ifadesi içeriyor"));
    p.metin.split(/\n+/).forEach(s => s.trim() && d.appendChild(el("p", null, s)));
    if (p.gorsel) {
      const img = el("img", "x-detay-gorsel"); img.src = p.gorsel; img.alt = ""; img.referrerPolicy = "no-referrer";
      img.onerror = () => img.remove(); d.appendChild(img);
    }
    const alt = el("div", "x-detay-alt");
    alt.appendChild(Pano.disBaglanti(p.link, "X'te aç"));
    d.appendChild(alt);
    Pano.pencere(d, Pano.izgaraModu() ? 60 : 0);
  }

  function kart(p, ayar, sinif = "") {
    const li = el("li", sinif + (p.uyari_guncel ? " uyari" : ""));
    const ust = el("div", "x-ust");
    ust.appendChild(el("strong", null, "@" + p.kullanici));
    ust.appendChild(el("span", null, Pano.once(p.tarih)));
    li.appendChild(ust);
    li.appendChild(el("p", "x-metin", p.metin));
    if (p.gorsel && ayar.gorsel_goster !== false) {
      const img = el("img", "x-gorsel"); img.src = p.gorsel; img.alt = ""; img.referrerPolicy = "no-referrer";
      img.onerror = () => img.remove(); li.appendChild(img);
    }
    li.classList.add("tiklanir"); li.tabIndex = 0;
    li.addEventListener("click", () => paylasimGoster(p));
    li.addEventListener("keydown", e => { if (e.key === "Enter") paylasimGoster(p); });
    return li;
  }

  function kartlar(govde, v, ayar, durum) {
    clearInterval(durum.zamanlayici);
    govde.classList.remove("x-gomulu");
    if (!v.paylasimlar.length) {
      Pano.uyari(durum.modul.id, null);
      return Pano.mesaj(govde, "Paylaşım yok", v.bilgi || "Hesaplara şu an ulaşılamıyor.");
    }
    const sinir = (ayar.uyari_saat || 24) * 3600000;   // "son 24 saat" her açılışta yeniden hesaplanır
    v.paylasimlar.forEach(p => { p.uyari_guncel = !!(p.uyari && p.tarih && Date.now() - new Date(p.tarih) < sinir); });
    const uyarilar = v.paylasimlar.filter(p => p.uyari_guncel);
    // uyarı içeren paylaşımlar ekranın üstündeki "Önemli uyarılar" bölümüne gider; listede kırmızı çerçeveyle kalır
    Pano.uyari(durum.modul.id, uyarilar.map(p => ({
      id: "x-" + p.link, seviye: "siyah", etiket: "X", tarih: p.tarih,
      baslik: `@${p.kullanici}: ${p.uyari_parca || p.metin.slice(0, 120)}`,
      alt: Pano.once(p.tarih), ac: () => paylasimGoster(p),
    })));
    const digerleri = v.paylasimlar;

    const ciz = () => {
      govde.replaceChildren();
      const ul = el("ul", "x-liste");
      const n = Pano.izgaraModu() ? Math.min(digerleri.length, 8) : Math.min(digerleri.length, ayar.telefon_liste_sayisi || 12);
      for (let i = 0; i < n; i++) ul.appendChild(kart(digerleri[(durum.bas + i) % digerleri.length], ayar));
      govde.appendChild(ul);
      const sigdir = () => {   // kutuya sığmayan kartları gizle (görseller yüklendikçe yeniden)
        const alt = govde.getBoundingClientRect().bottom;
        ul.querySelectorAll("li").forEach(li => { if (li.getBoundingClientRect().bottom > alt) li.style.display = "none"; });
      };
      if (Pano.izgaraModu()) {
        requestAnimationFrame(sigdir);
        ul.querySelectorAll("img").forEach(img => img.addEventListener("load", sigdir));
      }
    };
    durum.bas = digerleri.length && Pano.izgaraModu() ? (durum.bas || 0) % digerleri.length : 0;
    ciz();
    if (digerleri.length > 3 && Pano.izgaraModu()) durum.zamanlayici = setInterval(() => {
      if (Pano.pencereAcik()) return;
      durum.bas = (durum.bas + 1) % digerleri.length; ciz();
    }, (ayar.donme_saniye || 10) * 1000);
  }

  Pano.eklenti("x", {
    yenile_saniye: 300,
    ciz(govde, v, ayar, durum) {
      if (v.gomulu) {
        if (durum.gomuluKuruldu) return;      // her yenilemede baştan kurma
        durum.gomuluKuruldu = true;
        gomuluKur(govde, ayar, durum);
        // yeni paylaşımlar gelsin diye akışları belli aralıklarla yeniden yükle
        setInterval(() => gomuluKur(govde, ayar, durum), (ayar.gomulu_yenile_dakika || 15) * 60000);
        return;
      }
      kartlar(govde, v, ayar, durum);
    },
  });
})();
