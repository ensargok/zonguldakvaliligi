(() => {
  const KODLAR = {
    0: ["Açık", "☀️", "🌙"], 1: ["Az bulutlu", "🌤️", "🌙"], 2: ["Parçalı bulutlu", "⛅", "☁️"], 3: ["Kapalı", "☁️", "☁️"],
    45: ["Sisli", "🌫️"], 48: ["Kırağılı sis", "🌫️"],
    51: ["Hafif çisenti", "🌦️"], 53: ["Çisenti", "🌦️"], 55: ["Yoğun çisenti", "🌧️"],
    56: ["Donan çisenti", "🌧️"], 57: ["Donan çisenti", "🌧️"],
    61: ["Hafif yağmur", "🌦️"], 63: ["Yağmurlu", "🌧️"], 65: ["Kuvvetli yağmur", "🌧️"],
    66: ["Donan yağmur", "🌧️"], 67: ["Donan yağmur", "🌧️"],
    71: ["Hafif kar", "🌨️"], 73: ["Karlı", "🌨️"], 75: ["Yoğun kar", "❄️"], 77: ["Kar taneleri", "🌨️"],
    80: ["Hafif sağanak", "🌦️"], 81: ["Sağanak", "🌧️"], 82: ["Şiddetli sağanak", "⛈️"],
    85: ["Kar sağanağı", "🌨️"], 86: ["Yoğun kar sağanağı", "❄️"],
    95: ["Gök gürültülü", "⛈️"], 96: ["Dolu ihtimali", "⛈️"], 99: ["Dolu", "⛈️"],
  };
  const tarif = k => (KODLAR[k] || ["", "🌡️"])[0];
  const ikon = (k, gunduz = 1) => { const x = KODLAR[k] || ["", "🌡️"]; return (!gunduz && x[2]) || x[1]; };
  const YONLER = ["K", "KD", "D", "GD", "G", "GB", "B", "KB"];
  const yon = d => YONLER[Math.round(d / 45) % 8];
  const el = (...a) => Pano.el(...a);

  Pano.eklenti("hava", {
    yenile_saniye: 300,
    ciz(govde, v) {
      govde.replaceChildren();
      const s = v.simdi;
      const ust = el("div", "hv-ust");
      ust.appendChild(el("div", "hv-ikon", ikon(s.kod, s.gunduz)));
      const sag = el("div", "hv-sag");
      sag.appendChild(el("div", "hv-derece", `${s.sicaklik}°`));
      sag.appendChild(el("div", "hv-tarif", tarif(s.kod)));
      ust.appendChild(sag);
      govde.appendChild(ust);

      const det = el("div", "hv-detay");
      [["Hissedilen", `${s.hissedilen}°`], ["Rüzgâr", `${s.ruzgar} km/sa ${yon(s.ruzgar_yonu)}`],
       ["Nem", `%${s.nem}`], ["Gün batımı", v.gun_batimi]].forEach(([a, b]) => {
        const d = el("div"); d.appendChild(el("span", null, a)); d.appendChild(el("strong", null, b)); det.appendChild(d);
      });
      govde.appendChild(det);

      const saat = el("div", "hv-saatlik");
      v.saatlik.forEach(x => {
        const d = el("div");
        d.appendChild(el("span", "hv-kucuk", x.saat));
        d.appendChild(el("span", "hv-orta", ikon(x.kod, x.gunduz)));
        d.appendChild(el("strong", null, `${x.sicaklik}°`));
        d.appendChild(el("span", "hv-yagis", x.yagis ? `%${x.yagis}` : ""));
        saat.appendChild(d);
      });
      govde.appendChild(saat);

      const gun = el("div", "hv-gunluk");
      v.gunluk.forEach(x => {
        const d = el("div", "hv-gun");
        d.appendChild(el("span", "hv-gun-ad", new Date(x.tarih).toLocaleDateString("tr-TR", { weekday: "long" })));
        d.appendChild(el("span", "hv-orta", ikon(x.kod)));
        d.appendChild(el("span", "hv-yagis", x.yagis ? `%${x.yagis}` : ""));
        d.appendChild(el("span", "hv-aralik", `${x.en_yuksek}° / ${x.en_dusuk}°`));
        gun.appendChild(d);
      });
      govde.appendChild(gun);
    },
  });
})();
