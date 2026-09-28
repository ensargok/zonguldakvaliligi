#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bilgi Ekranı web sitesi — veri toplayıcı
GitHub Actions bunu ~10 dakikada bir çalıştırır:
  config.json'daki her modül için plugins/<tur>/plugin.py içindeki veri() fonksiyonunu çağırır,
  sonucu docs/veri/<modül id>.json dosyasına yazar. Web sitesi (docs/) bu dosyaları okur.
Veri değişmediyse dosyaya dokunmaz; böylece gereksiz güncelleme oluşmaz.
Yerelde denemek için:  python3 veri_topla.py   sonra   python3 -m http.server -d docs"""
import importlib.util, json, os, sys, time, traceback
from datetime import datetime, timezone

KOK = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, KOK)
VERI = os.path.join(KOK, "docs", "veri")



def oku(yol, varsayilan=None):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return varsayilan


def yaz(yol, veri):
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))


def eklenti(tur):
    yol = os.path.join(KOK, "plugins", tur, "plugin.py")
    if not os.path.exists(yol):
        return None
    spec = importlib.util.spec_from_file_location("eklenti_" + tur, yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    os.makedirs(VERI, exist_ok=True)
    cfg = oku(os.path.join(KOK, "config.json"))
    simdi = datetime.now(timezone.utc).isoformat(timespec="seconds")

    # Siteye config'in gizli bilgiler (ör. X API anahtarı) çıkarılmış kopyası konur
    kopya = json.loads(json.dumps(cfg))
    for m in kopya.get("moduller", []):
        (m.get("ayar") or {}).pop("gizli", None)
    yol = os.path.join(KOK, "docs", "config.json")
    if oku(yol) != kopya:
        yaz(yol, kopya)

    hatalar, verili = {}, []
    for m in cfg.get("moduller", []):
        if m.get("aktif") is False:
            continue
        e = eklenti(m["tur"])
        if not e or not hasattr(e, "veri"):
            continue
        verili.append(m["id"])
        dosya = os.path.join(VERI, f"{m['id']}.json")
        eski = oku(dosya, {})
        try:
            t0 = time.time()
            veri = e.veri(m.get("ayar", {}))
            print(f"{m['id']}: tamam ({time.time() - t0:.1f} sn)")
            if veri != eski.get("veri") or eski.get("hata"):
                yaz(dosya, {"zaman": simdi, "veri": veri})
        except Exception as ex:
            traceback.print_exc()
            hatalar[m["id"]] = f"{type(ex).__name__}: {ex}"
            if eski.get("veri") is not None and eski.get("hata") != hatalar[m["id"]]:
                eski["hata"] = hatalar[m["id"]]
                yaz(dosya, eski)

    # son kontrol zamanı her çalışmada yazılır (sitede "güncellendi" saati buradan gelir)
    yaz(os.path.join(VERI, "_durum.json"), {"kontrol": simdi, "moduller": verili, "hatalar": hatalar})
    return 0


if __name__ == "__main__":
    sys.exit(main())
