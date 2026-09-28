# -*- coding: utf-8 -*-
"""MGM meteorolojik uyarıları — bölgenizi ilgilendirenleri ayırır.
ayar: kesin_desenler, olasi_desenler, haric_desenler (isteğe bağlı; düzenli ifade listeleri)"""
import html, re
from ortak import getir

YENILEME = 300
LISTE = "https://www.mgm.gov.tr/mobile/tahmin-uyari-liste.aspx"
DETAY = "https://www.mgm.gov.tr/mobile/tahmin-uyari-goster.aspx?sN="

KESIN = [r"batı\s+(ve\s+orta\s+)?karadeniz", r"karadeniz'?in\s+batı", r"zonguldak", r"bartın",
         r"karabük", r"düzce", r"tüm\s+yurt", r"yurt\s+genel", r"ülke\s+genel", r"yurdun\s+tamam"]
OLASI = [r"karadeniz'?de", r"karadeniz\s+bölge", r"karadeniz\s+kıyı", r"tüm\s+karadeniz",
         r"karadeniz\s+genel", r"denizlerimizde\s*\(karadeniz\)", r"kuzey\s+kesim", r"ülkemizin\s+kuzey"]
HARIC = [r"doğu\s+karadeniz"]


def kucuk(s):
    return s.replace("İ", "i").replace("I", "ı").lower()


def veri(ayar):
    kesin = ayar.get("kesin_desenler", KESIN)
    olasi = ayar.get("olasi_desenler", OLASI)
    haric = ayar.get("haric_desenler", HARIC)
    sayfa = getir(LISTE)
    desen = re.compile(r"<li>\s*(\d{2}\.\d{2}\.\d{4})\s*<br\s*/?>\s*<a[^>]*href=\"[^\"]*sN=([^\"&]+)\"[^>]*>(.*?)</a>", re.S | re.I)
    liste = []
    for tarih, sn, baslik in desen.findall(sayfa):
        baslik = html.unescape(re.sub(r"<[^>]+>", "", baslik)).strip()
        b = kucuk(baslik)
        if any(re.search(d, b) for d in kesin):
            e = "kesin"
        elif any(re.search(d, b) for d in olasi) and not any(re.search(d, b) for d in haric):
            e = "olasi"
        else:
            e = None
        liste.append({"id": sn, "tarih": tarih, "baslik": baslik, "url": LISTE, "eslesme": e})
    return {"uyarilar": liste}
