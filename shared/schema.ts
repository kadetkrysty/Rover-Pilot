import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, real, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Routes - Saved navigation missions
export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  totalDistance: real("total_distance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

// Waypoints - Individual points in a route
export const waypoints = pgTable("waypoints", {
  id: serial("id").primaryKey(),
  routeId: integer("route_id").notNull().references(() => routes.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWaypointSchema = createInsertSchema(waypoints).omit({
  id: true,
  createdAt: true,
});

export type InsertWaypoint = z.infer<typeof insertWaypointSchema>;
export type Waypoint = typeof waypoints.$inferSelect;

// Telemetry Logs - Sensor data snapshots
export const telemetryLogs = pgTable("telemetry_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  speed: real("speed").notNull(),
  battery: real("battery").notNull(),
  heading: real("heading").notNull(),
  pitch: real("pitch").notNull(),
  roll: real("roll").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  lidarDistance: integer("lidar_distance").notNull(),
  ultrasonicDistances: jsonb("ultrasonic_distances").notNull().$type<number[]>(),
  mode: text("mode").notNull(),
});

export const insertTelemetryLogSchema = createInsertSchema(telemetryLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertTelemetryLog = z.infer<typeof insertTelemetryLogSchema>;
export type TelemetryLog = typeof telemetryLogs.$inferSelect;

// Rover Configuration
export const roverConfig = pgTable("rover_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRoverConfigSchema = createInsertSchema(roverConfig).omit({
  id: true,
  updatedAt: true,
});

export type InsertRoverConfig = z.infer<typeof insertRoverConfigSchema>;
export type RoverConfig = typeof roverConfig.$inferSelect;

// Fused Telemetry - Sensor fusion processed data
export const fusedTelemetry = pgTable("fused_telemetry", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  theta: real("theta").notNull(),
  velocity: real("velocity").notNull(),
  angularVelocity: real("angular_velocity").notNull(),
  covarianceMatrix: jsonb("covariance_matrix").notNull().$type<number[][]>(),
  gpsLatitude: real("gps_latitude"),
  gpsLongitude: real("gps_longitude"),
  gpsAccuracy: real("gps_accuracy"),
  imuHeading: real("imu_heading"),
  imuPitch: real("imu_pitch"),
  imuRoll: real("imu_roll"),
  lidarDistance: integer("lidar_distance"),
  lidarAngle: real("lidar_angle"),
  ultrasonicDistances: jsonb("ultrasonic_distances").$type<number[]>(),
  fusionConfidence: real("fusion_confidence").notNull(),
});

export const insertFusedTelemetrySchema = createInsertSchema(fusedTelemetry).omit({
  id: true,
  timestamp: true,
});

export type InsertFusedTelemetry = z.infer<typeof insertFusedTelemetrySchema>;
export type FusedTelemetry = typeof fusedTelemetry.$inferSelect;

// Occupancy Grid Maps - SLAM generated maps
export const occupancyMaps = pgTable("occupancy_maps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  resolution: real("resolution").notNull(),
  originX: real("origin_x").notNull(),
  originY: real("origin_y").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOccupancyMapSchema = createInsertSchema(occupancyMaps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOccupancyMap = z.infer<typeof insertOccupancyMapSchema>;
export type OccupancyMap = typeof occupancyMaps.$inferSelect;

// Map Tiles - Compressed grid data for occupancy maps
export const mapTiles = pgTable("map_tiles", {
  id: serial("id").primaryKey(),
  mapId: integer("map_id").notNull().references(() => occupancyMaps.id, { onDelete: 'cascade' }),
  tileX: integer("tile_x").notNull(),
  tileY: integer("tile_y").notNull(),
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMapTileSchema = createInsertSchema(mapTiles).omit({
  id: true,
  updatedAt: true,
});

export type InsertMapTile = z.infer<typeof insertMapTileSchema>;
export type MapTile = typeof mapTiles.$inferSelect;

// Sensor Fusion Types for real-time streaming
export interface SensorFusionState {
  x: number;
  y: number;
  theta: number;
  velocity: number;
  angularVelocity: number;
  covariance: number[][];
  confidence: number;
}

export interface LidarScan {
  angle: number;
  distance: number;
  timestamp: number;
}

export interface OccupancyGridCell {
  x: number;
  y: number;
  probability: number;
}

export interface MapUpdate {
  mapId: number;
  cells: OccupancyGridCell[];
  roverPose: { x: number; y: number; theta: number };
  timestamp: number;
}

// Video Recordings - Captured mission footage
export const videoRecordings = pgTable("video_recordings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  routeId: integer("route_id").references(() => routes.id, { onDelete: 'set null' }),
  duration: integer("duration").notNull().default(0),
  fileSize: integer("file_size").notNull().default(0),
  filePath: text("file_path"),
  thumbnailPath: text("thumbnail_path"),
  status: text("status").notNull().default('recording'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const insertVideoRecordingSchema = createInsertSchema(videoRecordings).omit({
  id: true,
  createdAt: true,
  endedAt: true,
});

export type InsertVideoRecording = z.infer<typeof insertVideoRecordingSchema>;
export type VideoRecording = typeof videoRecordings.$inferSelect;

// Failsafe Events - Log safety-critical events
export const failsafeEvents = pgTable("failsafe_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default('warning'),
  message: text("message").notNull(),
  sensorData: jsonb("sensor_data").$type<Record<string, unknown>>(),
  resolved: integer("resolved").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertFailsafeEventSchema = createInsertSchema(failsafeEvents).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export type InsertFailsafeEvent = z.infer<typeof insertFailsafeEventSchema>;
export type FailsafeEvent = typeof failsafeEvents.$inferSelect;

// Sync Records - Track cloud synchronization
export const syncRecords = pgTable("sync_records", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  syncDirection: text("sync_direction").notNull(),
  syncStatus: text("sync_status").notNull().default('pending'),
  cloudId: text("cloud_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSyncRecordSchema = createInsertSchema(syncRecords).omit({
  id: true,
  createdAt: true,
});

export type InsertSyncRecord = z.infer<typeof insertSyncRecordSchema>;
export type SyncRecord = typeof syncRecords.$inferSelect;

// Failsafe configuration types
export interface FailsafeConfig {
  signalLossThreshold: number;
  batteryLowThreshold: number;
  batteryCriticalThreshold: number;
  obstacleFrontThreshold: number;
  obstacleSideThreshold: number;
  gpsLossTimeout: number;
  imuDriftThreshold: number;
  motorOverheatThreshold: number;
  emergencyStopEnabled: boolean;
  returnToHomeEnabled: boolean;
}

export interface FailsafeTrigger {
  type: 'signal_loss' | 'battery_low' | 'battery_critical' | 'obstacle_detected' | 
        'gps_loss' | 'imu_drift' | 'motor_overheat' | 'manual_estop' | 'geofence_breach';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  action: 'alert' | 'reduce_speed' | 'stop' | 'return_home' | 'emergency_stop';
  message: string;
}
