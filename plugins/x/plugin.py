# -*- coding: utf-8 -*-
"""X (Twitter) paylaşımları.

  "mod": "otomatik" → (varsayılan) X'in gömülü akış kutusunun kullandığı herkese açık kaynaktan
                      paylaşımları çeker. Anahtar gerekmez. X bu kaynağı değiştirirse çalışmayabilir;
                      o durumda ekran kendiliğinden X'in kendi kutusuna (gömülü) geçer.
  "mod": "gomulu"   → Doğrudan X'in kendi akış kutusu (uyarı ifadeleri bu modda taranamaz).
  "mod": "rss"      → Her hesap için bir RSS bağlantısı (rss.app, RSSHub vb.).
  "mod": "api"      → Resmî, ücretli X API (Bearer Token "gizli" → "bearer_token" içine).

ayar:
  hesaplar: [{"kullanici": "TC_icisleri", "ad": "İçişleri Bakanlığı"}]
  hesap_basina: her hesaptan kaç paylaşım (varsayılan 8)
  uyari_ifadeleri: ["şehi[td]", "başı\\s+sağ\\s+olsun"]  → bu ifadeler geçen paylaşımlar uyarı olarak gösterilir
  uyari_saat: son kaç saatteki paylaşımlar uyarı sayılsın (varsayılan 24)"""
import html, json, re, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from ortak import rss_oku, getir, getir_json

YENILEME = 300
_kimlikler = {}
VARSAYILAN_UYARI = [r"şehi[td]", r"şehadet", r"başı\s+sağ\s+olsun", r"başsağlığı", r"rahmet\s+diliyor"]
SYND = ("https://syndication.twitter.com/srv/timeline-profile/screen-name/{k}"
        "?dnt=true&embedId=twitter-widget-0&features=e30%3D&frame=false&hideBorder=false&hideFooter=false"
        "&hideHeader=false&hideScrollBar=false&lang=tr&origin=http%3A%2F%2Flocalhost%2F&showHeader=true"
        "&showReplies=false&transparent=false")


def _kucuk(s):
    return s.replace("İ", "i").replace("I", "ı").lower()


def _otomatik(h, adet):
    k = h["kullanici"].lstrip("@")
    sayfa = getir(SYND.format(k=urllib.parse.quote(k)))
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', sayfa, re.S)
    if not m:
        raise ValueError("beklenen veri bulunamadı")
    girdiler = json.loads(m.group(1))["props"]["pageProps"]["timeline"]["entries"]
    if not girdiler:
        raise ValueError("X boş akış döndürdü")
    sonuc, gorulen = [], set()
    for g in girdiler:
        t = (g.get("content") or {}).get("tweet")
        if not t:
            continue
        metin = t.get("full_text") or t.get("text") or ""
        a = (t.get("display_text_range") or [0])[0]
        metin = html.unescape(metin[a:]).strip()
        metin = re.sub(r"\s*https://t\.co/\S+$", "", metin)
        if t["id_str"] in gorulen or (metin.startswith("RT @") and not h.get("retweet_goster")):
            continue
        gorulen.add(t["id_str"])
        medya = ((t.get("extended_entities") or {}).get("media") or [{}])[0].get("media_url_https")
        sonuc.append({
            "kullanici": t.get("user", {}).get("screen_name", k), "ad": t.get("user", {}).get("name", ""),
            "metin": metin, "tarih": parsedate_to_datetime(t["created_at"]).astimezone(timezone.utc).isoformat(),
            "link": f"https://x.com/{k}/status/{t['id_str']}", "gorsel": medya,
        })
    # yalnızca görselden oluşan zincir devamlarını (aynı anda atılmış metinli paylaşımın parçası) ele
    metinli = [datetime.fromisoformat(p["tarih"]) for p in sonuc if p["metin"]]
    sonuc = [p for p in sonuc if p["metin"] or (p["gorsel"] and not any(
        abs((datetime.fromisoformat(p["tarih"]) - z).total_seconds()) < 180 for z in metinli))]
    sonuc.sort(key=lambda p: p["tarih"], reverse=True)
    return sonuc[:adet]


def _rss(h, adet):
    return [{"kullanici": h["kullanici"], "ad": h.get("ad", ""), "metin": o["detay"] or o["baslik"], "tarih": o["tarih"],
             "link": o["link"], "gorsel": o["gorsel"]} for o in rss_oku(h["rss"], adet=adet)]


def _api(h, adet, token):
    b = {"Authorization": f"Bearer {token}"}
    k = h["kullanici"].lstrip("@")
    if k not in _kimlikler:
        _kimlikler[k] = getir_json(f"https://api.x.com/2/users/by/username/{urllib.parse.quote(k)}", basliklar=b)["data"]["id"]
    d = getir_json(f"https://api.x.com/2/users/{_kimlikler[k]}/tweets?max_results={max(5, adet)}"
                   "&exclude=replies,retweets&tweet.fields=created_at", basliklar=b)
    return [{"kullanici": k, "ad": h.get("ad", ""), "metin": t["text"], "tarih": t.get("created_at"),
             "link": f"https://x.com/{k}/status/{t['id']}", "gorsel": None} for t in d.get("data", [])[:adet]]


def veri(ayar):
    mod = ayar.get("mod", "otomatik")
    if mod == "gomulu":
        return {"gomulu": True}
    adet = ayar.get("hesap_basina", 8)
    hesaplar = ayar.get("hesaplar", [])
    token = (ayar.get("gizli") or {}).get("bearer_token", "")
    if mod == "api" and not token:
        return {"paylasimlar": [], "bilgi": "API modu için config.json'da gizli → bearer_token girilmeli."}
    if mod == "rss":
        hesaplar = [h for h in hesaplar if h.get("rss")]
    if not hesaplar:
        return {"paylasimlar": [], "bilgi": "Takip edilecek hesap eklenmedi (config.json → x → hesaplar)."}

    hatalar, hepsi = [], []

    def oku(h):
        try:
            if mod == "api":
                return _api(h, adet, token)
            if mod == "rss":
                return _rss(h, adet)
            return _otomatik(h, adet)
        except Exception as e:
            hatalar.append(h.get("kullanici"))
            print("X hesabı okunamadı:", h.get("kullanici"), e)
            return []

    with ThreadPoolExecutor(max_workers=6) as ex:
        for p in ex.map(oku, hesaplar):
            hepsi.extend(p)

    if not hepsi and mod == "otomatik":
        return {"gomulu": True, "not": "Paylaşımlar doğrudan alınamadı, X'in kendi kutusu gösteriliyor."}

    desenler = ayar.get("uyari_ifadeleri", VARSAYILAN_UYARI)
    sinir = ayar.get("uyari_saat", 24) * 3600
    simdi = datetime.now(timezone.utc)
    for p in hepsi:
        kucuk = _kucuk(p["metin"])
        eslesen = [m for m in (re.search(d, kucuk) for d in desenler) if m]
        yeni = p["tarih"] and (simdi - datetime.fromisoformat(p["tarih"])).total_seconds() < sinir
        if eslesen:  # uyarı şeridi için eşleşen ifadenin çevresini al
            i = min(m.start() for m in eslesen)
            bas, son = max(0, i - 60), min(len(p["metin"]), i + 70)
            p["uyari_parca"] = ("…" if bas else "") + re.sub(r"\s+", " ", p["metin"][bas:son]).strip() + ("…" if son < len(p["metin"]) else "")
        p["uyari"] = bool(eslesen)
        p["uyari_guncel"] = bool(eslesen and yeni)
    hepsi.sort(key=lambda p: p["tarih"] or "", reverse=True)
    return {"paylasimlar": hepsi, "hatalar": hatalar}
