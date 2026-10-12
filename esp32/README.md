# esp32

ESP32 firmware for reallign (`test/`, PlatformIO, Adafruit Feather ESP32).

- Streams posture over BLE (Nordic UART Service, name `PostureMonitor`), see `test/src/main.cpp`.
- Optional WiFi upload to the web app's `/api/ingest`, see the "WiFi upload" section at the bottom of `test/src/main.cpp`.
  WiFi is set from the app's Device page over BLE (commands `WS=`, `WP=`, `WU=`, `WT=`, `WIFI`).
  The sensor gets the time from NTP, averages every `WI=` seconds (default 5) so
  other devices can watch live, keeps ~50 minutes while offline, and uploads in the background.

```bash
cd test
pio run -t upload && pio device monitor
```
