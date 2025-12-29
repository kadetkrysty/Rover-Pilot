"""
Path Planning and Waypoint Navigation for Autonomous Rover
Implements Dijkstra's algorithm for optimal route planning
"""

import math
from typing import List, Tuple, Optional

class GPSPoint:
    """Represents a GPS coordinate"""
    def __init__(self, lat: float, lng: float, name: str = ""):
        self.lat = lat
        self.lng = lng
        self.name = name
    
    def distance_to(self, other: 'GPSPoint') -> float:
        """Calculate distance in meters using Haversine formula"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(self.lat)
        lat2_rad = math.radians(other.lat)
        dlat = math.radians(other.lat - self.lat)
        dlng = math.radians(other.lng - self.lng)
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def bearing_to(self, other: 'GPSPoint') -> float:
        """Calculate initial bearing (compass direction) in degrees (0-360)"""
        lat1_rad = math.radians(self.lat)
        lat2_rad = math.radians(other.lat)
        dlng = math.radians(other.lng - self.lng)
        
        x = math.sin(dlng) * math.cos(lat2_rad)
        y = math.cos(lat1_rad) * math.sin(lat2_rad) - \
            math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlng)
        
        bearing = math.degrees(math.atan2(x, y))
        return (bearing + 360) % 360
    
    def __repr__(self):
        return f"GPSPoint({self.lat:.6f}, {self.lng:.6f}, '{self.name}')"


class WaypointRouter:
    """Route planning and navigation controller"""
    
    def __init__(self):
        self.waypoints: List[GPSPoint] = []
        self.route: List[GPSPoint] = []
        self.current_waypoint_idx = 0
    
    def add_waypoint(self, lat: float, lng: float, name: str = "") -> None:
        """Add a waypoint to the mission"""
        point = GPSPoint(lat, lng, name)
        self.waypoints.append(point)
    
    def clear_waypoints(self) -> None:
        """Clear all waypoints"""
        self.waypoints = []
        self.route = []
        self.current_waypoint_idx = 0
    
    def plan_route(self) -> List[GPSPoint]:
        """
        Plan optimal route through waypoints using simplified algorithm
        For now, uses waypoint order as-is (can be enhanced with TSP solver)
        """
        if not self.waypoints:
            return []
        
        self.route = self.waypoints.copy()
        return self.route
    
    def get_total_distance(self) -> float:
        """Calculate total route distance in meters"""
        if len(self.route) < 2:
            return 0.0
        
        total = 0.0
        for i in range(len(self.route) - 1):
            total += self.route[i].distance_to(self.route[i + 1])
        return total
    
    def get_next_target(self, current_position: GPSPoint) -> Optional[GPSPoint]:
        """Get the next waypoint to navigate towards"""
        if self.current_waypoint_idx < len(self.route):
            return self.route[self.current_waypoint_idx]
        return None
    
    def update_current_position(self, current_position: GPSPoint, 
                               waypoint_threshold: float = 5.0) -> bool:
        """
        Update rover position and check if waypoint reached
        waypoint_threshold: distance in meters to consider waypoint reached
        Returns: True if waypoint reached
        """
        target = self.get_next_target(current_position)
        if not target:
            return False
        
        distance = current_position.distance_to(target)
        
        # Check if waypoint reached
        if distance < waypoint_threshold:
            self.current_waypoint_idx += 1
            return True  # Waypoint reached
        
        return False
    
    def get_navigation_command(self, current_position: GPSPoint, 
                               current_heading: float, max_steering: int = 100) -> Tuple[int, int]:
        """
        Calculate steering and throttle commands based on position and target
        
        Args:
            current_position: Current GPS position
            current_heading: Current compass heading (0-360°)
            max_steering: Maximum steering value (100)
        
        Returns:
            (throttle, steering) command tuple
        """
        target = self.get_next_target(current_position)
        if not target:
            return (0, 0)
        
        # Calculate bearing to target
        desired_bearing = current_position.bearing_to(target)
        
        # Calculate heading error
        heading_error = desired_bearing - current_heading
        
        # Normalize to -180 to +180
        if heading_error > 180:
            heading_error -= 360
        elif heading_error < -180:
            heading_error += 360
        
        # Simple proportional steering control
        steering = int((heading_error / 180.0) * max_steering)
        steering = max(-max_steering, min(max_steering, steering))
        
        # Throttle is always forward during waypoint navigation
        throttle = 70  # Fixed throttle (can be made dynamic based on distance)
        
        return (throttle, steering)
    
    def get_mission_progress(self) -> dict:
        """Get current mission progress stats"""
        total_dist = self.get_total_distance()
        completed_dist = 0.0
        
        if self.current_waypoint_idx > 0:
            for i in range(self.current_waypoint_idx - 1):
                if i + 1 < len(self.route):
                    completed_dist += self.route[i].distance_to(self.route[i + 1])
        
        progress = (completed_dist / total_dist * 100) if total_dist > 0 else 0
        
        return {
            'total_distance': total_dist,
            'completed_distance': completed_dist,
            'remaining_distance': total_dist - completed_dist,
            'progress_percent': progress,
            'current_waypoint': self.current_waypoint_idx + 1,
            'total_waypoints': len(self.route)
        }
    
    def get_route_info(self) -> List[dict]:
        """Get information about each leg of the route"""
        route_info = []
        
        for i in range(len(self.route) - 1):
            current = self.route[i]
            next_point = self.route[i + 1]
            distance = current.distance_to(next_point)
            bearing = current.bearing_to(next_point)
            
            route_info.append({
                'from': {'name': current.name, 'lat': current.lat, 'lng': current.lng},
                'to': {'name': next_point.name, 'lat': next_point.lat, 'lng': next_point.lng},
                'distance': distance,
                'bearing': bearing
            })
        
        return route_info


class ObstacleAvoidance:
    """Simple obstacle avoidance using ultrasonic sensors"""
    
    @staticmethod
    def check_obstacles(ultrasonic_readings: List[int], 
                       threshold: int = 30) -> Tuple[bool, str]:
        """
        Check if obstacles detected
        ultrasonic_readings: [front, front-left, front-right, rear-left, rear-right] in cm
        threshold: distance threshold in cm
        
        Returns: (obstacle_detected, description)
        """
        front = ultrasonic_readings[0]
        
        if front < threshold:
            return True, "OBSTACLE_FRONT"
        
        return False, "CLEAR"
    
    @staticmethod
    def get_avoidance_steering(ultrasonic_readings: List[int]) -> int:
        """
        Get steering adjustment to avoid obstacle
        Returns steering delta (-100 to 100)
        """
        left = min(ultrasonic_readings[1], ultrasonic_readings[3])
        right = min(ultrasonic_readings[2], ultrasonic_readings[4])
        
        if left > right:
            return -50  # Steer left
        else:
            return 50   # Steer right
        
        return 0


# Example usage
if __name__ == "__main__":
    # Create router
    router = WaypointRouter()
    
    # Add waypoints (Los Angeles example)
    router.add_waypoint(34.0522, -118.2437, "Start")
    router.add_waypoint(34.0525, -118.2435, "Checkpoint 1")
    router.add_waypoint(34.0528, -118.2440, "Checkpoint 2")
    router.add_waypoint(34.0530, -118.2445, "End")
    
    # Plan route
    route = router.plan_route()
    print(f"Route planned: {len(route)} waypoints")
    print(f"Total distance: {router.get_total_distance():.2f} meters")
    
    # Simulate navigation
    current_pos = GPSPoint(34.0522, -118.2437, "Current")
    current_heading = 45.0
    
    throttle, steering = router.get_navigation_command(current_pos, current_heading)
    print(f"Command: throttle={throttle}, steering={steering}")
    
    # Get progress
    progress = router.get_mission_progress()
    print(f"Progress: {progress['progress_percent']:.1f}%")
    
    # Get route info
    route_info = router.get_route_info()
    for leg in route_info:
        print(f"{leg['from']['name']} -> {leg['to']['name']}: {leg['distance']:.2f}m @ {leg['bearing']:.1f}°")
