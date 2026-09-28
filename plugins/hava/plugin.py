# -*- coding: utf-8 -*-
"""Hava durumu — Open-Meteo (ücretsiz, anahtar gerektirmez).
ayar: enlem, boylam, yer (ekranda görünecek ad), gun_sayisi (varsayılan 4)"""
from datetime import datetime
from ortak import getir_json

YENILEME = 900  # 15 dakikada bir


def veri(ayar):
    enlem, boylam = ayar.get("enlem", 41.4564), ayar.get("boylam", 31.7987)
    url = ("https://api.open-meteo.com/v1/forecast"
           f"?latitude={enlem}&longitude={boylam}&timezone=Europe%2FIstanbul&forecast_days=6"
           "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day"
           "&hourly=temperature_2m,precipitation_probability,weather_code,is_day"
           "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset")
    d = getir_json(url)
    c, h, g = d["current"], d["hourly"], d["daily"]
    simdi = c["time"][:13]
    bas = next((i for i, t in enumerate(h["time"]) if t[:13] >= simdi), 0) + 1
    saatlik = [{"saat": h["time"][i][11:16], "sicaklik": round(h["temperature_2m"][i]),
                "kod": h["weather_code"][i], "yagis": h["precipitation_probability"][i], "gunduz": h["is_day"][i]}
               for i in range(bas, min(bas + 12, len(h["time"])), 2)]
    gunluk = [{"tarih": g["time"][i], "kod": g["weather_code"][i],
               "en_yuksek": round(g["temperature_2m_max"][i]), "en_dusuk": round(g["temperature_2m_min"][i]),
               "yagis": g["precipitation_probability_max"][i]}
              for i in range(1, min(1 + ayar.get("gun_sayisi", 4), len(g["time"])))]
    return {
        "yer": ayar.get("yer", ""),
        "simdi": {"sicaklik": round(c["temperature_2m"]), "hissedilen": round(c["apparent_temperature"]),
                  "nem": c["relative_humidity_2m"], "ruzgar": round(c["wind_speed_10m"]),
                  "ruzgar_yonu": c["wind_direction_10m"], "kod": c["weather_code"], "gunduz": c["is_day"]},
        "gun_dogumu": g["sunrise"][0][11:16], "gun_batimi": g["sunset"][0][11:16],
        "saatlik": saatlik, "gunluk": gunluk,
    }
