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
#include "feru_protocol.h"

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
bool driveArmed = false;
bool driveEstop = false;
unsigned long lastDriveCommand = 0;
const unsigned long DRIVE_TIMEOUT_MS = 350;
unsigned long lastIbusPacket = 0;
bool ibusSeen = false;
bool imuCalibrated = false;
unsigned long lastImuRead = 0;

// ===== HUSKY LENS =====
const int HUSKYLENS_ADDR = 0x32;

void setup() {
  Serial.begin(115200);           // USB to Mini PC
  Serial2.begin(115200);          // TF Mini Pro LIDAR
  Serial3.begin(9600);            // GPS Neo-6M
  hoverSerial.begin(115200);      // Hoverboard FOC
  sendToHoverboard(0, 0);         // Boot is always stopped; never restore an old command.
  
  // Initialize iBUS on Serial1 (FlySky FS-IA10B)
  ibus.begin(Serial1);
  
  Wire.begin();                   // I2C for sensors
#if defined(WIRE_HAS_TIMEOUT)
  Wire.setWireTimeout(25000, true);
#endif
  
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
  
  Serial.println("{\"event\":\"boot\",\"version\":\"4.0.0\",\"controller\":\"Arduino Mega 2560\"}");
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
  // Bounded, nonblocking line parsing: a partial serial line cannot delay the watchdog.
  static char command[64];
  static uint8_t commandLength = 0;
  static bool discardLine = false;
  uint8_t bytesRead = 0;
  while (Serial.available() > 0 && bytesRead++ < 64) {
    char c = Serial.read();
    if (c == '\n') {
      if (!discardLine) {
        command[commandLength] = '\0';
        handleCommand(String(command));
      }
      commandLength = 0;
      discardLine = false;
    } else if (c != '\r') {
      if (commandLength < sizeof(command) - 1 && !discardLine) command[commandLength++] = c;
      else discardLine = true;
    }
  }
  if (driveArmed && millis() - lastDriveCommand > DRIVE_TIMEOUT_MS) {
    driveArmed = false;
    sendToHoverboard(0, 0);
    Serial.println("{\"event\":\"drive_timeout\"}");
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
  if (driveArmed && millis() - lastDriveCommand > DRIVE_TIMEOUT_MS) {
    driveArmed = false;
    sendToHoverboard(0, 0);
  }
}

// ===== iBUS FUNCTIONS =====
void readIbus() {
  static uint8_t lastCount = 0;
  static unsigned long packetCount = 0;
  static unsigned long lastFrameCheck = 0;
  uint8_t count = ibus.cnt_rec;
  uint8_t received = uint8_t(count - lastCount);
  lastCount = count;
  if (received) {
    lastIbusPacket = millis();
    ibusSeen = true;
    packetCount += received;
  }
  bool allValid = true;
  
  for (int i = 0; i < IBUS_CHANNELS; i++) {
    int value = ibus.readChannel(i);
    if (value >= 800 && value <= 2200) {
      telemetry.ibusChannels[i] = value;
    } else allValid = false;
  }
  
  // readChannel returns cached values even after radio loss. Count NEW packets.
  telemetry.ibusConnected = ibusSeen && allValid && millis() - lastIbusPacket <= 250;
  
  if (millis() - lastFrameCheck >= 1000) {
    telemetry.ibusFrameRate = packetCount;
    packetCount = 0;
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
  
  if (cmd == "ARM" && !driveEstop) {
    driveArmed = true;
    lastDriveCommand = millis();
    sendToHoverboard(0, 0);
    Serial.println("{\"event\":\"drive_armed\",\"protocol\":1}");
  }
  else if (cmd.startsWith("DRIVE:") && driveArmed && !driveEstop) {
    int commaIdx = cmd.indexOf(',');
    if (commaIdx <= 6 || cmd.indexOf(',', commaIdx + 1) >= 0) return;
    char *endThrottle, *endSteering;
    String a = cmd.substring(6, commaIdx), b = cmd.substring(commaIdx + 1);
    long throttle = strtol(a.c_str(), &endThrottle, 10);
    long steering = strtol(b.c_str(), &endSteering, 10);
    if (!a.length() || !b.length() || *endThrottle || *endSteering ||
        throttle < -150 || throttle > 150 || steering < -150 || steering > 150) return;
    if (millis() - lastDriveCommand > DRIVE_TIMEOUT_MS) {
      driveArmed = false;
      sendToHoverboard(0, 0);
      return;
    }
    lastDriveCommand = millis();
    sendToHoverboard(throttle, steering);
  }
  else if (cmd == "STOP" || cmd == "ESTOP" || cmd == "RESET_STOP") {
    driveArmed = false;
    if (cmd == "ESTOP") driveEstop = true;
    if (cmd == "RESET_STOP") driveEstop = false;
    sendToHoverboard(0, 0);
    if (cmd == "RESET_STOP") Serial.println("{\"event\":\"drive_reset\",\"protocol\":1}");
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
  throttle = constrain(throttle, -150, 150);
  steering = constrain(steering, -150, 150);
  byte packet[8];
  packFeruCommand(throttle, steering, packet);
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
  // Stagger pings: five consecutive 30 ms waits would delay motor command processing.
  static int i = 0;
  {
    int trigPin = 22 + i*2;
    int echoPin = 23 + i*2;
    
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    
    long duration = pulseIn(echoPin, HIGH, 30000);
    telemetry.ultrasonic[i] = duration > 0 ? duration / 58 : 999;
    if (driveArmed && millis() - lastDriveCommand > DRIVE_TIMEOUT_MS) {
      driveArmed = false;
      sendToHoverboard(0, 0);
    }
  }
  i = (i + 1) % 5;
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
  if (Wire.endTransmission(false) != 0) { lastImuRead = 0; return; }
  Wire.requestFrom(MPU6050_ADDR, 14, true);
  if (Wire.available() != 14) { lastImuRead = 0; return; }
  
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
  
  // Stationary startup bias calibration. MPU6050 yaw is RELATIVE, never compass north.
  static uint8_t calibrationSamples = 0;
  static float sumX = 0, sumY = 0, sumZ = 0, biasX = 0, biasY = 0, biasZ = 0;
  static unsigned long previousMicros = 0;
  float rateX = gx / 131.0, rateY = gy / 131.0, rateZ = gz / 131.0;
  float norm = sqrt(telemetry.accelX * telemetry.accelX + telemetry.accelY * telemetry.accelY +
                    telemetry.accelZ * telemetry.accelZ);
  float accelPitch = atan2(-float(ax), sqrt(float(ay)*ay + float(az)*az)) * 180.0 / PI;
  float accelRoll = atan2(float(ay), float(az)) * 180.0 / PI;
  unsigned long nowMicros = micros();
  float dt = previousMicros ? (nowMicros - previousMicros) / 1000000.0 : 0;
  previousMicros = nowMicros;
  lastImuRead = millis();
  if (!imuCalibrated) {
    if (abs(norm - 1) < 0.08 && abs(rateX) < 3 && abs(rateY) < 3 && abs(rateZ) < 3 && !driveArmed) {
      sumX += rateX; sumY += rateY; sumZ += rateZ;
      if (++calibrationSamples >= 64) {
        biasX = sumX / 64; biasY = sumY / 64; biasZ = sumZ / 64;
        imuCalibrated = true;
        telemetry.heading = 0;
      }
    } else { calibrationSamples = 0; sumX = sumY = sumZ = 0; }
    telemetry.pitch = accelPitch;
    telemetry.roll = accelRoll;
    return;
  }
  if (dt <= 0 || dt > 0.25) return; // No invented rotation across missing samples.
  telemetry.pitch = 0.98 * (telemetry.pitch + (rateY - biasY) * dt) + 0.02 * accelPitch;
  telemetry.roll = 0.98 * (telemetry.roll + (rateX - biasX) * dt) + 0.02 * accelRoll;
  telemetry.heading = fmod(telemetry.heading + (rateZ - biasZ) * dt + 360, 360);
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
  Serial.print(",\"valid\":");
  Serial.print(imuCalibrated && lastImuRead && millis() - lastImuRead <= 250 ? "true" : "false");
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
  Serial.print(",\"age\":");
  Serial.print(ibusSeen ? min(millis() - lastIbusPacket, 1000000UL) : 1000000UL);
  Serial.print(",\"ch\":[");
  for (int i = 0; i < IBUS_CHANNELS; i++) {
    Serial.print(telemetry.ibusChannels[i]);
    if (i < IBUS_CHANNELS - 1) Serial.print(",");
  }
  Serial.print("]}");
  
  // Battery
  Serial.print(",\"control\":{\"protocol\":1,\"watchdogMs\":350,\"armed\":");
  Serial.print(driveArmed ? "true" : "false");
  Serial.print(",\"estop\":");
  Serial.print(driveEstop ? "true" : "false");
  Serial.print("}");
  Serial.print(",\"bat\":");
  Serial.print(telemetry.battery, 1);
  
  Serial.println("}");
}
