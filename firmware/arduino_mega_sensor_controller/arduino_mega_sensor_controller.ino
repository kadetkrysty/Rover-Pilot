#include <Wire.h>
#include <SoftwareSerial.h>
#include "HuskyLens.h"
#include <MPU6050.h>

// ===== PIN DEFINITIONS =====
#define HOVER_RX 19
#define HOVER_TX 18
#define LIDAR_RX 17
#define LIDAR_TX 16
#define GPS_RX 15
#define GPS_TX 14

// Ultrasonic Sensors (5x HC-SR04)
#define ULTRA_TRIG_1 22
#define ULTRA_ECHO_1 23
#define ULTRA_TRIG_2 24
#define ULTRA_ECHO_2 25
#define ULTRA_TRIG_3 26
#define ULTRA_ECHO_3 27
#define ULTRA_TRIG_4 28
#define ULTRA_ECHO_4 29
#define ULTRA_TRIG_5 30
#define ULTRA_ECHO_5 31

// ===== SERIAL DEFINITIONS =====
SoftwareSerial hoverSerial(HOVER_RX, HOVER_TX);  // Hoverboard FOC
SoftwareSerial lidarSerial(LIDAR_RX, LIDAR_TX);  // TF Mini Pro
SoftwareSerial gpsSerial(GPS_RX, GPS_TX);        // GPS Module
HuskyLens huskyLens;
MPU6050 mpu;

// ===== DATA STRUCTURES =====
struct TelemetryData {
  float speed;
  float battery;
  float heading;
  float pitch;
  float roll;
  int lidarDistance;
  int ultrasonic[5];
  int gpsLat;
  int gpsLon;
  bool sensorsHealthy[5];
};

TelemetryData telemetry = {0, 85.0, 0, 0, 0, 0, {0, 0, 0, 0, 0}, 0, 0, {true, true, true, true, true}};

// ===== TIMING =====
unsigned long lastTelemetrySend = 0;
unsigned long lastLidarRead = 0;
unsigned long lastUltrasonicRead = 0;
const unsigned long TELEMETRY_INTERVAL = 50;    // 50ms = 20Hz
const unsigned long LIDAR_INTERVAL = 100;       // 100ms
const unsigned long ULTRASONIC_INTERVAL = 100;  // 100ms

void setup() {
  Serial.begin(115200);           // USB to Raspberry Pi
  hoverSerial.begin(115200);      // Hoverboard UART
  lidarSerial.begin(115200);      // LIDAR
  gpsSerial.begin(9600);          // GPS
  
  Wire.begin();                   // I2C for HuskyLens & IMU
  
  // ===== SENSOR INITIALIZATION =====
  if (!mpu.testConnection()) {
    Serial.println("[ERROR] MPU6050 not found!");
    telemetry.sensorsHealthy[3] = false;
  } else {
    mpu.initialize();
    Serial.println("[INIT] MPU6050 initialized");
  }
  
  if (!huskyLens.begin(Wire)) {
    Serial.println("[ERROR] HuskyLens not found!");
    telemetry.sensorsHealthy[0] = false;
  } else {
    Serial.println("[INIT] HuskyLens initialized");
  }
  
  // Ultrasonic pins
  for (int i = 0; i < 5; i++) {
    pinMode(22 + i*2, OUTPUT);      // TRIG
    pinMode(23 + i*2, INPUT);       // ECHO
  }
  
  Serial.println("[SYSTEM] Arduino Mega Sensor Controller READY");
  delay(1000);
}

void loop() {
  // Read commands from Pi
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    handleCommand(command);
  }
  
  // ===== LIDAR READING (100ms interval) =====
  if (millis() - lastLidarRead >= LIDAR_INTERVAL) {
    readLidar();
    lastLidarRead = millis();
  }
  
  // ===== ULTRASONIC READING (100ms interval) =====
  if (millis() - lastUltrasonicRead >= ULTRASONIC_INTERVAL) {
    readUltrasonic();
    lastUltrasonicRead = millis();
  }
  
  // ===== TELEMETRY SEND (50ms interval) =====
  if (millis() - lastTelemetrySend >= TELEMETRY_INTERVAL) {
    readIMU();
    readGPS();
    updateHuskyLens();
    sendTelemetry();
    lastTelemetrySend = millis();
  }
}

void handleCommand(String cmd) {
  if (cmd.startsWith("MOVE:")) {
    // Format: MOVE:throttle,steering
    // Example: MOVE:100,-50
    int commaIdx = cmd.indexOf(',');
    int throttle = cmd.substring(5, commaIdx).toInt();
    int steering = cmd.substring(commaIdx + 1).toInt();
    
    // Send to Hoverboard via UART
    // FOC protocol: [0xAA, Speed_H, Speed_L, Steering_H, Steering_L, Checksum]
    sendToHoverboard(throttle, steering);
  }
  else if (cmd == "STOP") {
    sendToHoverboard(0, 0);
  }
  else if (cmd == "PING") {
    Serial.println("PONG");
  }
}

void sendToHoverboard(int throttle, int steering) {
  // Emmanuel Feru's Hoverboard FOC protocol
  // Maps to Serial1 (pins 18/19 on Mega)
  
  // Clamp values
  throttle = constrain(throttle, -200, 200);
  steering = constrain(steering, -200, 200);
  
  // Format: [START] [THR_H] [THR_L] [STEER_H] [STEER_L] [CHKSUM]
  byte packet[6];
  packet[0] = 0xAA;
  packet[1] = (throttle >> 8) & 0xFF;
  packet[2] = throttle & 0xFF;
  packet[3] = (steering >> 8) & 0xFF;
  packet[4] = steering & 0xFF;
  packet[5] = (packet[1] + packet[2] + packet[3] + packet[4]) & 0xFF;
  
  hoverSerial.write(packet, 6);
}

void readLidar() {
  // TF Mini Pro returns: [0x59, 0x59, Dist_L, Dist_H, Strength_L, Strength_H, Mode, Checksum]
  if (lidarSerial.available() >= 8) {
    if (lidarSerial.read() == 0x59 && lidarSerial.read() == 0x59) {
      uint16_t distance = (lidarSerial.read() | (lidarSerial.read() << 8));
      telemetry.lidarDistance = distance;
      telemetry.sensorsHealthy[1] = true;
    }
  }
}

void readUltrasonic() {
  // HC-SR04: Send 10us pulse to TRIG, measure ECHO time
  // Distance = (time * 343) / 2 (in cm)
  
  for (int i = 0; i < 5; i++) {
    int trigPin = 22 + i*2;
    int echoPin = 23 + i*2;
    
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    
    long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout
    telemetry.ultrasonic[i] = duration / 58; // Convert to cm
  }
}

void readIMU() {
  // MPU6050 accelerometer + gyroscope
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  
  // Calculate pitch/roll from accelerometer
  // Pitch = atan2(ax, sqrt(ay^2 + az^2))
  // Roll = atan2(ay, sqrt(ax^2 + az^2))
  
  telemetry.pitch = atan2(ax, sqrt(ay*ay + az*az)) * 180 / PI;
  telemetry.roll = atan2(ay, sqrt(ax*ax + az*az)) * 180 / PI;
  
  // Approximate heading from gyroscope integration
  telemetry.heading = (telemetry.heading + (gz / 131.0) * 0.05) % 360;
}

void readGPS() {
  // Simple GPS parsing - expects NMEA GGA format
  if (gpsSerial.available() > 0) {
    String gpsData = gpsSerial.readStringUntil('\n');
    if (gpsData.startsWith("$GPGGA")) {
      // Parse: $GPGGA,123519,4807.038,N,01131.000,E,...
      // Extract lat/lon (simplified)
      telemetry.sensorsHealthy[4] = true;
    }
  }
}

void updateHuskyLens() {
  // Request object detection from HuskyLens
  if (huskyLens.request()) {
    if (huskyLens.available()) {
      HuskyLens_Object_t result = huskyLens.read();
      // Use for obstacle avoidance logic
      telemetry.sensorsHealthy[0] = true;
    }
  }
}

void sendTelemetry() {
  // Send JSON to Raspberry Pi over USB Serial
  Serial.print("{\"spd\":");
  Serial.print(telemetry.speed, 1);
  Serial.print(",\"bat\":");
  Serial.print(telemetry.battery, 1);
  Serial.print(",\"hdg\":");
  Serial.print(telemetry.heading, 1);
  Serial.print(",\"pitch\":");
  Serial.print(telemetry.pitch, 1);
  Serial.print(",\"roll\":");
  Serial.print(telemetry.roll, 1);
  Serial.print(",\"lidar\":");
  Serial.print(telemetry.lidarDistance);
  Serial.print(",\"ultra\":[");
  for (int i = 0; i < 5; i++) {
    Serial.print(telemetry.ultrasonic[i]);
    if (i < 4) Serial.print(",");
  }
  Serial.println("]}");
}
