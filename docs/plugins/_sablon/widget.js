Pano.eklenti("_sablon", {
  yenile_saniye: 60,                 // ekran veriyi kaç saniyede bir istesin
  ciz(govde, veri, ayar, durum) {    // veri = plugin.py'deki veri() fonksiyonunun döndürdüğü
    govde.replaceChildren();
    govde.appendChild(Pano.el("p", null, `${veri.mesaj} (sunucu saati ${veri.saat})`));
  },
});
