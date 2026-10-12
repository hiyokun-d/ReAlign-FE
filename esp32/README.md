# esp32

ESP32 firmware for reallign (`test/src/main.cpp`, Adafruit Feather ESP32). Bluetooth only.

- Streams posture over BLE (Nordic UART Service, name `PostureMonitor`) at ~20 Hz:
  `back,neck,alert,backRoll,neckRoll` (`alert` = 1 while slouching past the time limit).
  The web app's `/device` page connects and syncs to Supabase.
- Pins: buzzer **D18** (slouch alert, **off by default**, `ON` / `OFF` / `BUZZ` to test),
  red LED **D4**, green LED **D23**. If the buzzer is passive, set `BUZZER_PASSIVE = true`.
- LEDs: red slow blink = waiting for Bluetooth, green = connected, both on = calibrating,
  red fast blink = an MPU6050 isn't detected (check wiring).
- Up to 3 phones/laptops can connect at once; `KICK` disconnects everyone but the sender,
  `PEERS:n` reports how many are connected.
- Commands work over BLE or the USB Serial Monitor (115200, Newline):
  `CAL`, `CAL=n`, `FWD`, `RGT`, `T=`, `D=`, `ON`, `OFF`, `BUZZ`, `STATUS`, `KICK`.
- No WiFi: WiFi and Bluetooth share one radio, and WiFi retries blocked BLE connections.

Arduino IDE: **Tools → Partition Scheme → Huge APP (3MB No OTA/1MB SPIFFS)**.
