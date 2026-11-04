CREATE TABLE "failsafe_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"sensor_data" jsonb,
	"resolved" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "fused_telemetry" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"theta" real NOT NULL,
	"velocity" real NOT NULL,
	"angular_velocity" real NOT NULL,
	"covariance_matrix" jsonb NOT NULL,
	"gps_latitude" real,
	"gps_longitude" real,
	"gps_accuracy" real,
	"imu_heading" real,
	"imu_pitch" real,
	"imu_roll" real,
	"lidar_distance" integer,
	"lidar_angle" real,
	"ultrasonic_distances" jsonb,
	"fusion_confidence" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_tiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"tile_x" integer NOT NULL,
	"tile_y" integer NOT NULL,
	"data" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupancy_maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"resolution" real NOT NULL,
	"origin_x" real NOT NULL,
	"origin_y" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"total_distance" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rover_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rover_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sync_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"sync_direction" text NOT NULL,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"cloud_id" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"speed" real NOT NULL,
	"battery" real NOT NULL,
	"heading" real NOT NULL,
	"pitch" real NOT NULL,
	"roll" real NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"lidar_distance" integer NOT NULL,
	"ultrasonic_distances" jsonb NOT NULL,
	"mode" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "video_recordings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"route_id" integer,
	"duration" integer DEFAULT 0 NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"file_path" text,
	"thumbnail_path" text,
	"status" text DEFAULT 'recording' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "waypoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"route_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "map_tiles" ADD CONSTRAINT "map_tiles_map_id_occupancy_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."occupancy_maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_recordings" ADD CONSTRAINT "video_recordings_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waypoints" ADD CONSTRAINT "waypoints_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;