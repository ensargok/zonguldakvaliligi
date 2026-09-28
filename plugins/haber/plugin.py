# -*- coding: utf-8 -*-
"""Haber siteleri — RSS beslemelerini birleştirir, en yeniden eskiye sıralar.
ayar:
  kaynaklar: [{"ad": "Z Haber", "url": "https://www.zhaber.com.tr/rss"}, ...]
  adet: toplam kaç haber tutulsun (varsayılan 40)
  filtre: ["zonguldak", "ereğli"]  → yalnızca bu kelimeleri içeren haberler (isteğe bağlı)
  haric:  ["magazin"]              → bu kelimeleri içerenleri gizle (isteğe bağlı)
  vurgular: [{"ad": "Valilik", "desenler": ["\\bvali"], "haric": ["\\bvaliz"]}]
           → bu ifadeleri içeren haberler ayrı bir bölümde gösterilir
Her kaynağa "logo": "https://..." yazarak logoyu elle de belirleyebilirsiniz; yazmazsanız
sitenin kendi simgesi otomatik bulunur."""
import re, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from ortak import rss_oku, getir

YENILEME = 600
VARSAYILAN_VURGU = [{"ad": "Valilik", "desenler": [r"\bvali"], "haric": [r"\bvaliz", r"\bvalid"]}]


_logolar = {}  # site -> (zaman, logo_url)


def _logo_bul(k):
    if k.get("logo"):
        return k["logo"]
    u = urllib.parse.urlparse(k["url"])
    site = f"{u.scheme}://{u.netloc}"
    kayit = _logolar.get(site)
    if kayit and time.time() - kayit[0] < 86400:
        return kayit[1]
    logo = None
    try:
        sayfa = getir(site, zaman_asimi=10)[:200000]
        for tur in ("apple-touch-icon", "icon", "shortcut icon"):
            for etiket in re.findall(r"<link[^>]+>", sayfa, re.I):
                if re.search(rf'rel=["\']{tur}["\']', etiket, re.I):
                    m = re.search(r'href=["\']([^"\']+)', etiket)
                    if m:
                        logo = urllib.parse.urljoin(site + "/", m.group(1))
                        break
            if logo:
                break
        if not logo:  # simge yoksa sayfadaki logo resmini dene
            m = re.search(r'<img[^>]+(?:class|id)=["\'][^"\']*logo[^"\']*["\'][^>]*>', sayfa, re.I)
            m = m and re.search(r'src=["\']([^"\']+)', m.group(0))
            if m:
                logo = urllib.parse.urljoin(site + "/", m.group(1))
    except Exception as e:
        print("Logo bulunamadı:", site, e)
    logo = logo or f"https://www.google.com/s2/favicons?domain={u.netloc}&sz=128"
    _logolar[site] = (time.time(), logo)
    return logo


def _k(s):
    return s.replace("İ", "i").replace("I", "ı").lower()


def veri(ayar):
    kaynaklar = ayar.get("kaynaklar", [])
    if not kaynaklar:
        return {"haberler": [], "bilgi": "config.json içinde haber modülüne 'kaynaklar' ekleyin."}
    haberler, hatalar = [], []

    def oku(k):
        try:
            return rss_oku(k["url"], k.get("ad"), adet=k.get("adet", 20))
        except Exception as e:
            hatalar.append(k.get("ad") or k["url"])
            print("Haber kaynağı okunamadı:", k.get("url"), e)
            return []

    with ThreadPoolExecutor(max_workers=8) as ex:
        for liste in ex.map(oku, kaynaklar):
            haberler.extend(liste)
        logolar = list(ex.map(_logo_bul, kaynaklar))
    kaynak_bilgi = [{"ad": k.get("ad") or k["url"], "logo": l} for k, l in zip(kaynaklar, logolar)]

    filtre = [_k(f) for f in ayar.get("filtre", [])]
    haric = [_k(f) for f in ayar.get("haric", [])]
    gorulen, sonuc = set(), []
    for h in sorted(haberler, key=lambda x: x["tarih"] or "", reverse=True):
        metin = _k(h["baslik"] + " " + h["ozet"])
        if filtre and not any(f in metin for f in filtre):
            continue
        if any(f in metin for f in haric):
            continue
        anahtar = re.sub(r"\W+", "", _k(h["baslik"]))[:60]
        if anahtar in gorulen:
            continue
        gorulen.add(anahtar)
        sonuc.append(h)
    vurgular = ayar.get("vurgular", VARSAYILAN_VURGU)
    for h in sonuc:
        metin = _k(h["baslik"] + " " + h["ozet"])
        h["etiketler"] = [v["ad"] for v in vurgular
                          if any(re.search(d, metin) for d in v.get("desenler", []))
                          and not any(re.search(d, metin) for d in v.get("haric", []))]
    vurgu_haberleri = {v["ad"]: [h for h in sonuc if v["ad"] in h["etiketler"]][:10] for v in vurgular}
    kaynak_haberleri = {}
    for h in sonuc:
        l = kaynak_haberleri.setdefault(h["kaynak"], [])
        if len(l) < 15:
            l.append(h)
    return {"kaynak_haberleri": kaynak_haberleri, "vurgular": [v["ad"] for v in vurgular], "vurgu_haberleri": vurgu_haberleri,
            "haberler": sonuc[: ayar.get("adet", 40)], "hatalar": hatalar, "kaynaklar": kaynak_bilgi}
