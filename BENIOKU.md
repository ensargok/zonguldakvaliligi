# Bilgi Ekranı — web sitesi

Telefon, tablet ve bilgisayardan açılabilen, Mac veya sunucu gerektirmeyen sürüm.
Veriler GitHub'ın ücretsiz sunucularında yaklaşık 10 dakikada bir toplanır, site GitHub Pages'te yayınlanır.

## Nasıl çalışır
- `veri_topla.py` → `config.json`'daki modüller için `plugins/<ad>/plugin.py` dosyalarını çalıştırır,
  sonuçları `docs/veri/` içine yazar.
- `.github/workflows/guncelle.yml` → bunu 10 dakikada bir otomatik çalıştırır.
- `docs/` → web sitesinin kendisi (GitHub Pages bu klasörü yayınlar).

## Ayarları değiştirmek
GitHub'da `config.json` dosyasını açıp kalem simgesiyle düzenleyin, "Commit changes" deyin.
Birkaç dakika içinde site kendiliğinden güncellenir. Kurum adı, duyurular, haber siteleri,
X hesapları, uyarı ifadeleri ve Valilik gibi vurgu bölümleri buradadır.
Hava durumunu tekrar açmak için `hava` modülündeki `"aktif": false` satırını `true` yapın.

## Yeni modül eklemek
1. `plugins/<ad>/plugin.py` → `veri(ayar)` fonksiyonu veriyi çeker ve sözlük döndürür (örnek: `plugins/_sablon`).
2. `docs/plugins/<ad>/widget.js` → `Pano.eklenti("<ad>", { ciz(govde, veri, ayar, durum) {...} })`
3. `docs/plugins/<ad>/widget.css` → isteğe bağlı stil (telefon için `.telefon` ile başlayan kurallar).
4. `config.json`'daki `moduller` listesine ekleyin.
Önemli bir durumu ekranın üstündeki uyarılara göndermek için widget içinde
`Pano.uyari(durum.modul.id, [{ id, seviye: "kirmizi"|"siyah"|"turuncu"|"sari", etiket, baslik, alt, ac }])` kullanın.

## Bilgisayarda denemek
`python3 veri_topla.py` sonra `python3 -m http.server -d docs` ve tarayıcıda http://localhost:8000
