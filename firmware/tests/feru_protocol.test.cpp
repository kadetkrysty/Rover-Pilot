#include "../arduino_mega_sensor_controller/feru_protocol.h"
#include <cassert>
#include <cstring>
int main() {
  uint8_t packet[8];
  packFeruCommand(0, 0, packet);
  const uint8_t neutral[8] = {0xCD, 0xAB, 0, 0, 0, 0, 0xCD, 0xAB};
  assert(std::memcmp(packet, neutral, 8) == 0);
  packFeruCommand(150, -150, packet);
  const uint8_t mixed[8] = {0xCD, 0xAB, 0x6A, 0xFF, 0x96, 0, 0x31, 0x54};
  assert(std::memcmp(packet, mixed, 8) == 0);
  packFeruCommand(-150, 0, packet);
  assert(packet[4] == 0x6A && packet[5] == 0xFF);
}
