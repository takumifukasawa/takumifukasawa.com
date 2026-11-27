---
title: "Bambu Lab 製 3Dプリンターの稼働状況を Slack に通知する"
date: 2026-06-27T17:38:41+09:00
tags: []
---

「1つの3Dプリンターを複数人で共用する」という場面がありました。この時、Slackに稼働状況が通知されることで「今、プリンターがどんな状況か」をSlack上で把握できるようになっていると各人が3Dプリンターを使いやすくなるかなと思い、作ってみました。

この3つのタイミングで通知をしています。

-   **プリント開始時 / プリントにかかる時間とプリントの終了時間の目安**
-   **プリント終了時**
-   **なんらかの理由で停止した時**

![](../../assets/blog/bambu-lab-printer-status-to-slack/20260627164906.png)

リポジトリはこちらです。

[GitHub - takumifukasawa/bambu-slack-notifier: BambooP2S-slack-notifier](https://github.com/takumifukasawa/bambu-slack-notifier)

## 仕組み

プログラムはマイコンにArduinoで書き込んでいます。このマイコンは給電が必要なので電源につないでおきます。

[![Freenove ESP 32開発ボードキット (2個パック)、デュアルコア32ビット240 MHzマイクロコントローラ開発、オンボードWiFi+BT、Python Cコード、サンプルプロジェクトチュートリアル](https://m.media-amazon.com/images/I/51L+KGANGdL._SL500_.jpg "Freenove ESP 32開発ボードキット (2個パック)、デュアルコア32ビット240 MHzマイクロコントローラ開発、オンボードWiFi+BT、Python Cコード、サンプルプロジェクトチュートリアル")](https://www.amazon.co.jp/dp/B0C9THDPXP?tag=hatena-22&linkCode=osi&th=1&psc=1)

[Freenove ESP 32開発ボードキット (2個パック)、デュアルコア32ビット240 MHzマイクロコントローラ開発、オンボードWiFi+BT、Python Cコード、サンプルプロジェクトチュートリアル](https://www.amazon.co.jp/dp/B0C9THDPXP?tag=hatena-22&linkCode=osi&th=1&psc=1)

-   Freenove

[Amazon](https://www.amazon.co.jp/dp/B0C9THDPXP?tag=hatena-22&linkCode=osi&th=1&psc=1)

マイコンと3Dプリンターを同一ネットワークに繋ぐことで、<strong>MQTTプロトコルを介して3Dプリンターの情報をjson形式で取得することができます。</strong>このとき、MQTTプロトコルに繋ぐために3Dプリンターの LAN Access Code などが必要になります。

```c
  client.setServer(mqtt_server, 8883);
  client.setCallback(callback);
  client.setBufferSize(32768);
```

注意点として、<strong>jsonはcallbackを介して常に取得することができるのですが必ず同じ構造で返ってくるわけではないようです。</strong>プリントの開始時など、タイミングごとに追加されるデータがあったりなかったりするようです。  
というのも、<strong>json形式の中のデータのフォーマットはおそらく公式で公開されておらず、実際のjsonの中身を見て判断したことになります。</strong>また、Bambu Lab 製のどのプリンターかによっても中身が違う可能性があります。

例えばプリンターの稼働状況はプリントの開始時や終了時などに `gcode_state` から取得することができるので、その切り替わりを検知して Slack に通知を流しています。

```c
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, messageTemp);
  ...
  bool hasPrint = doc.containsKey("print");
  bool hasGcodeState = hasPrint && doc["print"].containsKey("gcode_state");
  bool hasRemainingTime = hasPrint && doc["print"].containsKey("mc_remaining_time");
  if (hasGcodeState) {
    String newState = doc["print"]["gcode_state"].as<String>(); // "RUNNING", "FAILED", "PAUSE", "FINISH" などが入る
    ...
```

## ハマったところ

主に3つです。

Arduinoのプログラムを書き込む時に `Tools -> Upload Speed` を調整する必要がありました。これはケーブルやPCによる環境依存だと思います。自分の環境では `921600 -> 115200` としました。

次に、<strong>バッファサイズは`setBufferSize(32768)`として大きめに確保しました。</strong>MQTT経由で取得できるjsonデータが大きいのと、前述のようにjsonデータの構造が場合によって異なるのでそれも加味して大きめにしています。

```c
  client.setBufferSize(32768);
```

最後に、 <strong>MQTT接続が `state: 5`（認証エラー）で失敗する場合はプリンター画面の LAN Access Code が異なっていることが問題の場合があります。</strong>LANモードの切り替えやファームウェア更新で再生成されることがあるようです。MQTT接続できているかどうかはArduinoのSerial Monitorから確認します。

## コード

以下が全文です。 `secrets.h` を別途用意し、wifiなどの情報はそちらに記載しておきます。

bambu\_slack\_notifier.ino

```c
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <time.h>
#include "secrets.h"

// ==========================================
// Config lives in secrets.h (copy secrets.example.h to create it)
// ==========================================
const char* ssid = WIFI_SSID;          // Wi-Fi SSID
const char* password = WIFI_PASSWORD;  // Wi-Fi password

const char* mqtt_server = MQTT_SERVER;      // Printer's local IP address
const char* mqtt_user = "bblp";               // Fixed as "bblp" on Bambu
const char* mqtt_password = MQTT_PASSWORD; // LAN Access Code from the printer screen
const char* mqtt_topic = MQTT_TOPIC; // device/<serial-number>/report

const char* slack_webhook_url = SLACK_WEBHOOK; // Slack Webhook URL
// ==========================================

// ==========================================
// Slack notification messages (edit freely / translate here)
// Static messages are plain constants; the dynamic "start" message is
// assembled in buildStartMessage() / formatDuration() below.
// ==========================================
const char* MSG_FINISH = "✅ プリントが正常に完了しました！";
const char* MSG_PAUSE  = "⚠️ プリントが一時停止、またはエラーが発生しました。";
// ==========================================

WiFiClientSecure espClient;
PubSubClient client(espClient);

String currentState = "UNKNOWN";
bool isStartNotified = false;

const long gmtOffset_sec = 32400; // JST (9 hours * 3600 sec)
const int daylightOffset_sec = 0;

// Send a message to Slack
void sendSlackMessage(String message) {
  // for debug
  // Serial.println("Slack notification preview:");
  // Serial.println(message);
  // return;

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(slack_webhook_url);
    http.addHeader("Content-Type", "application/json");

    // Build the JSON payload
    String payload = "{\"text\":\"" + message + "\"}";

    int httpResponseCode = http.POST(payload);
    Serial.print("Slack POST result (HTTP code): ");
    Serial.println(httpResponseCode);
    http.end();
  }
}

// Format a duration in minutes, e.g. "2時間30分" / "30分".
// To translate, rewrite the returned strings (word order is free here).
String formatDuration(int totalMinutes) {
  int hours = totalMinutes / 60;
  int mins = totalMinutes % 60;
  if (hours > 0) {
    return String(hours) + "時間" + String(mins) + "分";
  }
  return String(mins) + "分";
}

// Build the whole "print started" message.
// finishTime is the expected finish time (e.g. "14:30"); empty to omit it.
// To translate, edit this function body in one place.
String buildStartMessage(int remainingMinutes, const String& finishTime) {
  String msg = "🚀 プリントを開始しました！\n合計推定時間: " + formatDuration(remainingMinutes);
  if (finishTime.length() > 0) {
    msg += "\n完了予定時刻: " + finishTime;
  }
  return msg;
}

void callback(char* topic, byte* payload, unsigned int length) {
  // for debug
  // Serial.print("[received] size: ");
  // Serial.println(length);

  String messageTemp;
  for (int i = 0; i < length; i++) {
    messageTemp += (char)payload[i];
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, messageTemp);

  if (error) {
    // If the JSON is too large to parse, the buffer may be too small
    Serial.println("JSON parse error: payload size is too large");
    return;
  }

  // Check what the received payload contains
  bool hasPrint = doc.containsKey("print");
  bool hasGcodeState = hasPrint && doc["print"].containsKey("gcode_state");
  bool hasRemainingTime = hasPrint && doc["print"].containsKey("mc_remaining_time");

  // 1. Update the state (gcode_state)
  if (hasGcodeState) {
    String newState = doc["print"]["gcode_state"].as<String>();
    if (newState != currentState && currentState != "UNKNOWN") {
      Serial.println("State change detected: " + currentState + " -> " + newState);

      if (newState == "FINISH") {
        sendSlackMessage(MSG_FINISH);
        isStartNotified = false;
      } else if (newState == "PAUSE" || newState == "FAILED") {
        sendSlackMessage(MSG_PAUSE);
        isStartNotified = false;
      } else if (newState == "IDLE") {
        isStartNotified = false;
      }
    }
    currentState = newState;
  }

  // 2. Handle the start notification
  if (currentState == "RUNNING" && !isStartNotified) {
    if (hasRemainingTime) {
      int remainingTime = doc["print"]["mc_remaining_time"].as<int>();

      if (remainingTime > 0) {
        // Compute the expected finish time (empty if NTP not ready yet)
        String finishTime = "";
        time_t now;
        struct tm timeinfo;
        if (getLocalTime(&timeinfo)) {
          time(&now);
          now += (remainingTime * 60);
          struct tm *finish = localtime(&now);
          char timeStr[10];
          strftime(timeStr, sizeof(timeStr), "%H:%M", finish);
          finishTime = String(timeStr);
        }

        sendSlackMessage(buildStartMessage(remainingTime, finishTime));
        isStartNotified = true;
        Serial.println("Sent notification to Slack: " + formatDuration(remainingTime));
      }
    }
  }
}

void setup_wifi() {
  delay(10);
  Serial.println("\nConnecting to Wi-Fi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected! IP:");
  Serial.println(WiFi.localIP());

  Serial.flush();
}

void reconnect() {
  // Loop until connected to MQTT
  while (!client.connected()) {
    Serial.print("Connecting to the Bambu printer's MQTT...");

    // Connect with an arbitrary client ID
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);

    if (client.connect(clientId.c_str(), mqtt_user, mqtt_password)) {
      Serial.println("connected!");
      client.subscribe(mqtt_topic);
    } else {
      Serial.print("failed, state: ");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  setup_wifi();

  Serial.println("Step 1: Wi-Fi OK, waiting 1 sec...");
  Serial.flush();
  delay(1000);

  Serial.println("Step 2: NTP Time config...");
  Serial.flush();
  configTime(gmtOffset_sec, daylightOffset_sec, "ntp.nict.jp", "time.google.com");

  Serial.println("Step 3: MQTT setup...");
  Serial.flush();
  espClient.setInsecure();
  client.setServer(mqtt_server, 8883);
  client.setCallback(callback);
  client.setBufferSize(32768);

  Serial.println("Step 4: Setup complete!");
  Serial.flush();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}
```

secrets.h

```c
// secrets.example.h
// Copy this file to secrets.h and fill in the values for your environment:
//   cp secrets.example.h secrets.h
// secrets.h is excluded by .gitignore, so it is never committed.
#pragma once

// --- Wi-Fi ---
#define WIFI_SSID      "YOUR_WIFI_SSID"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"

// --- Bambu printer (LAN) ---
// Printer IP address (printer screen: Settings > Network)
#define MQTT_SERVER    "192.168.x.x"
// LAN Access Code (printer screen: Settings > Network)
#define MQTT_PASSWORD  "XXXXXXXX"
// Subscribe topic. Fill in the serial number (SN): device/<SN>/report
#define MQTT_TOPIC     "device/YOUR_PRINTER_SERIAL/report"

// --- Slack ---
// Incoming Webhook URL (issued under Incoming Webhooks in your Slack App)
#define SLACK_WEBHOOK  "https://hooks.slack.com/services/XXXX/XXXX/XXXX"
```
