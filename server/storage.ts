import { 
  type User, 
  type InsertUser,
  type Route,
  type InsertRoute,
  type Waypoint,
  type InsertWaypoint,
  type TelemetryLog,
  type InsertTelemetryLog,
  type RoverConfig,
  type InsertRoverConfig,
  users,
  routes,
  waypoints,
  telemetryLogs,
  roverConfig
} from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Route methods
  getRoutes(): Promise<Route[]>;
  getRoute(id: number): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: number, route: Partial<InsertRoute>): Promise<Route | undefined>;
  deleteRoute(id: number): Promise<boolean>;
  
  // Waypoint methods
  getWaypoints(routeId: number): Promise<Waypoint[]>;
  getWaypoint(id: number): Promise<Waypoint | undefined>;
  createWaypoint(waypoint: InsertWaypoint): Promise<Waypoint>;
  createWaypoints(waypoints: InsertWaypoint[]): Promise<Waypoint[]>;
  updateWaypoint(id: number, waypoint: Partial<InsertWaypoint>): Promise<Waypoint | undefined>;
  deleteWaypoint(id: number): Promise<boolean>;
  deleteWaypointsByRoute(routeId: number): Promise<boolean>;
  
  // Telemetry methods
  createTelemetryLog(log: InsertTelemetryLog): Promise<TelemetryLog>;
  getTelemetryLogs(limit?: number): Promise<TelemetryLog[]>;
  getLatestTelemetry(): Promise<TelemetryLog | undefined>;
  
  // Config methods
  getConfig(key: string): Promise<RoverConfig | undefined>;
  setConfig(config: InsertRoverConfig): Promise<RoverConfig>;
  getAllConfig(): Promise<RoverConfig[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Route methods
  async getRoutes(): Promise<Route[]> {
    return await db.select().from(routes).orderBy(desc(routes.createdAt));
  }

  async getRoute(id: number): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    return route;
  }

  async createRoute(route: InsertRoute): Promise<Route> {
    const [newRoute] = await db.insert(routes).values(route).returning();
    return newRoute;
  }

  async updateRoute(id: number, route: Partial<InsertRoute>): Promise<Route | undefined> {
    const [updated] = await db
      .update(routes)
      .set({ ...route, updatedAt: new Date() })
      .where(eq(routes.id, id))
      .returning();
    return updated;
  }

  async deleteRoute(id: number): Promise<boolean> {
    const result = await db.delete(routes).where(eq(routes.id, id));
    return result.length > 0;
  }

  // Waypoint methods
  async getWaypoints(routeId: number): Promise<Waypoint[]> {
    return await db
      .select()
      .from(waypoints)
      .where(eq(waypoints.routeId, routeId))
      .orderBy(waypoints.order);
  }

  async getWaypoint(id: number): Promise<Waypoint | undefined> {
    const [waypoint] = await db.select().from(waypoints).where(eq(waypoints.id, id));
    return waypoint;
  }

  async createWaypoint(waypoint: InsertWaypoint): Promise<Waypoint> {
    const [newWaypoint] = await db.insert(waypoints).values(waypoint).returning();
    return newWaypoint;
  }

  async createWaypoints(waypointsData: InsertWaypoint[]): Promise<Waypoint[]> {
    if (waypointsData.length === 0) return [];
    return await db.insert(waypoints).values(waypointsData).returning();
  }

  async updateWaypoint(id: number, waypoint: Partial<InsertWaypoint>): Promise<Waypoint | undefined> {
    const [updated] = await db
      .update(waypoints)
      .set(waypoint)
      .where(eq(waypoints.id, id))
      .returning();
    return updated;
  }

  async deleteWaypoint(id: number): Promise<boolean> {
    const result = await db.delete(waypoints).where(eq(waypoints.id, id));
    return result.length > 0;
  }

  async deleteWaypointsByRoute(routeId: number): Promise<boolean> {
    const result = await db.delete(waypoints).where(eq(waypoints.routeId, routeId));
    return result.length > 0;
  }

  // Telemetry methods
  async createTelemetryLog(log: InsertTelemetryLog): Promise<TelemetryLog> {
    const [newLog] = await db.insert(telemetryLogs).values(log).returning();
    return newLog;
  }

  async getTelemetryLogs(limit: number = 100): Promise<TelemetryLog[]> {
    return await db
      .select()
      .from(telemetryLogs)
      .orderBy(desc(telemetryLogs.timestamp))
      .limit(limit);
  }

  async getLatestTelemetry(): Promise<TelemetryLog | undefined> {
    const [latest] = await db
      .select()
      .from(telemetryLogs)
      .orderBy(desc(telemetryLogs.timestamp))
      .limit(1);
    return latest;
  }

  // Config methods
  async getConfig(key: string): Promise<RoverConfig | undefined> {
    const [config] = await db.select().from(roverConfig).where(eq(roverConfig.key, key));
    return config;
  }

  async setConfig(config: InsertRoverConfig): Promise<RoverConfig> {
    const existing = await this.getConfig(config.key);
    
    if (existing) {
      const [updated] = await db
        .update(roverConfig)
        .set({ value: config.value, updatedAt: new Date() })
        .where(eq(roverConfig.key, config.key))
        .returning();
      return updated;
    } else {
      const [newConfig] = await db.insert(roverConfig).values(config).returning();
      return newConfig;
    }
  }

  async getAllConfig(): Promise<RoverConfig[]> {
    return await db.select().from(roverConfig);
  }
}

export const storage = new DatabaseStorage();
