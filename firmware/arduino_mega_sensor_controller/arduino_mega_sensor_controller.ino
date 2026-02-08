/*
 * ===================================================================
 * ROVER SENSOR CONTROLLER - Arduino Mega 2560
 * ===================================================================
 * Version: 3.0.0
 * Updated: 2025-01-02
 * 
 * Hardware Integration:
 * - FlySky FS-IA10B receiver via iBUS protocol (Serial1)
 * - TF Mini Pro LIDAR (Serial2)
 * - Neo-6M GPS (Serial3)
 * - Hoverboard motor controller (SoftwareSerial)
 * - HuskyLens AI Camera (I2C)
 * - MPU6050 IMU (I2C)
 * - 5x HC-SR04 Ultrasonic sensors
 * 
 * Communication:
 * - USB Serial to Mini PC host (115200 baud)
 * - JSON telemetry format at 20Hz
 * ===================================================================
 */

#include <Wire.h>
#include <SoftwareSerial.h>
#include <IBusBM.h>
#include <TinyGPSPlus.h>

// ===== PIN DEFINITIONS =====
// Hoverboard FOC controller (SoftwareSerial)
#define HOVER_RX 10
#define HOVER_TX 11

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

// Status LED
#define STATUS_LED 13

// ===== SERIAL DEFINITIONS =====
// Serial  - USB to Mini PC (pins 0/1)
// Serial1 - iBUS from FlySky FS-IA10B (pins 18/19)
// Serial2 - TF Mini Pro LIDAR (pins 16/17)
// Serial3 - Neo-6M GPS (pins 14/15)
SoftwareSerial hoverSerial(HOVER_RX, HOVER_TX);

// ===== iBUS RECEIVER =====
IBusBM ibus;
#define IBUS_CHANNELS 10

// ===== DATA STRUCTURES =====
struct TelemetryData {
  float speed;
  float battery;
  float heading;
  float pitch;
  float roll;
  float accelX;
  float accelY;
  float accelZ;
  int lidarDistance;
  int ultrasonic[5];
  double gpsLat;
  double gpsLng;
  float gpsSpeed;
  int gpsAccuracy;
  int ibusChannels[IBUS_CHANNELS];
  bool ibusConnected;
  int ibusFrameRate;
  bool sensorsHealthy[6];
};

TelemetryData telemetry;

// ===== TIMING =====
unsigned long lastTelemetrySend = 0;
unsigned long lastLidarRead = 0;
unsigned long lastUltrasonicRead = 0;
unsigned long lastIbusCheck = 0;
unsigned long lastStatusBlink = 0;

const unsigned long TELEMETRY_INTERVAL = 50;    // 50ms = 20Hz
const unsigned long LIDAR_INTERVAL = 100;       // 100ms = 10Hz
const unsigned long ULTRASONIC_INTERVAL = 100;  // 100ms = 10Hz
const unsigned long IBUS_INTERVAL = 10;         // 10ms = 100Hz
const unsigned long STATUS_BLINK = 500;         // 500ms

// ===== GPS =====
TinyGPSPlus gps;
bool gpsLocked = false;

// ===== IMU VARIABLES =====
int16_t ax, ay, az, gx, gy, gz;
const int MPU6050_ADDR = 0x68;

// ===== HUSKY LENS =====
const int HUSKYLENS_ADDR = 0x32;

void setup() {
  Serial.begin(115200);           // USB to Mini PC
  Serial2.begin(115200);          // TF Mini Pro LIDAR
  Serial3.begin(9600);            // GPS Neo-6M
  hoverSerial.begin(115200);      // Hoverboard FOC
  
  // Initialize iBUS on Serial1 (FlySky FS-IA10B)
  ibus.begin(Serial1);
  
  Wire.begin();                   // I2C for sensors
  
  pinMode(STATUS_LED, OUTPUT);
  
  // Initialize telemetry structure
  memset(&telemetry, 0, sizeof(telemetry));
  telemetry.battery = 85.0;
  for (int i = 0; i < 6; i++) {
    telemetry.sensorsHealthy[i] = true;
  }
  for (int i = 0; i < IBUS_CHANNELS; i++) {
    telemetry.ibusChannels[i] = 1500;  // Center position
  }
  
  // Initialize MPU6050
  initMPU6050();
  
  // Initialize HuskyLens
  initHuskyLens();
  
  // Ultrasonic pins
  for (int i = 0; i < 5; i++) {
    pinMode(22 + i*2, OUTPUT);    // TRIG
    pinMode(23 + i*2, INPUT);     // ECHO
  }
  
  Serial.println("{\"event\":\"boot\",\"version\":\"3.0.0\",\"controller\":\"Arduino Mega 2560\"}");
  delay(500);
  Serial.println("{\"event\":\"ready\",\"ibus\":true,\"channels\":10}");
}

void loop() {
  unsigned long now = millis();
  
  // ===== iBUS READING (100Hz) =====
  if (now - lastIbusCheck >= IBUS_INTERVAL) {
    readIbus();
    lastIbusCheck = now;
  }
  
  // ===== COMMAND PROCESSING =====
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    handleCommand(command);
  }
  
  // ===== LIDAR READING (10Hz) =====
  if (now - lastLidarRead >= LIDAR_INTERVAL) {
    readLidar();
    lastLidarRead = now;
  }
  
  // ===== ULTRASONIC READING (10Hz) =====
  if (now - lastUltrasonicRead >= ULTRASONIC_INTERVAL) {
    readUltrasonic();
    lastUltrasonicRead = now;
  }
  
  // ===== TELEMETRY SEND (20Hz) =====
  if (now - lastTelemetrySend >= TELEMETRY_INTERVAL) {
    readIMU();
    readGPS();
    sendTelemetry();
    lastTelemetrySend = now;
  }
  
  // ===== STATUS LED =====
  if (now - lastStatusBlink >= STATUS_BLINK) {
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
    lastStatusBlink = now;
  }
}

// ===== iBUS FUNCTIONS =====
void readIbus() {
  static unsigned long lastValidRead = 0;
  bool anyValid = false;
  
  for (int i = 0; i < IBUS_CHANNELS; i++) {
    int value = ibus.readChannel(i);
    if (value > 0) {
      telemetry.ibusChannels[i] = value;
      anyValid = true;
    }
  }
  
  if (anyValid) {
    lastValidRead = millis();
    telemetry.ibusConnected = true;
  } else if (millis() - lastValidRead > 1000) {
    telemetry.ibusConnected = false;
  }
  
  // Calculate approximate frame rate (iBUS runs at ~143Hz)
  static unsigned long frameCount = 0;
  static unsigned long lastFrameCheck = 0;
  frameCount++;
  
  if (millis() - lastFrameCheck >= 1000) {
    telemetry.ibusFrameRate = frameCount;
    frameCount = 0;
    lastFrameCheck = millis();
  }
}

int getIbusChannel(int ch) {
  if (ch >= 0 && ch < IBUS_CHANNELS) {
    return telemetry.ibusChannels[ch];
  }
  return 1500;
}

// ===== COMMAND HANDLING =====
void handleCommand(String cmd) {
  cmd.trim();
  
  if (cmd.startsWith("MOVE:")) {
    // Format: MOVE:throttle,steering
    int commaIdx = cmd.indexOf(',');
    int throttle = cmd.substring(5, commaIdx).toInt();
    int steering = cmd.substring(commaIdx + 1).toInt();
    sendToHoverboard(throttle, steering);
  }
  else if (cmd == "STOP") {
    sendToHoverboard(0, 0);
    Serial.println("{\"event\":\"stopped\"}");
  }
  else if (cmd == "PING") {
    Serial.println("{\"event\":\"pong\",\"time\":" + String(millis()) + "}");
  }
  else if (cmd == "STATUS") {
    sendStatus();
  }
  else if (cmd == "IBUS") {
    sendIbusData();
  }
  else if (cmd.startsWith("RC:")) {
    // Direct RC control mode - use iBUS channels
    // Format: RC:enable or RC:disable
    String mode = cmd.substring(3);
    Serial.println("{\"event\":\"rc_mode\",\"enabled\":\"" + mode + "\"}");
  }
}

void sendStatus() {
  Serial.print("{\"status\":{");
  Serial.print("\"ibus\":");
  Serial.print(telemetry.ibusConnected ? "true" : "false");
  Serial.print(",\"lidar\":");
  Serial.print(telemetry.sensorsHealthy[0] ? "true" : "false");
  Serial.print(",\"imu\":");
  Serial.print(telemetry.sensorsHealthy[1] ? "true" : "false");
  Serial.print(",\"gps\":");
  Serial.print(telemetry.sensorsHealthy[2] ? "true" : "false");
  Serial.print(",\"husky\":");
  Serial.print(telemetry.sensorsHealthy[3] ? "true" : "false");
  Serial.println("}}");
}

void sendIbusData() {
  Serial.print("{\"ibus\":{\"connected\":");
  Serial.print(telemetry.ibusConnected ? "true" : "false");
  Serial.print(",\"rate\":");
  Serial.print(telemetry.ibusFrameRate);
  Serial.print(",\"ch\":[");
  for (int i = 0; i < IBUS_CHANNELS; i++) {
    Serial.print(telemetry.ibusChannels[i]);
    if (i < IBUS_CHANNELS - 1) Serial.print(",");
  }
  Serial.println("]}}");
}

// ===== HOVERBOARD FOC CONTROL =====
void sendToHoverboard(int throttle, int steering) {
  // Emmanuel Feru's Hoverboard FOC protocol
  throttle = constrain(throttle, -1000, 1000);
  steering = constrain(steering, -1000, 1000);
  
  // Calculate left/right motor speeds (differential drive)
  int leftSpeed = throttle + steering;
  int rightSpeed = throttle - steering;
  
  leftSpeed = constrain(leftSpeed, -1000, 1000);
  rightSpeed = constrain(rightSpeed, -1000, 1000);
  
  // Send FOC command frame
  byte packet[8];
  packet[0] = 0xCD;  // Start frame
  packet[1] = (leftSpeed >> 8) & 0xFF;
  packet[2] = leftSpeed & 0xFF;
  packet[3] = (rightSpeed >> 8) & 0xFF;
  packet[4] = rightSpeed & 0xFF;
  packet[5] = 0x00;  // Reserved
  packet[6] = 0x00;  // Reserved
  packet[7] = (packet[1] ^ packet[2] ^ packet[3] ^ packet[4]) & 0xFF;  // Checksum
  
  hoverSerial.write(packet, 8);
}

// ===== LIDAR READING =====
void readLidar() {
  static byte lidarBuffer[9];
  static int bufferIndex = 0;
  
  while (Serial2.available()) {
    byte b = Serial2.read();
    
    if (bufferIndex == 0 && b != 0x59) continue;
    if (bufferIndex == 1 && b != 0x59) {
      bufferIndex = 0;
      continue;
    }
    
    lidarBuffer[bufferIndex++] = b;
    
    if (bufferIndex == 9) {
      // Validate checksum
      byte checksum = 0;
      for (int i = 0; i < 8; i++) checksum += lidarBuffer[i];
      
      if (checksum == lidarBuffer[8]) {
        telemetry.lidarDistance = lidarBuffer[2] | (lidarBuffer[3] << 8);
        telemetry.sensorsHealthy[0] = true;
      }
      bufferIndex = 0;
    }
  }
}

// ===== ULTRASONIC READING =====
void readUltrasonic() {
  for (int i = 0; i < 5; i++) {
    int trigPin = 22 + i*2;
    int echoPin = 23 + i*2;
    
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    
    long duration = pulseIn(echoPin, HIGH, 30000);
    telemetry.ultrasonic[i] = duration > 0 ? duration / 58 : 999;
  }
}

// ===== IMU (MPU6050) =====
void initMPU6050() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0x00);  // Wake up
  byte error = Wire.endTransmission();
  
  if (error != 0) {
    Serial.println("{\"event\":\"error\",\"sensor\":\"mpu6050\",\"msg\":\"not found\"}");
    telemetry.sensorsHealthy[1] = false;
  } else {
    // Configure accelerometer (±2g)
    Wire.beginTransmission(MPU6050_ADDR);
    Wire.write(0x1C);
    Wire.write(0x00);
    Wire.endTransmission();
    
    // Configure gyroscope (±250°/s)
    Wire.beginTransmission(MPU6050_ADDR);
    Wire.write(0x1B);
    Wire.write(0x00);
    Wire.endTransmission();
    
    telemetry.sensorsHealthy[1] = true;
  }
}

void readIMU() {
  if (!telemetry.sensorsHealthy[1]) return;
  
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 14, true);
  
  ax = Wire.read() << 8 | Wire.read();
  ay = Wire.read() << 8 | Wire.read();
  az = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();  // Temperature (skip)
  gx = Wire.read() << 8 | Wire.read();
  gy = Wire.read() << 8 | Wire.read();
  gz = Wire.read() << 8 | Wire.read();
  
  // Convert to real units
  telemetry.accelX = ax / 16384.0;
  telemetry.accelY = ay / 16384.0;
  telemetry.accelZ = az / 16384.0;
  
  // Calculate pitch and roll from accelerometer
  telemetry.pitch = atan2(ax, sqrt(ay*ay + az*az)) * 180.0 / PI;
  telemetry.roll = atan2(ay, sqrt(ax*ax + az*az)) * 180.0 / PI;
  
  // Integrate gyroscope for heading (simplified)
  static float headingAccum = 0;
  headingAccum += (gz / 131.0) * 0.05;  // 50ms interval
  telemetry.heading = fmod(headingAccum + 360, 360);
}

// ===== HUSKY LENS =====
void initHuskyLens() {
  Wire.beginTransmission(HUSKYLENS_ADDR);
  byte error = Wire.endTransmission();
  
  if (error != 0) {
    telemetry.sensorsHealthy[3] = false;
  } else {
    telemetry.sensorsHealthy[3] = true;
  }
}

// ===== GPS PARSING =====
void readGPS() {
  while (Serial3.available()) {
    gps.encode(Serial3.read());
  }

  if (gps.location.isUpdated()) {
    telemetry.gpsLat = gps.location.lat();
    telemetry.gpsLng = gps.location.lng();
    telemetry.sensorsHealthy[2] = true;
    gpsLocked = true;
  }

  if (gps.speed.isUpdated()) {
    telemetry.gpsSpeed = gps.speed.kmph();
  }

  if (gps.hdop.isUpdated()) {
    telemetry.gpsAccuracy = gps.hdop.value();
  }
}

// ===== TELEMETRY OUTPUT =====
void sendTelemetry() {
  Serial.print("{\"t\":");
  Serial.print(millis());
  
  // GPS
  Serial.print(",\"gps\":{\"lat\":");
  Serial.print(telemetry.gpsLat, 6);
  Serial.print(",\"lng\":");
  Serial.print(telemetry.gpsLng, 6);
  Serial.print(",\"spd\":");
  Serial.print(telemetry.gpsSpeed, 1);
  Serial.print(",\"acc\":");
  Serial.print(telemetry.gpsAccuracy);
  Serial.print(",\"sat\":");
  Serial.print(gps.satellites.value());
  Serial.print("}");
  
  // IMU
  Serial.print(",\"imu\":{\"hdg\":");
  Serial.print(telemetry.heading, 1);
  Serial.print(",\"pitch\":");
  Serial.print(telemetry.pitch, 1);
  Serial.print(",\"roll\":");
  Serial.print(telemetry.roll, 1);
  Serial.print(",\"ax\":");
  Serial.print(telemetry.accelX, 2);
  Serial.print(",\"ay\":");
  Serial.print(telemetry.accelY, 2);
  Serial.print(",\"az\":");
  Serial.print(telemetry.accelZ, 2);
  Serial.print("}");
  
  // LIDAR
  Serial.print(",\"lidar\":");
  Serial.print(telemetry.lidarDistance);
  
  // Ultrasonic
  Serial.print(",\"ultra\":[");
  for (int i = 0; i < 5; i++) {
    Serial.print(telemetry.ultrasonic[i]);
    if (i < 4) Serial.print(",");
  }
  Serial.print("]");
  
  // iBUS RC channels
  Serial.print(",\"ibus\":{\"con\":");
  Serial.print(telemetry.ibusConnected ? "true" : "false");
  Serial.print(",\"ch\":[");
  for (int i = 0; i < IBUS_CHANNELS; i++) {
    Serial.print(telemetry.ibusChannels[i]);
    if (i < IBUS_CHANNELS - 1) Serial.print(",");
  }
  Serial.print("]}");
  
  // Battery
  Serial.print(",\"bat\":");
  Serial.print(telemetry.battery, 1);
  
  Serial.println("}");
}
