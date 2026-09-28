# -*- coding: utf-8 -*-
"""Eklentilerin ortak kullandığı yardımcılar: internetten veri çekme ve RSS okuma."""
import html, json, re, urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

TARAYICI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) KurumBilgiEkrani/1.0"


def getir(url, zaman_asimi=20, basliklar=None):
    h = {"User-Agent": TARAYICI}
    h.update(basliklar or {})
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=zaman_asimi) as r:
        return r.read().decode(r.headers.get_content_charset() or "utf-8", errors="ignore")


def getir_json(url, **kw):
    return json.loads(getir(url, **kw))


def temiz_metin(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def _tarih(s):
    if not s:
        return None
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc).isoformat()
    except Exception:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
        except Exception:
            return None


def _uyumlu(baslik, ozet, detay):
    """Bazı siteler beslemede yanlış habere ait içerik gönderebiliyor; içerik başlıkla örtüşmüyorsa kullanma."""
    k = lambda x: x.replace("İ", "i").replace("I", "ı").lower()
    kelimeler = {w for w in re.findall(r"\w{5,}", k(baslik + " " + ozet))}
    if not kelimeler:
        return True
    d = k(detay)
    ortak_sayi = sum(1 for w in kelimeler if w[:6] in d)
    return ortak_sayi >= max(2, len(kelimeler) * 0.25)


def _detay(baslik, aciklama, icerik):
    ozet, detay = temiz_metin(aciklama), temiz_metin(icerik)
    if detay and not _uyumlu(baslik, ozet, detay):
        detay = ""
    if detay and ozet and not detay.startswith(ozet[:40]):
        detay = ozet + " " + detay
    return (detay or ozet)[:1800]


def rss_oku(url, kaynak_adi=None, adet=30):
    """RSS veya Atom beslemesini okur → [{baslik, link, ozet, tarih, gorsel, kaynak}]"""
    ham = getir(url)
    ham = re.sub(r"^\s*<\?xml[^>]*\?>", "", ham)  # kodlama bildirimi ElementTree'yi bozmasın
    kok = ET.fromstring(ham)
    ns = {"atom": "http://www.w3.org/2005/Atom", "media": "http://search.yahoo.com/mrss/",
          "content": "http://purl.org/rss/1.0/modules/content/"}
    ogeler = kok.findall(".//item") or kok.findall(".//atom:entry", ns)
    kanal = kaynak_adi or temiz_metin((kok.findtext("channel/title") or kok.findtext("atom:title", "", ns) or ""))
    sonuc = []
    for o in ogeler[:adet]:
        baslik = temiz_metin(o.findtext("title") or o.findtext("atom:title", "", ns))
        link = o.findtext("link") or ""
        if not link:
            l = o.find("atom:link", ns)
            link = l.get("href") if l is not None else ""
        aciklama = o.findtext("description") or o.findtext("atom:summary", "", ns) or ""
        icerik = o.findtext("content:encoded", "", ns) or o.findtext("atom:content", "", ns) or ""
        gorsel = None
        enc = o.find("enclosure")
        if enc is not None and "image" in (enc.get("type") or "image"):
            gorsel = enc.get("url")
        if not gorsel:
            m = o.find("media:content", ns)
            if m is None:
                m = o.find("media:thumbnail", ns)
            if m is not None:
                gorsel = m.get("url")
        if not gorsel:
            m = re.search(r"<img[^>]+src=[\"']([^\"']+)", aciklama + icerik)
            gorsel = m.group(1) if m else None
        sonuc.append({
            "baslik": baslik, "link": link.strip(), "ozet": temiz_metin(aciklama)[:280],
            "detay": _detay(baslik, aciklama, icerik),
            "tarih": _tarih(o.findtext("pubDate") or o.findtext("atom:updated", "", ns) or o.findtext("atom:published", "", ns)),
            "gorsel": gorsel, "kaynak": kanal,
        })
    return sonuc
