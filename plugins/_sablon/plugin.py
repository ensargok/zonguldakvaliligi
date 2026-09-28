# -*- coding: utf-8 -*-
"""YENİ EKLENTİ ŞABLONU
1) Bu klasörü kopyalayıp yeni bir ad verin (ör. plugins/nobetci_eczane).
2) veri() fonksiyonunda veriyi çekip bir sözlük döndürün.
3) widget.js içinde Pano.eklenti("nobetci_eczane", ...) diye klasör adını yazın.
4) config.json'daki "moduller" listesine {"id": ..., "tur": "nobetci_eczane", ...} ekleyin.
Veriyi internetten çekmeniz gerekmiyorsa bu dosyayı silebilirsiniz (duyuru eklentisi gibi)."""
from datetime import datetime
from ortak import getir, getir_json, rss_oku  # ihtiyaç duyduğunuzu kullanın

YENILEME = 300  # saniye: veri en fazla bu sıklıkla yeniden çekilir


def veri(ayar):
    # ayar = config.json'da bu modülün "ayar" kısmı
    return {"mesaj": ayar.get("mesaj", "Merhaba!"), "saat": datetime.now().strftime("%H:%M:%S")}
