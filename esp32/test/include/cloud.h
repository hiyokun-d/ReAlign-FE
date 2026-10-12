#pragma once
#include <Arduino.h>

// Upload data postur ke server (Next.js /api/ingest -> Supabase) lewat WiFi.
// WiFi, URL server, dan token diatur dari aplikasi lewat BLE (lihat cloud.cpp).

// Panggil sekali di setup(), setelah setupBLE()
void cloudBegin();

// Panggil tiap loop dengan sudut terbaru (derajat dari kalibrasi)
void cloudSample(float back, float neck, float backRoll, bool motor);

// Perintah W..= / WIFI dari HP. true jika perintah ini milik modul cloud.
bool cloudHandleCommand(const String &cmd);

// Panggil tiap loop: kirim baris NET:... ke HP jika status berubah
void cloudPoll();
