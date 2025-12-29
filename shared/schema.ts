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
