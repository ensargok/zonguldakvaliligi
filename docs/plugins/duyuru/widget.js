/* Kayan yazı — arka ucu yoktur, metinler doğrudan config.json'dan gelir.
   ayar: metinler: ["...", "..."], etiket: "Duyuru", hiz: saniyede piksel (varsayılan 90) */
Pano.eklenti("duyuru", {
  ciz(govde, _veri, ayar) {
    const el = Pano.el;
    govde.replaceChildren();
    if (ayar.etiket) govde.appendChild(el("div", "dy-etiket", ayar.etiket));
    const pencere = el("div", "dy-pencere"), serit = el("div", "dy-serit");
    const metin = (ayar.metinler || []).join("     ◆     ");
    serit.append(el("span", null, metin), el("span", null, metin));
    pencere.appendChild(serit);
    govde.appendChild(pencere);
    requestAnimationFrame(() => {
      const w = serit.firstChild.offsetWidth;
      serit.style.animationDuration = `${Math.max(10, w / (ayar.hiz || 90))}s`;
    });
  },
});
