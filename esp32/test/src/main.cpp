#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

// Objek untuk dua sensor MPU6050
Adafruit_MPU6050 mpu1; // Sensor 1 (Punggung) -> Alamat I2C: 0x68
Adafruit_MPU6050 mpu2; // Sensor 2 (Leher)    -> Alamat I2C: 0x69

// Pin output
const int buzzerPin = 18;   // Buzzer: peringatan postur (default MATI, nyalakan dengan ON)
const int ledRedPin = 4;    // LED merah: belum tersambung Bluetooth
const int ledGreenPin = 23; // LED hijau: tersambung Bluetooth

// Buzzer aktif (berbunyi cukup dengan HIGH). Jika buzzer pasif, ubah jadi true (pakai tone()).
const bool BUZZER_PASSIVE = false;
const int BUZZER_TONE_HZ = 2000;
// Pola bunyi saat bungkuk: 200 ms bunyi, 800 ms diam
const unsigned long BEEP_PERIOD_MS = 1000;
const unsigned long BEEP_ON_MS = 200;

// Variabel untuk menyimpan sudut kemiringan saat ini
// pitch = condong depan/belakang, roll = miring kiri/kanan (keduanya dari gravitasi)
float pitch1 = 0;
float pitch2 = 0;
float roll1 = 0;
float roll2 = 0;

// Vektor akselerasi yang dihaluskan (low-pass) supaya sudut tidak bergetar
struct Vec3
{
  float x, y, z;
};
Vec3 acc1 = {0, 0, 0};
Vec3 acc2 = {0, 0, 0};
bool accReady = false;
const float ACC_SMOOTH = 0.35; // 0..1, makin kecil makin halus tapi makin lambat

// Jeda loop: 50 ms = 20 data per detik (cukup halus untuk game)
const int LOOP_MS = 50;

// Variabel kalibrasi (Titik nol derajat = posisi duduk tegak pengguna)
// Disimpan di flash (NVS) supaya tidak hilang saat ESP32 restart.
float baselinePitch1 = 0;
float baselinePitch2 = 0;
float baselineRoll1 = 0;
float baselineRoll2 = 0;
bool hasBaseline = false;
Preferences prefs;

// Arah "maju" tiap sensor (+1 atau -1), tergantung cara chip dipasang.
// Diatur lewat perintah FWD (condong ke depan lalu kirim), disimpan di flash.
int dir1 = 1;
int dir2 = 1;
const float FWD_MIN_ANGLE = 15.0; // harus condong minimal segini saat FWD
// Arah "kanan" untuk roll, diatur lewat perintah RGT (miring ke kanan lalu kirim)
int rdir1 = 1;
int rdir2 = 1;
const float RGT_MIN_ANGLE = 10.0;

// Kalibrasi ditolak jika sudut bergoyang lebih dari ini selama pengambilan sampel
const float CAL_MAX_WOBBLE = 5.0;
const int CAL_SAMPLES = 50;       // 50 sampel x 50 ms = 2.5 detik
const int CAL_DEFAULT_WAIT = 5;   // hitung mundur sebelum sampling (detik)

// Ambang batas kemiringan dan timer untuk getaran (bisa diubah lewat BLE)
float slouchThreshold = 20.0;             // Jika miring lebih dari 20 derajat dari posisi tegak
unsigned long slouchDurationLimit = 3000; // Harus bungkuk selama 3 detik baru bergetar
unsigned long slouchStartTime = 0;
bool isSlouching = false;
// Histeresis: sudah bungkuk dianggap selesai hanya jika di bawah (ambang - ini),
// supaya getaran kecil di sekitar ambang tidak mereset timer bungkuk.
const float SLOUCH_HYSTERESIS = 3.0;
// alertActive = sedang bungkuk melewati batas waktu (dikirim ke aplikasi, selalu dihitung).
// buzzerEnabled = buzzer boleh bunyi atau tidak. Default MATI; nyalakan dengan perintah ON.
bool alertActive = false;
bool buzzerEnabled = true;
bool buzzerOn = false;
unsigned long alertStartTime = 0; // pola bunyi dimulai dari sini, jadi beep pertama langsung
unsigned long buzzTestUntil = 0; // perintah BUZZ: bunyi tes sampai waktu ini

// --- BLE: Nordic UART Service (NUS) ---
// Didukung oleh aplikasi: Adafruit Bluefruit Connect, Serial Bluetooth Terminal, nRF Connect
#define DEVICE_NAME "PostureMonitor"
#define NUS_SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E" // HP -> ESP32 (perintah)
#define NUS_TX_UUID "6E400003-B5A3-F393-E0A9-E50E24DCCA9E" // ESP32 -> HP (data)

BLEServer *bleServer = nullptr;
BLECharacteristic *txChar = nullptr;
bool bleConnected = false;

// Beberapa HP/laptop boleh tersambung sekaligus, supaya operator selalu bisa masuk
// lalu memutus yang lain dengan perintah KICK. Data dikirim ke semua yang tersambung.
const int MAX_PEERS = 3;
const uint16_t NO_PEER = 0xFFFF;
volatile uint16_t peerIds[MAX_PEERS] = {NO_PEER, NO_PEER, NO_PEER};
volatile int peerCount = 0;
int reportedPeers = -1;
portMUX_TYPE peerMux = portMUX_INITIALIZER_UNLOCKED;

// Perintah dari HP masuk antrean lalu diproses di loop()
// (jangan proses di callback BLE karena kalibrasi memakai delay).
// Antrean, bukan satu variabel: beberapa perintah bisa datang beruntun dengan cepat.
struct CmdItem
{
  char text[64];
  uint16_t from; // conn_id pengirim (untuk KICK)
};
uint16_t cmdFrom = NO_PEER; // pengirim perintah yang sedang diproses
QueueHandle_t cmdQueue = nullptr;

bool calibrateSensors(int countdownSec, bool force);
void setAlert(bool on);
void updateBuzzer();
void updateLeds();
void setLeds(bool red, bool green);
void blinkErrorForever();
void loadBaseline();
void saveBaseline();
void setForward();
void setRight();
void readSensors();
float rawPitch(const sensors_event_t &a);
float rawRoll(const sensors_event_t &a);
float pitchOf(const Vec3 &v);
float rollOf(const Vec3 &v);
float wrap180(float deg);
void bleSend(const String &msg);
void logMsg(const String &msg);
void handleCommand(String cmd);

class ServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) override
  {
    portENTER_CRITICAL(&peerMux);
    for (int i = 0; i < MAX_PEERS; i++)
    {
      if (peerIds[i] == NO_PEER)
      {
        peerIds[i] = param->connect.conn_id;
        peerCount++;
        break;
      }
    }
    int count = peerCount;
    portEXIT_CRITICAL(&peerMux);
    bleConnected = true;
    // Tetap beriklan supaya perangkat lain (operator) masih bisa masuk
    if (count < MAX_PEERS)
      BLEDevice::startAdvertising();
  }
  void onDisconnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) override
  {
    portENTER_CRITICAL(&peerMux);
    for (int i = 0; i < MAX_PEERS; i++)
    {
      if (peerIds[i] == param->disconnect.conn_id)
      {
        peerIds[i] = NO_PEER;
        peerCount--;
        break;
      }
    }
    bleConnected = peerCount > 0;
    portEXIT_CRITICAL(&peerMux);
  }
};

// Putus semua koneksi BLE kecuali pengirim perintah
void kickOthers(uint16_t keep)
{
  uint16_t ids[MAX_PEERS];
  portENTER_CRITICAL(&peerMux);
  for (int i = 0; i < MAX_PEERS; i++)
    ids[i] = peerIds[i];
  portEXIT_CRITICAL(&peerMux);
  int kicked = 0;
  for (int i = 0; i < MAX_PEERS; i++)
  {
    if (ids[i] != NO_PEER && ids[i] != keep)
    {
      bleServer->disconnect(ids[i]);
      kicked++;
    }
  }
  logMsg("KICK:" + String(kicked));
}

class RxCallbacks : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *chr, esp_ble_gatts_cb_param_t *param) override
  {
    CmdItem item = {};
    strncpy(item.text, chr->getValue().c_str(), sizeof(item.text) - 1);
    item.from = param->write.conn_id;
    xQueueSend(cmdQueue, &item, 0); // antrean penuh = perintah dibuang
  }
};

void setupBLE()
{
  BLEDevice::init(DEVICE_NAME);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService *service = bleServer->createService(NUS_SERVICE_UUID);

  txChar = service->createCharacteristic(NUS_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());

  BLECharacteristic *rxChar = service->createCharacteristic(
      NUS_RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rxChar->setCallbacks(new RxCallbacks());

  service->start();

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(NUS_SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  Serial.println("BLE aktif, nama: " DEVICE_NAME);
}

// Kirim teks ke HP (dipotong per 20 byte agar aman untuk MTU default)
void bleSend(const String &msg)
{
  if (!bleConnected)
    return;
  const size_t chunk = 20;
  for (size_t i = 0; i < msg.length(); i += chunk)
  {
    String part = msg.substring(i, i + chunk);
    txChar->setValue((uint8_t *)part.c_str(), part.length());
    txChar->notify();
    delay(5);
  }
}

// Log ke Serial Monitor dan HP sekaligus
void logMsg(const String &msg)
{
  Serial.println(msg);
  bleSend(msg + "\n");
}

void setup()
{
  Serial.begin(115200);
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);
  pinMode(ledRedPin, OUTPUT);
  pinMode(ledGreenPin, OUTPUT);
  setLeds(true, true); // tes LED saat nyala
  delay(300);
  setLeds(true, false);

  Wire.begin();
  Wire.setClock(100000); // Menjaga kestabilan I2C

  cmdQueue = xQueueCreate(24, sizeof(CmdItem));
  setupBLE();

  Serial.println("Memulai Inisialisasi Sensor...");

  // 1. Inisialisasi Sensor Punggung (0x68)
  if (!mpu1.begin(0x68))
  {
    Serial.println("GAGAL: Sensor Punggung (0x68) tidak ditemukan!");
    blinkErrorForever();
  }
  Serial.println("OK: Sensor Punggung Ditemukan!");

  // 2. Inisialisasi Sensor Leher (0x69)
  if (!mpu2.begin(0x69))
  {
    Serial.println("GAGAL: Sensor Leher (0x69) tidak ditemukan!");
    blinkErrorForever();
  }
  Serial.println("OK: Sensor Leher Ditemukan!");

  mpu1.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu2.setAccelerometerRange(MPU6050_RANGE_2_G);

  loadBaseline();
  if (hasBaseline)
  {
    Serial.println("Pakai kalibrasi tersimpan: Punggung " + String(baselinePitch1, 1) +
                   " | Leher " + String(baselinePitch2, 1) + " (kirim CAL untuk ulang)");
  }
  else
  {
    // Belum pernah kalibrasi: coba 3x, kalau tetap bergerak terima saja
    Serial.println("Belum ada kalibrasi. Silakan duduk dengan TEGAK SEMPURNA...");
    for (int attempt = 1; attempt <= 3; attempt++)
    {
      if (calibrateSensors(CAL_DEFAULT_WAIT, attempt == 3))
        break;
    }
  }
}

// ── Peringatan postur & buzzer ──────────────────────────────────────────────
void setAlert(bool on)
{
  if (on && !alertActive)
    alertStartTime = millis();
  alertActive = on;
  updateBuzzer();
}

void writeBuzzer(bool on)
{
  if (on == buzzerOn)
    return;
  buzzerOn = on;
  if (BUZZER_PASSIVE)
  {
    if (on)
      tone(buzzerPin, BUZZER_TONE_HZ);
    else
      noTone(buzzerPin);
  }
  else
  {
    digitalWrite(buzzerPin, on ? HIGH : LOW);
  }
}

// Dipanggil tiap loop: bunyi berpola saat bungkuk (jika diaktifkan), atau bunyi tes BUZZ
void updateBuzzer()
{
  unsigned long now = millis();
  bool testing = (long)(buzzTestUntil - now) > 0;
  bool beeping = buzzerEnabled && alertActive && ((now - alertStartTime) % BEEP_PERIOD_MS) < BEEP_ON_MS;
  writeBuzzer(testing || beeping);
}

// ── LED status Bluetooth ────────────────────────────────────────────────────
//   merah berkedip pelan  = menunggu HP/laptop tersambung
//   hijau menyala         = tersambung
//   merah + hijau menyala = sedang kalibrasi
//   merah berkedip cepat  = sensor MPU6050 tidak ditemukan (cek kabel)
void setLeds(bool red, bool green)
{
  digitalWrite(ledRedPin, red ? HIGH : LOW);
  digitalWrite(ledGreenPin, green ? HIGH : LOW);
}

void updateLeds()
{
  if (peerCount > 0)
    setLeds(false, true);
  else
    setLeds((millis() / 500) % 2 == 0, false);
}

void blinkErrorForever()
{
  writeBuzzer(false);
  while (1)
  {
    setLeds(true, false);
    delay(100);
    setLeds(false, false);
    delay(100);
  }
}

// Daftar perintah dari HP (kirim sebagai teks):
//   CAL      -> kalibrasi ulang: hitung mundur 5 detik, lalu tahan diam 2.5 detik
//   CAL=0..10-> sama, dengan hitung mundur n detik (CAL=0 = langsung ambil posisi sekarang)
//   FWD      -> condongkan badan + kepala ke DEPAN lalu kirim: arah maju jadi positif
//   RGT      -> miringkan badan + kepala ke KANAN lalu kirim: miring kanan jadi positif
//   T=25     -> ubah ambang batas sudut (derajat)
//   D=5000   -> ubah durasi bungkuk sebelum getar (ms)
//   ON / OFF -> nyalakan / matikan buzzer peringatan (default MATI)
//   BUZZ     -> tes buzzer 0.5 detik (bunyi walau buzzer dimatikan)
//   STATUS   -> tampilkan pengaturan saat ini
//   KICK     -> putuskan semua HP/laptop lain yang tersambung (selain pengirim)
// Semua perintah juga bisa diketik di Serial Monitor (lewat kabel USB).
void handleCommand(String cmd)
{
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0)
    return;

  if (cmd == "CAL")
  {
    calibrateSensors(CAL_DEFAULT_WAIT, false);
  }
  else if (cmd.startsWith("CAL="))
  {
    long v = cmd.substring(4).toInt();
    if (v >= 0 && v <= 10)
      calibrateSensors(v, false);
    else
      logMsg("ERR: CAL harus 0-10");
  }
  else if (cmd == "FWD")
  {
    setForward();
  }
  else if (cmd == "RGT")
  {
    setRight();
  }
  else if (cmd.startsWith("T="))
  {
    float v = cmd.substring(2).toFloat();
    if (v > 0 && v < 90)
    {
      slouchThreshold = v;
      logMsg("Ambang: " + String(slouchThreshold, 1) + " deg");
    }
    else
    {
      logMsg("ERR: T harus 1-89");
    }
  }
  else if (cmd.startsWith("D="))
  {
    long v = cmd.substring(2).toInt();
    if (v >= 0 && v <= 60000)
    {
      slouchDurationLimit = v;
      logMsg("Durasi: " + String(slouchDurationLimit) + " ms");
    }
    else
    {
      logMsg("ERR: D harus 0-60000");
    }
  }
  else if (cmd == "ON")
  {
    buzzerEnabled = true;
    logMsg("Buzzer: ON");
  }
  else if (cmd == "OFF")
  {
    buzzerEnabled = false;
    updateBuzzer();
    logMsg("Buzzer: OFF");
  }
  else if (cmd == "BUZZ")
  {
    buzzTestUntil = millis() + 500; // tanpa delay, loop jalan terus
    updateBuzzer();
    logMsg("Tes buzzer");
  }
  else if (cmd == "KICK")
  {
    kickOthers(cmdFrom);
  }
  else if (cmd == "STATUS")
  {
    logMsg("T=" + String(slouchThreshold, 1) + " D=" + String(slouchDurationLimit) +
           " Buzzer=" + (buzzerEnabled ? "ON" : "OFF") +
           " Nol=" + String(baselinePitch1, 1) + "," + String(baselinePitch2, 1) +
           " Arah=" + String(dir1) + "," + String(dir2) +
           " ArahR=" + String(rdir1) + "," + String(rdir2));
  }
  else
  {
    logMsg("Perintah: CAL, CAL=n, FWD, RGT, T=, D=, ON, OFF, BUZZ, STATUS, KICK");
  }
}

void loop()
{
  // Jumlah HP/laptop tersambung berubah: laporkan (PEERS:n) dan iklan ulang
  // jika ada slot kosong, supaya bisa tersambung lagi
  int peers = peerCount;
  if (peers != reportedPeers)
  {
    if (peers < reportedPeers && peers < MAX_PEERS)
    {
      delay(300);
      BLEDevice::startAdvertising();
      Serial.println("BLE terputus, iklan ulang...");
    }
    if (peers > reportedPeers && reportedPeers >= 0)
      Serial.println("BLE tersambung!");
    reportedPeers = peers;
    logMsg("PEERS:" + String(peers));
  }

  CmdItem item;
  while (xQueueReceive(cmdQueue, &item, 0) == pdTRUE)
  {
    cmdFrom = item.from;
    handleCommand(String(item.text));
  }

  // Perintah juga bisa lewat kabel USB (Serial Monitor, 115200, akhiri dengan Enter).
  // Berguna saat BLE bermasalah, mis. kirim STATUS atau KICK.
  static String serialLine;
  while (Serial.available())
  {
    char c = Serial.read();
    if (c == '\n' || c == '\r')
    {
      if (serialLine.length())
      {
        cmdFrom = NO_PEER;
        handleCommand(serialLine);
        serialLine = "";
      }
    }
    else if (serialLine.length() < 63)
    {
      serialLine += c;
    }
  }

  readSensors();

  // --- RUMUS UNTUK POSISI VERTIKAL ---
  // Selisih sudut saat ini dikurangi titik acuan (baseline saat kalibrasi).
  // wrap180 mencegah lompatan 360 derajat jika sudut mentah dekat +/-180.
  // dir / rdir membuat condong ke depan dan miring ke kanan selalu positif.
  pitch1 = dir1 * wrap180(pitchOf(acc1) - baselinePitch1);
  pitch2 = dir2 * wrap180(pitchOf(acc2) - baselinePitch2);
  roll1 = rdir1 * (rollOf(acc1) - baselineRoll1);
  roll2 = rdir2 * (rollOf(acc2) - baselineRoll2);

  // Cetak ke Serial Monitor untuk memantau nilai
  Serial.printf("Punggung: %.1f / %.1f | Leher: %.1f / %.1f\n", pitch1, roll1, pitch2, roll2);

  // --- LOGIKA PENGECEKAN BUNGKUK ---
  // Total kemiringan (depan/belakang + kiri/kanan) dibanding ambang batas
  float tilt1 = sqrtf(pitch1 * pitch1 + roll1 * roll1);
  float tilt2 = sqrtf(pitch2 * pitch2 + roll2 * roll2);
  // Mulai bungkuk saat melewati ambang; tetap bungkuk sampai turun di bawah (ambang - histeresis)
  float limit = isSlouching ? slouchThreshold - SLOUCH_HYSTERESIS : slouchThreshold;
  if (tilt1 > limit || tilt2 > limit)
  {
    if (!isSlouching)
    {
      slouchStartTime = millis();
      isSlouching = true;
    }
    else
    {
      // Peringatan selalu dihitung (untuk data di aplikasi); buzzer hanya bunyi jika ON
      if (!alertActive && millis() - slouchStartTime > slouchDurationLimit)
      {
        logMsg("PERINGATAN: Postur memburuk!");
        setAlert(true);
      }
    }
  }
  else
  {
    isSlouching = false;
    setAlert(false);
  }
  updateBuzzer();
  updateLeds();

  // Kirim data ke HP format CSV: punggung,leher,peringatan,rollPunggung,rollLeher
  // (kolom ke-3 = 1 saat peringatan bungkuk aktif, walau buzzer dimatikan)
  // (format ini langsung bisa digambar di menu Plotter aplikasi Bluefruit Connect)
  bleSend(String(pitch1, 1) + "," + String(pitch2, 1) + "," + String(alertActive ? 1 : 0) + "," +
          String(roll1, 1) + "," + String(roll2, 1) + "\n");

  delay(LOOP_MS);
}

// Baca kedua sensor dan haluskan vektor akselerasinya
void readSensors()
{
  sensors_event_t a1, g1, temp1;
  sensors_event_t a2, g2, temp2;
  mpu1.getEvent(&a1, &g1, &temp1);
  mpu2.getEvent(&a2, &g2, &temp2);
  Vec3 n1 = {a1.acceleration.x, a1.acceleration.y, a1.acceleration.z};
  Vec3 n2 = {a2.acceleration.x, a2.acceleration.y, a2.acceleration.z};
  float k = accReady ? ACC_SMOOTH : 1.0;
  acc1 = {acc1.x + (n1.x - acc1.x) * k, acc1.y + (n1.y - acc1.y) * k, acc1.z + (n1.z - acc1.z) * k};
  acc2 = {acc2.x + (n2.x - acc2.x) * k, acc2.y + (n2.y - acc2.y) * k, acc2.z + (n2.z - acc2.z) * k};
  accReady = true;
}

float pitchOf(const Vec3 &v)
{
  return atan2(v.z, v.y) * 180 / PI;
}

// Roll: seberapa banyak gravitasi masuk ke sumbu X chip (-90..90, 0 saat tegak)
float rollOf(const Vec3 &v)
{
  return atan2(v.x, sqrtf(v.y * v.y + v.z * v.z)) * 180 / PI;
}

float rawRoll(const sensors_event_t &a)
{
  return rollOf({a.acceleration.x, a.acceleration.y, a.acceleration.z});
}

// Sudut mentah (derajat) dari arah gravitasi pada sumbu Z dan Y chip
float rawPitch(const sensors_event_t &a)
{
  return atan2(a.acceleration.z, a.acceleration.y) * 180 / PI;
}

// Ubah sudut ke rentang -180..180
float wrap180(float deg)
{
  while (deg > 180)
    deg -= 360;
  while (deg < -180)
    deg += 360;
  return deg;
}

void loadBaseline()
{
  prefs.begin("posture", false);
  hasBaseline = prefs.getBool("cal", false);
  baselinePitch1 = prefs.getFloat("b1", 0);
  baselinePitch2 = prefs.getFloat("b2", 0);
  baselineRoll1 = prefs.getFloat("r1", 0);
  baselineRoll2 = prefs.getFloat("r2", 0);
  dir1 = prefs.getInt("d1", 1);
  dir2 = prefs.getInt("d2", 1);
  rdir1 = prefs.getInt("rd1", 1);
  rdir2 = prefs.getInt("rd2", 1);
  prefs.end();
}

void saveBaseline()
{
  prefs.begin("posture", false);
  prefs.putFloat("b1", baselinePitch1);
  prefs.putFloat("b2", baselinePitch2);
  prefs.putFloat("r1", baselineRoll1);
  prefs.putFloat("r2", baselineRoll2);
  prefs.putBool("cal", true);
  prefs.end();
}

// Pengguna sedang condong ke depan: catat tanda sudut tiap sensor sebagai "maju".
//   DIR:OK p,l     arah baru tersimpan (+1/-1 untuk punggung, leher)
//   DIR:FAIL x     kurang condong (x derajat), arah lama dipakai
void setForward()
{
  sensors_event_t a1, g1, temp1;
  sensors_event_t a2, g2, temp2;
  mpu1.getEvent(&a1, &g1, &temp1);
  mpu2.getEvent(&a2, &g2, &temp2);
  float rel1 = wrap180(rawPitch(a1) - baselinePitch1);
  float rel2 = wrap180(rawPitch(a2) - baselinePitch2);

  float weakest = fminf(fabsf(rel1), fabsf(rel2));
  if (weakest < FWD_MIN_ANGLE)
  {
    logMsg("DIR:FAIL " + String(weakest, 1));
    return;
  }

  dir1 = rel1 >= 0 ? 1 : -1;
  dir2 = rel2 >= 0 ? 1 : -1;
  prefs.begin("posture", false);
  prefs.putInt("d1", dir1);
  prefs.putInt("d2", dir2);
  prefs.end();
  logMsg("DIR:OK " + String(dir1) + "," + String(dir2));
}

// Pengguna sedang miring ke kanan: catat tanda roll tiap sensor sebagai "kanan".
//   RDIR:OK p,l    arah baru tersimpan
//   RDIR:FAIL x    kurang miring (x derajat), arah lama dipakai
void setRight()
{
  sensors_event_t a1, g1, temp1;
  sensors_event_t a2, g2, temp2;
  mpu1.getEvent(&a1, &g1, &temp1);
  mpu2.getEvent(&a2, &g2, &temp2);
  float rel1 = rawRoll(a1) - baselineRoll1;
  float rel2 = rawRoll(a2) - baselineRoll2;

  float weakest = fminf(fabsf(rel1), fabsf(rel2));
  if (weakest < RGT_MIN_ANGLE)
  {
    logMsg("RDIR:FAIL " + String(weakest, 1));
    return;
  }

  rdir1 = rel1 >= 0 ? 1 : -1;
  rdir2 = rel2 >= 0 ? 1 : -1;
  prefs.begin("posture", false);
  prefs.putInt("rd1", rdir1);
  prefs.putInt("rd2", rdir2);
  prefs.end();
  logMsg("RDIR:OK " + String(rdir1) + "," + String(rdir2));
}

// Merekam posisi duduk tegak pengguna sebagai titik nol.
//   countdownSec: waktu untuk duduk tegak sebelum sampling dimulai
//   force:        simpan walaupun pengguna bergerak saat sampling
// Mengembalikan true jika titik nol baru tersimpan.
//
// Baris status untuk aplikasi (lihat app/app/demo/protocol.ts):
//   CAL:WAIT n       hitung mundur, sisa n detik
//   CAL:HOLD         sedang sampling, tahan diam
//   CAL:OK b,l       titik nol baru tersimpan (sudut mentah punggung, leher)
//   CAL:FAIL x       bergerak x derajat, titik nol lama dipakai
bool calibrateSensors(int countdownSec, bool force)
{
  setAlert(false);
  isSlouching = false;
  setLeds(true, true); // merah + hijau = sedang kalibrasi (loop berhenti selama ini)

  for (int s = countdownSec; s > 0; s--)
  {
    logMsg("CAL:WAIT " + String(s));
    delay(1000);
  }
  logMsg("CAL:HOLD");

  sensors_event_t a1, g1, temp1;
  sensors_event_t a2, g2, temp2;
  float angles1[CAL_SAMPLES];
  float angles2[CAL_SAMPLES];
  float rolls1[CAL_SAMPLES];
  float rolls2[CAL_SAMPLES];
  float sumX1 = 0, sumY1 = 0, sumZ1 = 0, sumX2 = 0, sumY2 = 0, sumZ2 = 0;

  for (int i = 0; i < CAL_SAMPLES; i++)
  {
    mpu1.getEvent(&a1, &g1, &temp1);
    mpu2.getEvent(&a2, &g2, &temp2);
    angles1[i] = rawPitch(a1);
    angles2[i] = rawPitch(a2);
    rolls1[i] = rawRoll(a1);
    rolls2[i] = rawRoll(a2);
    sumX1 += a1.acceleration.x;
    sumX2 += a2.acceleration.x;
    sumY1 += a1.acceleration.y;
    sumZ1 += a1.acceleration.z;
    sumY2 += a2.acceleration.y;
    sumZ2 += a2.acceleration.z;
    delay(50);
  }

  // Rata-rata vektor gravitasi dulu, baru hitung sudut: aman walau sudut dekat +/-180
  float base1 = atan2(sumZ1, sumY1) * 180 / PI;
  float base2 = atan2(sumZ2, sumY2) * 180 / PI;
  float baseR1 = rollOf({sumX1, sumY1, sumZ1});
  float baseR2 = rollOf({sumX2, sumY2, sumZ2});

  // Cek apakah pengguna diam selama sampling
  float wobble = 0;
  for (int i = 0; i < CAL_SAMPLES; i++)
  {
    wobble = max(wobble, fabsf(wrap180(angles1[i] - base1)));
    wobble = max(wobble, fabsf(wrap180(angles2[i] - base2)));
    wobble = max(wobble, fabsf(rolls1[i] - baseR1));
    wobble = max(wobble, fabsf(rolls2[i] - baseR2));
  }
  if (wobble > CAL_MAX_WOBBLE && !force)
  {
    logMsg("CAL:FAIL " + String(wobble, 1));
    return false;
  }

  baselinePitch1 = base1;
  baselinePitch2 = base2;
  baselineRoll1 = baseR1;
  baselineRoll2 = baseR2;
  hasBaseline = true;
  saveBaseline();
  logMsg("CAL:OK " + String(baselinePitch1, 1) + "," + String(baselinePitch2, 1));
  return true;
}
