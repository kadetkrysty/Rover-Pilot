/*
 * GPS Module Test - GY-NEO6MV2
 * Upload this to Arduino Mega 2560 to verify GPS wiring
 * 
 * Wiring:
 *   GPS VCC  -> Arduino 5V
 *   GPS GND  -> Arduino GND
 *   GPS TX   -> Arduino Pin 15 (RX3)
 *   GPS RX   -> Arduino Pin 14 (TX3)
 * 
 * Open Serial Monitor at 115200 baud
 */

#include <TinyGPSPlus.h>

TinyGPSPlus gps;

void setup() {
  Serial.begin(115200);
  Serial3.begin(9600);
  
  Serial.println("========================================");
  Serial.println("  GY-NEO6MV2 GPS Test");
  Serial.println("========================================");
  Serial.println("Waiting for data on Serial3 (pins 14/15)...");
  Serial.println();
}

void loop() {
  // Check if any raw bytes are coming from the GPS module
  bool dataReceived = false;
  
  while (Serial3.available()) {
    char c = Serial3.read();
    gps.encode(c);
    Serial.write(c);  // Print raw NMEA sentences
    dataReceived = true;
  }
  
  // Every 5 seconds, print a status summary
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 5000) {
    lastStatus = millis();
    
    Serial.println();
    Serial.println("--- GPS STATUS ---");
    
    if (gps.charsProcessed() < 10) {
      Serial.println("** NO DATA RECEIVED **");
      Serial.println("Check wiring:");
      Serial.println("  GPS TX  -> Arduino Pin 15 (RX3)");
      Serial.println("  GPS RX  -> Arduino Pin 14 (TX3)");
      Serial.println("  GPS VCC -> Arduino 5V");
      Serial.println("  GPS GND -> Arduino GND");
    } else {
      Serial.print("Characters processed: ");
      Serial.println(gps.charsProcessed());
      Serial.print("Sentences with fix: ");
      Serial.println(gps.sentencesWithFix());
      Serial.print("Failed checksums: ");
      Serial.println(gps.failedChecksum());
      Serial.print("Satellites: ");
      Serial.println(gps.satellites.value());
      
      if (gps.location.isValid()) {
        Serial.print("LAT: ");
        Serial.println(gps.location.lat(), 6);
        Serial.print("LNG: ");
        Serial.println(gps.location.lng(), 6);
        Serial.print("Speed (km/h): ");
        Serial.println(gps.speed.kmph(), 1);
      } else {
        Serial.println("Location: NOT VALID YET (need clear sky view)");
      }
    }
    Serial.println("------------------");
    Serial.println();
  }
}
