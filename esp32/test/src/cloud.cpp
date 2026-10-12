#include "cloud.h"
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

// Didefinisikan di main.cpp. Hanya dipanggil dari task loop() supaya
// notifikasi BLE tidak saling tumpang tindih dengan data sensor.
void logMsg(const String &msg);

// ── Pengaturan dari HP lewat BLE ────────────────────────────────────────────
// Satu tulisan BLE maksimal 20 byte, jadi nilai panjang dikirim bertahap:
//   WS=<awal>  WS+<lanjutan>   nama WiFi (SSID)
//   WP=...     WP+...          password WiFi
//   WU=...     WU+...          URL server, mis. https://app.vercel.app/api/ingest
//   WT=...     WT+...          token perangkat (dari /api/device-token)
//   WIFI                       simpan ke flash lalu sambungkan
//   WIFI?                      laporkan status sekarang
//   WIFIOFF                    hapus pengaturan WiFi
//
// Status dikirim ke HP (lihat app/lib/esp32/ble.ts):
//   NET:OFF | NET:CONNECTING | NET:OK <ip> | NET:FAIL wifi | NET:FAIL http <kode>

struct NetConfig
{
  String ssid, pass, url, token;
};
static NetConfig draft; // sedang diisi dari BLE (hanya task loop)

enum NetState
{
  NET_OFF,
  NET_CONNECTING,
  NET_OK,
  NET_WIFI_FAIL,
  NET_HTTP_FAIL
};
static volatile NetState netState = NET_OFF;
static volatile int httpCode = 0;
static volatile bool reloadConfig = true;
static String reported = "";
static bool forceReport = false;

// ── Rata-rata per menit (sama seperti app/lib/esp32/aggregate.ts) ──────────
struct Minute
{
  uint32_t start; // detik unix awal menit
  float back, neck;
  uint8_t score;
  uint16_t slouchSec;
};
static QueueHandle_t minuteQueue = nullptr;

static uint32_t curBucket = 0;
static int n = 0;
static float sumBack = 0, sumNeck = 0, sumScore = 0;
static unsigned long slouchMs = 0, lastMs = 0;
static bool motorWas = false;
const unsigned long MAX_GAP_MS = 1000;

// Skor 0-100, makin tinggi makin baik (sama dengan lib/posture.ts)
static float scoreFromAngles(float pitch, float roll)
{
  float s = 100 - fabsf(pitch) * 1.8f - fabsf(roll) * 2;
  return roundf(constrain(s, 0, 100));
}

static bool clockReady()
{
  return time(nullptr) > 1700000000; // sudah dapat jam dari NTP
}

void cloudSample(float back, float neck, float backRoll, bool motor)
{
  if (!minuteQueue || !clockReady())
    return; // tanpa jam, menit tidak bisa diberi waktu

  uint32_t bucket = time(nullptr) / 60;
  if (bucket != curBucket && n > 0)
  {
    Minute m = {curBucket * 60, sumBack / n, sumNeck / n, (uint8_t)roundf(sumScore / n), (uint16_t)(slouchMs / 1000)};
    xQueueSend(minuteQueue, &m, 0); // antrean penuh = menit dibuang
    n = 0;
    sumBack = sumNeck = sumScore = 0;
    slouchMs = 0;
  }
  curBucket = bucket;

  n++;
  sumBack += back;
  sumNeck += neck;
  sumScore += scoreFromAngles(back, backRoll);
  // Waktu bungkuk = lama motor bergetar
  unsigned long ms = millis();
  if (motorWas && lastMs)
    slouchMs += min(ms - lastMs, MAX_GAP_MS);
  motorWas = motor;
  lastMs = ms;
}

// ── Task upload (core 0, supaya loop sensor tidak tertahan oleh HTTP) ──────
const int BUF_MINUTES = 180; // simpan 3 jam saat offline
const int MAX_PER_POST = 30;
const unsigned long RETRY_MS = 15000;

struct Pending
{
  Minute m;
  char id[37];
};
static Pending pending[BUF_MINUTES];
static int pendingCount = 0;

static void uuid(char *out)
{
  uint8_t b[16];
  for (int i = 0; i < 16; i += 4)
  {
    uint32_t r = esp_random();
    memcpy(b + i, &r, 4);
  }
  b[6] = (b[6] & 0x0F) | 0x40; // versi 4
  b[8] = (b[8] & 0x3F) | 0x80;
  sprintf(out, "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
          b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]);
}

static String iso(uint32_t t)
{
  time_t tt = t;
  struct tm tm;
  gmtime_r(&tt, &tm);
  char s[25];
  strftime(s, sizeof s, "%Y-%m-%dT%H:%M:%SZ", &tm);
  return String(s);
}

static const char *statusOf(uint8_t score)
{
  return score >= 75 ? "good" : score >= 50 ? "warning" : "bad";
}

static void loadConfig(NetConfig &cfg)
{
  Preferences p;
  p.begin("net", true);
  cfg.ssid = p.getString("ssid", "");
  cfg.pass = p.getString("pass", "");
  cfg.url = p.getString("url", "");
  cfg.token = p.getString("token", "");
  p.end();
}

// Kirim sampai MAX_PER_POST menit tertua. Mengembalikan kode HTTP.
static int upload(const NetConfig &cfg, const char *sessionId, uint32_t sessionStart, uint32_t slouchTotal)
{
  int count = min(pendingCount, MAX_PER_POST);
  uint32_t lastEnd = pending[pendingCount - 1].m.start + 60;

  String body;
  body.reserve(200 + count * 190);
  body += "{\"session\":{\"id\":\"" + String(sessionId) + "\",\"started_at\":\"" + iso(sessionStart) +
          "\",\"ended_at\":\"" + iso(lastEnd) + "\",\"total_slouch_seconds\":" + String(slouchTotal) + "},\"readings\":[";
  for (int i = 0; i < count; i++)
  {
    const Pending &p = pending[i];
    if (i)
      body += ",";
    body += "{\"id\":\"" + String(p.id) + "\",\"timestamp\":\"" + iso(p.m.start) +
            "\",\"avg_pitch_punggung\":" + String(p.m.back, 1) + ",\"avg_pitch_leher\":" + String(p.m.neck, 1) +
            ",\"slouch_score\":" + String(p.m.score) + ",\"status\":\"" + statusOf(p.m.score) + "\"}";
  }
  body += "]}";

  HTTPClient http;
  WiFiClientSecure secure;
  WiFiClient plain;
  if (cfg.url.startsWith("https://"))
  {
    secure.setInsecure(); // PROTOTIPE: sertifikat server tidak diperiksa
    http.begin(secure, cfg.url);
  }
  else
  {
    http.begin(plain, cfg.url); // untuk tes di jaringan lokal (http://192.168.x.x:3000)
  }
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + cfg.token);
  int code = http.POST(body);
  http.end();

  if (code >= 200 && code < 300)
  {
    memmove(pending, pending + count, (pendingCount - count) * sizeof(Pending));
    pendingCount -= count;
  }
  return code;
}

static void uploadTask(void *)
{
  NetConfig cfg;
  char sessionId[37];
  uuid(sessionId); // satu sesi per nyala
  uint32_t sessionStart = 0;
  uint32_t slouchTotal = 0;
  unsigned long connectStarted = 0, lastTry = 0;

  for (;;)
  {
    if (reloadConfig)
    {
      reloadConfig = false;
      loadConfig(cfg);
      WiFi.disconnect(true);
      if (cfg.ssid.length() && cfg.url.length() && cfg.token.length())
      {
        WiFi.mode(WIFI_STA);
        WiFi.begin(cfg.ssid.c_str(), cfg.pass.c_str());
        configTime(0, 0, "pool.ntp.org", "time.google.com");
        connectStarted = millis();
        lastTry = 0;
        netState = NET_CONNECTING;
      }
      else
      {
        netState = NET_OFF;
      }
    }

    Minute m;
    while (xQueueReceive(minuteQueue, &m, 0) == pdTRUE)
    {
      if (pendingCount == BUF_MINUTES) // penuh: buang yang paling lama
      {
        memmove(pending, pending + 1, (BUF_MINUTES - 1) * sizeof(Pending));
        pendingCount--;
      }
      pending[pendingCount].m = m;
      uuid(pending[pendingCount].id);
      pendingCount++;
      if (!sessionStart)
        sessionStart = m.start;
      slouchTotal += m.slouchSec;
    }

    if (netState == NET_OFF)
    {
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    if (WiFi.status() != WL_CONNECTED || !clockReady())
    {
      // WiFi menyambung ulang sendiri; tandai gagal jika terlalu lama
      if (millis() - connectStarted > 20000)
        netState = NET_WIFI_FAIL;
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }
    if (netState == NET_CONNECTING || netState == NET_WIFI_FAIL)
      netState = NET_OK;

    if (pendingCount > 0 && (lastTry == 0 || millis() - lastTry > (netState == NET_OK ? 0 : RETRY_MS)))
    {
      lastTry = millis();
      int code = upload(cfg, sessionId, sessionStart, slouchTotal);
      httpCode = code;
      netState = (code >= 200 && code < 300) ? NET_OK : NET_HTTP_FAIL;
    }
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}

void cloudBegin()
{
  minuteQueue = xQueueCreate(10, sizeof(Minute));
  xTaskCreatePinnedToCore(uploadTask, "cloud", 12288, nullptr, 1, nullptr, 0);
}

// ── Perintah & status ──────────────────────────────────────────────────────
static String *fieldFor(char key)
{
  switch (key)
  {
  case 'S':
    return &draft.ssid;
  case 'P':
    return &draft.pass;
  case 'U':
    return &draft.url;
  case 'T':
    return &draft.token;
  }
  return nullptr;
}

bool cloudHandleCommand(const String &raw)
{
  // Jangan trim/uppercase: SSID dan password peka huruf besar-kecil dan spasi
  String cmd = raw;
  while (cmd.endsWith("\n") || cmd.endsWith("\r"))
    cmd.remove(cmd.length() - 1);

  if (cmd.length() >= 3 && cmd[0] == 'W' && (cmd[2] == '=' || cmd[2] == '+'))
  {
    String *field = fieldFor(cmd[1]);
    if (!field)
      return false;
    if (cmd[2] == '=')
      *field = "";
    *field += cmd.substring(3);
    return true;
  }

  String upper = cmd;
  upper.trim();
  upper.toUpperCase();
  if (upper == "WIFI")
  {
    if (!draft.ssid.length() || !draft.url.length() || !draft.token.length())
    {
      logMsg("ERR: kirim WS=, WU=, WT= dulu");
      return true;
    }
    Preferences p;
    p.begin("net", false);
    p.putString("ssid", draft.ssid);
    p.putString("pass", draft.pass);
    p.putString("url", draft.url);
    p.putString("token", draft.token);
    p.end();
    draft = NetConfig();
    reloadConfig = true;
    reported = ""; // laporkan status baru walau sama
    logMsg("WiFi tersimpan, menyambung...");
    return true;
  }
  if (upper == "WIFI?")
  {
    forceReport = true;
    return true;
  }
  if (upper == "WIFIOFF")
  {
    Preferences p;
    p.begin("net", false);
    p.clear();
    p.end();
    reloadConfig = true;
    logMsg("WiFi dihapus");
    return true;
  }
  return false;
}

void cloudPoll()
{
  String line;
  switch (netState)
  {
  case NET_OFF:
    line = "NET:OFF";
    break;
  case NET_CONNECTING:
    line = "NET:CONNECTING";
    break;
  case NET_OK:
    line = "NET:OK " + WiFi.localIP().toString();
    break;
  case NET_WIFI_FAIL:
    line = "NET:FAIL wifi";
    break;
  case NET_HTTP_FAIL:
    line = "NET:FAIL http " + String(httpCode);
    break;
  }
  if (line != reported || forceReport)
  {
    reported = line;
    forceReport = false;
    logMsg(line);
  }
}
