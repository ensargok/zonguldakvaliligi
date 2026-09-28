/* MGM uyarıları: bölgeyi ilgilendirenleri ekranın üstündeki "Önemli uyarılar" bölümüne gönderir.
   Modül "gizli": true ise kendi kutusu görünmez, yalnızca üstteki uyarılarda yer alır. */
Pano.eklenti("mgm_uyari", {
  ciz(govde, v, ayar, durum) {
    const el = Pano.el;
    const ilgili = v.uyarilar.filter(u => u.eslesme);
    const detay = u => () => {
      const d = el("div", "mgm-detay");
      d.appendChild(el("span", "mgm-rozet " + u.eslesme, u.eslesme === "kesin" ? "Bölgemizi kapsıyor" : "Karadeniz geneli"));
      d.appendChild(el("h2", null, u.baslik));
      d.appendChild(el("p", null, `${u.tarih} tarihli MGM meteorolojik uyarısı. Ayrıntılar MGM'nin sitesinde yer alıyor.`));
      d.appendChild(Pano.disBaglanti(u.url, "MGM uyarılarını aç"));
      Pano.pencere(d);
    };
    Pano.uyari(durum.modul.id, ilgili.map(u => ({
      id: "mgm-" + u.id,
      seviye: u.eslesme === "kesin" ? "kirmizi" : "turuncu",
      etiket: "MGM",
      baslik: u.baslik,
      alt: `${u.tarih}, ${u.eslesme === "kesin" ? "bölgemizi kapsıyor" : "Karadeniz geneli"}`,
      tarih: u.tarih.split(".").reverse().join("-"),
      ac: detay(u),
    })));

    govde.replaceChildren();
    if (!ilgili.length) {
      const d = el("div", "mgm-sakin");
      d.appendChild(el("strong", null, "Bölgemiz için aktif uyarı yok"));
      d.appendChild(el("span", null, v.uyarilar.length ? `Türkiye genelinde ${v.uyarilar.length} uyarı var, bölgemizi kapsamıyor.` : "MGM listesinde güncel uyarı bulunmuyor."));
      govde.appendChild(d);
      return;
    }
    const ul = el("ul", "mgm-liste");
    ilgili.forEach(u => {
      const li = el("li", u.eslesme + " tiklanir");
      li.appendChild(el("span", "mgm-baslik", u.baslik));
      li.appendChild(el("span", "mgm-alt", u.tarih));
      li.addEventListener("click", detay(u));
      ul.appendChild(li);
    });
    govde.appendChild(ul);
  },
});
