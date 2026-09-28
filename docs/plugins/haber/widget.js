/* Haber eklentisi
   - Üstte kaynak logoları: yeni haber gelen sitenin logosunda kırmızı sayı çıkar, logo yanıp söner.
     Logoya tıklayınca yalnızca o sitenin haberleri gösterilir; tekrar tıklayınca (veya "Tümü") hepsi.
   - Fotoğraflı vitrin + başlık listesi; herhangi bir habere tıklayınca özeti açılır.
   - "vurgular" (varsayılan: Valilik) ile eşleşen haberler ayrı bir bölümde gösterilir.
   ayar: donme_saniye, one_cikan_sayisi, yeni_isaret_dakika, filtre_sifirla_saniye, ozet_sure_saniye */
(() => {
  const el = (...a) => Pano.el(...a);
  const depoAl = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const depoKoy = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const anahtar = durum => "pano-haber-" + durum.modul.id;

  function yenileriBul(v, ayar, durum) {
    const kayit = depoAl(anahtar(durum)) || { gorulen: null, yeni: {} };
    const simdi = Date.now(), sure = (ayar.yeni_isaret_dakika || 15) * 60000;
    const ilkKez = !kayit.gorulen;
    const gorulen = new Set(kayit.gorulen || []);
    v.haberler.forEach(h => {
      if (!gorulen.has(h.link)) {
        gorulen.add(h.link);
        if (!ilkKez) kayit.yeni[h.link] = { zaman: simdi, kaynak: h.kaynak };
      }
    });
    for (const [link, y] of Object.entries(kayit.yeni)) if (simdi - y.zaman > sure) delete kayit.yeni[link];
    kayit.gorulen = [...gorulen].slice(-600);
    depoKoy(anahtar(durum), kayit);
    const kaynakSayilari = {};
    Object.values(kayit.yeni).forEach(y => { kaynakSayilari[y.kaynak] = (kaynakSayilari[y.kaynak] || 0) + 1; });
    return { linkler: new Set(Object.keys(kayit.yeni)), kaynakSayilari };
  }

  function kaynagiOkunduSay(durum, ad) {
    const kayit = depoAl(anahtar(durum));
    if (!kayit) return;
    for (const [link, y] of Object.entries(kayit.yeni)) if (y.kaynak === ad) delete kayit.yeni[link];
    depoKoy(anahtar(durum), kayit);
  }

  function logoOlustur(logo, ad, sinif) {
    const kutu = el("span", sinif);
    if (!logo) { kutu.textContent = ad.slice(0, 1); kutu.classList.add("hb-logo-harf"); return kutu; }
    const img = el("img"); img.src = logo; img.alt = ""; img.referrerPolicy = "no-referrer";
    img.onerror = () => { img.remove(); kutu.textContent = ad.slice(0, 1); kutu.classList.add("hb-logo-harf"); };
    kutu.appendChild(img);
    return kutu;
  }

  function kaynakSatiri(h, logolar, yeniMi) {
    const d = el("div", "hb-kaynak");
    if (yeniMi) d.appendChild(el("span", "hb-yeni-etiket", "Yeni"));
    d.appendChild(logoOlustur(logolar[h.kaynak], h.kaynak, "hb-mini-logo"));
    d.appendChild(el("span", null, [h.kaynak, Pano.once(h.tarih)].filter(Boolean).join(", ")));
    return d;
  }

  function tiklanabilir(e, fn) {
    e.classList.add("tiklanir");
    e.tabIndex = 0;
    e.addEventListener("click", ev => { ev.stopPropagation(); fn(); });
    e.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fn(); } });
    return e;
  }

  function ozetGoster(h, logolar, ayar) {
    const d = el("article", "hb-detay");
    if (h.gorsel) {
      const img = el("img", "hb-detay-gorsel"); img.src = h.gorsel; img.alt = ""; img.referrerPolicy = "no-referrer";
      img.onerror = () => img.remove(); d.appendChild(img);
    }
    const ust = kaynakSatiri(h, logolar);
    (h.etiketler || []).forEach(t => ust.appendChild(el("span", "hb-vurgu-etiket", t)));
    d.appendChild(ust);
    d.appendChild(el("h2", "hb-detay-baslik", h.baslik));
    const metin = h.detay || h.ozet || "Bu haber için özet bulunmuyor.";
    metin.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ“"])/).reduce((par, cumle, i) => {
      if (i % 3 === 0) { par = el("p"); d.appendChild(par); }
      par.textContent += (par.textContent ? " " : "") + cumle;
      return par;
    }, null);
    if (h.link) {
      const alt = el("div", "hb-detay-alt");
      alt.appendChild(Pano.disBaglanti(h.link, "Haberin tamamını oku"));
      try { alt.appendChild(el("span", null, new URL(h.link).hostname.replace(/^www\./, ""))); } catch (e) {}
      d.appendChild(alt);
    }
    Pano.pencere(d, Pano.izgaraModu() ? (ayar.ozet_sure_saniye || 60) : 0);
  }

  Pano.eklenti("haber", {
    yenile_saniye: 60,
    ciz(govde, v, ayar, durum) {
      clearInterval(durum.zamanlayici);
      durum.sonVeri = v;
      const kayanKonum = govde.querySelector(".hb-logolar") ? govde.querySelector(".hb-logolar").scrollLeft : 0;
      const yeniden = () => this.ciz(govde, durum.sonVeri, ayar, durum);
      govde.replaceChildren();
      if (!v.haberler.length) return Pano.mesaj(govde, "Haber bulunamadı", v.bilgi || "Kaynaklara şu an ulaşılamıyor.");

      const yeni = yenileriBul(v, ayar, durum);
      const logolar = {};
      (v.kaynaklar || []).forEach(k => { logolar[k.ad] = k.logo; });
      const gorunen = durum.filtre ? ((v.kaynak_haberleri || {})[durum.filtre] || []) : v.haberler;

      // ── Kaynak logoları
      if (v.kaynaklar && v.kaynaklar.length && ayar.logolari_goster !== false) {
        const serit = el("div", "hb-logolar" + (durum.filtre ? " filtreli" : ""));
        v.kaynaklar.forEach(k => {
          const sayi = yeni.kaynakSayilari[k.ad] || 0;
          const kart = el("div", "hb-logo-kart" + (sayi ? " yeni" : "") + (durum.filtre === k.ad ? " secili" : "")
            + ((v.hatalar || []).includes(k.ad) ? " hatali" : ""));
          const logo = logoOlustur(k.logo, k.ad, "hb-logo");
          if (sayi) logo.appendChild(el("span", "hb-nokta", sayi > 9 ? "9+" : String(sayi)));
          kart.append(logo, el("span", "hb-logo-ad", k.ad));
          kart.title = `${k.ad} haberlerini göster`;
          tiklanabilir(kart, () => {
            durum.filtre = durum.filtre === k.ad ? null : k.ad;
            kaynagiOkunduSay(durum, k.ad);
            durum.sira = 0;
            clearTimeout(durum.filtreZamani);
            if (durum.filtre && Pano.izgaraModu()) durum.filtreZamani = setTimeout(() => { durum.filtre = null; yeniden(); }, (ayar.filtre_sifirla_saniye || 120) * 1000);
            yeniden();
          });
          serit.appendChild(kart);
        });
        if (durum.filtre) {
          serit.appendChild(tiklanabilir(el("div", "hb-tumu", "Tümü"), () => { durum.filtre = null; durum.sira = 0; yeniden(); }));
        }
        govde.appendChild(serit);
        serit.scrollLeft = kayanKonum;
      }

      if (!gorunen.length) {
        govde.appendChild(el("p", "bos", `${durum.filtre} için şu an haber yok.`));
        return;
      }

      // ── Vurgulanan haberler (Valilik vb.) → ekranın üstündeki "Önemli uyarılar"
      const vurguSinir = (ayar.vurgu_uyari_saat || 24) * 3600000;
      const vurguUyarilari = [];
      (v.vurgular || []).forEach(ad => ((v.vurgu_haberleri || {})[ad] || []).forEach(h => {
        if (h.tarih && Date.now() - new Date(h.tarih) > vurguSinir) return;
        vurguUyarilari.push({ id: "haber-" + h.link, seviye: "sari", etiket: ad, baslik: h.baslik, tarih: h.tarih,
          alt: [h.kaynak, Pano.once(h.tarih)].filter(Boolean).join(", "), ac: () => ozetGoster(h, logolar, ayar) });
      }));
      Pano.uyari(durum.modul.id, vurguUyarilari.slice(0, ayar.vurgu_uyari_sayisi || 4));

      // ── Manşet: parmakla kaydırılabilen slaytlar
      const vListe = (() => { const g = gorunen.filter(h => h.gorsel).slice(0, ayar.one_cikan_sayisi || 8); return g.length ? g : gorunen.slice(0, 5); })();
      const serit = el("div", "hb-manset");
      vListe.forEach((h, i) => {
        const slayt = el("article", "hb-slayt");
        const gorsel = el("div", "hb-gorsel" + (h.gorsel ? "" : " hb-gorselsiz"));
        if (h.gorsel) {
          const img = el("img"); img.alt = ""; img.referrerPolicy = "no-referrer"; img.src = h.gorsel;
          img.onerror = () => gorsel.classList.add("hb-gorselsiz"); gorsel.appendChild(img);
        }
        const yazi = el("div", "hb-vitrin-yazi");
        yazi.append(kaynakSatiri(h, logolar, yeni.linkler.has(h.link)), el("h3", "hb-vitrin-baslik", h.baslik), el("p", "hb-ozet", h.ozet));
        slayt.append(gorsel, yazi);
        slayt.addEventListener("click", () => ozetGoster(h, logolar, ayar));
        serit.appendChild(slayt);
      });
      const noktalar = el("div", "hb-noktalar");
      vListe.forEach((_, i) => {
        const n = el("button"); n.type = "button"; n.setAttribute("aria-label", `${i + 1}. manşet`);
        n.addEventListener("click", () => { dokunuldu(); git(i); });
        noktalar.appendChild(n);
      });
      govde.append(serit, noktalar);

      const noktaGuncelle = i => [...noktalar.children].forEach((n, j) => n.classList.toggle("aktif", j === i));
      const git = (i, anlik) => { durum.sira = i; serit.scrollTo({ left: i * serit.clientWidth, behavior: anlik ? "auto" : "smooth" }); noktaGuncelle(i); };
      let sonDokunma = 0;
      const dokunuldu = () => { sonDokunma = Date.now(); };
      serit.addEventListener("touchstart", dokunuldu, { passive: true });
      serit.addEventListener("pointerdown", dokunuldu);
      let kaydirmaZamani;
      serit.addEventListener("scroll", () => {
        clearTimeout(kaydirmaZamani);
        kaydirmaZamani = setTimeout(() => {
          const i = Math.round(serit.scrollLeft / Math.max(1, serit.clientWidth));
          durum.sira = i; noktaGuncelle(i);
        }, 80);
      }, { passive: true });
      durum.sira = Math.min(durum.sira || 0, vListe.length - 1);
      requestAnimationFrame(() => git(durum.sira, true));
      durum.zamanlayici = setInterval(() => {
        // kullanıcı son 20 saniyede dokunduysa ya da özet açıksa otomatik geçme
        if (Pano.pencereAcik() || Date.now() - sonDokunma < 20000 || document.hidden) return;
        git((durum.sira + 1) % vListe.length);
      }, (ayar.donme_saniye || 8) * 1000);

      // ── Diğer haberler
      const liste = el("ol", "hb-liste");
      const mansettekiler = new Set(vListe);
      gorunen.filter(x => !mansettekiler.has(x)).slice(0, Pano.izgaraModu() ? 14 : (ayar.telefon_liste_sayisi || 20)).forEach(x => {
        const li = el("li", yeni.linkler.has(x.link) ? "yeni" : "");
        li.appendChild(el("span", "hb-liste-baslik", x.baslik));
        li.appendChild(kaynakSatiri(x, logolar));
        liste.appendChild(tiklanabilir(li, () => ozetGoster(x, logolar, ayar)));
      });
      govde.appendChild(liste);
      if (Pano.izgaraModu()) requestAnimationFrame(() => {   // kutuya tam sığmayan başlıkları gizle
        const alt = liste.getBoundingClientRect().bottom;
        [...liste.children].forEach(li => { if (li.getBoundingClientRect().bottom > alt + 1) li.style.visibility = "hidden"; });
      });
    },
  });
})();
