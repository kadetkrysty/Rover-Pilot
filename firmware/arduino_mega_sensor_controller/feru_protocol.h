#pragma once
#include <stdint.h>

// Official Feru CONTROL_SERIAL command: start, steer, speed, XOR checksum.
// Explicit little-endian encoding avoids packing/host-endian assumptions.
inline void packFeruCommand(int16_t speed, int16_t steer, uint8_t packet[8]) {
  const uint16_t words[4] = {0xABCD, uint16_t(steer), uint16_t(speed),
    uint16_t(0xABCD ^ uint16_t(steer) ^ uint16_t(speed))};
  for (uint8_t i = 0; i < 4; ++i) {
    packet[i * 2] = words[i] & 0xFF;
    packet[i * 2 + 1] = words[i] >> 8;
  }
}
