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
    
    def plan_route(self, optimize: bool = True) -> List[GPSPoint]:
        """
        Plan optimal route through waypoints using TSP solver (Nearest Neighbor heuristic)
        
        Args:
            optimize: If True, use TSP solver. If False, keep original order.
        """
        if not self.waypoints:
            return []
        
        if not optimize or len(self.waypoints) <= 2:
            self.route = self.waypoints.copy()
            return self.route
        
        # TSP Solver using Nearest Neighbor heuristic
        self.route = self._solve_tsp_nearest_neighbor(self.waypoints)
        return self.route
    
    def _solve_tsp_nearest_neighbor(self, waypoints: List[GPSPoint]) -> List[GPSPoint]:
        """
        Solve TSP using Nearest Neighbor heuristic
        Finds a reasonably short path by always visiting the nearest unvisited waypoint
        """
        if len(waypoints) <= 1:
            return waypoints.copy()
        
        # Start with first waypoint (usually origin/start point)
        unvisited = waypoints[1:].copy()
        route = [waypoints[0]]
        current = waypoints[0]
        
        while unvisited:
            # Find nearest unvisited waypoint
            nearest = min(unvisited, key=lambda wp: current.distance_to(wp))
            route.append(nearest)
            unvisited.remove(nearest)
            current = nearest
        
        return route
    
    def _solve_tsp_2opt(self, route: List[GPSPoint], max_iterations: int = 100) -> List[GPSPoint]:
        """
        Improve TSP solution using 2-opt optimization
        Repeatedly removes crossing edges to shorten the route
        """
        if len(route) <= 3:
            return route
        
        improved = True
        iterations = 0
        best_route = route.copy()
        
        while improved and iterations < max_iterations:
            improved = False
            iterations += 1
            
            for i in range(1, len(best_route) - 2):
                for j in range(i + 1, len(best_route)):
                    if j - i == 1:
                        continue
                    
                    # Calculate improvement from 2-opt swap
                    d1 = best_route[i-1].distance_to(best_route[i]) + \
                         best_route[j-1].distance_to(best_route[j] if j < len(best_route) else best_route[0])
                    d2 = best_route[i-1].distance_to(best_route[j-1]) + \
                         best_route[i].distance_to(best_route[j] if j < len(best_route) else best_route[0])
                    
                    if d2 < d1:
                        # Reverse the segment between i and j-1
                        best_route[i:j] = reversed(best_route[i:j])
                        improved = True
        
        return best_route
    
    def optimize_route(self) -> List[GPSPoint]:
        """
        Further optimize existing route using 2-opt
        Call this after plan_route() for additional optimization
        """
        if len(self.route) > 3:
            self.route = self._solve_tsp_2opt(self.route)
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
        
        # Dynamic throttle based on distance and heading error
        distance = current_position.distance_to(target)
        throttle = self._calculate_dynamic_throttle(distance, abs(heading_error))
        
        return (throttle, steering)
    
    def _calculate_dynamic_throttle(self, distance: float, heading_error: float,
                                    max_throttle: int = 100, min_throttle: int = 30) -> int:
        """
        Calculate dynamic throttle based on distance to target and heading error
        
        - Slow down when approaching waypoint (distance < 10m)
        - Slow down when need to turn sharply (heading error > 45°)
        - Full speed when far away and on course
        """
        # Distance-based throttle reduction
        if distance < 2:
            distance_factor = 0.3  # Very close - creep speed
        elif distance < 5:
            distance_factor = 0.5  # Close - slow speed
        elif distance < 10:
            distance_factor = 0.7  # Approaching - reduced speed
        else:
            distance_factor = 1.0  # Far - full speed
        
        # Heading error-based throttle reduction
        if heading_error > 90:
            heading_factor = 0.3  # Need major turn - very slow
        elif heading_error > 45:
            heading_factor = 0.5  # Need significant turn - slow
        elif heading_error > 20:
            heading_factor = 0.7  # Need moderate turn - reduced
        else:
            heading_factor = 1.0  # On course - full speed
        
        # Calculate final throttle
        throttle = int(max_throttle * min(distance_factor, heading_factor))
        throttle = max(min_throttle, min(max_throttle, throttle))
        
        return throttle
    
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
    """Advanced obstacle avoidance using ultrasonic and LIDAR sensors"""
    
    # Threshold constants
    EMERGENCY_THRESHOLD = 15  # cm - emergency stop
    CLOSE_THRESHOLD = 30      # cm - significant slowdown
    CAUTION_THRESHOLD = 60    # cm - reduce speed
    
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
        front_left = ultrasonic_readings[1] if len(ultrasonic_readings) > 1 else 999
        front_right = ultrasonic_readings[2] if len(ultrasonic_readings) > 2 else 999
        
        if front < ObstacleAvoidance.EMERGENCY_THRESHOLD:
            return True, "EMERGENCY_FRONT"
        elif front < threshold:
            return True, "OBSTACLE_FRONT"
        elif front_left < threshold or front_right < threshold:
            return True, "OBSTACLE_SIDE"
        
        return False, "CLEAR"
    
    @staticmethod
    def get_obstacle_map(ultrasonic_readings: List[int]) -> dict:
        """
        Generate detailed obstacle map from sensor readings
        Returns obstacle status for each direction
        """
        sensor_names = ['front', 'front_left', 'front_right', 'rear_left', 'rear_right']
        obstacle_map = {}
        
        for i, name in enumerate(sensor_names):
            if i < len(ultrasonic_readings):
                distance = ultrasonic_readings[i]
                if distance < ObstacleAvoidance.EMERGENCY_THRESHOLD:
                    status = 'emergency'
                elif distance < ObstacleAvoidance.CLOSE_THRESHOLD:
                    status = 'close'
                elif distance < ObstacleAvoidance.CAUTION_THRESHOLD:
                    status = 'caution'
                else:
                    status = 'clear'
                
                obstacle_map[name] = {
                    'distance': distance,
                    'status': status
                }
        
        return obstacle_map
    
    @staticmethod
    def get_avoidance_command(ultrasonic_readings: List[int], 
                              lidar_distance: int = 999,
                              current_throttle: int = 70,
                              current_steering: int = 0) -> Tuple[int, int, str]:
        """
        Calculate avoidance maneuver with throttle and steering adjustments
        
        Returns: (throttle, steering, action_description)
        """
        front = ultrasonic_readings[0]
        left = min(ultrasonic_readings[1], ultrasonic_readings[3]) if len(ultrasonic_readings) > 3 else 999
        right = min(ultrasonic_readings[2], ultrasonic_readings[4]) if len(ultrasonic_readings) > 4 else 999
        
        # Use LIDAR for front distance if available and closer
        front_combined = min(front, lidar_distance)
        
        # Emergency stop
        if front_combined < ObstacleAvoidance.EMERGENCY_THRESHOLD:
            return (0, 0, "EMERGENCY_STOP")
        
        # Close obstacle - significant slowdown and avoidance
        if front_combined < ObstacleAvoidance.CLOSE_THRESHOLD:
            throttle = max(20, current_throttle // 3)
            
            # Determine best escape direction
            if left > right + 20:
                steering = -80  # Sharp left
                action = "AVOID_LEFT_SHARP"
            elif right > left + 20:
                steering = 80   # Sharp right
                action = "AVOID_RIGHT_SHARP"
            else:
                # Backup if both sides blocked
                throttle = -30
                steering = 50 if right > left else -50
                action = "BACKUP_AND_TURN"
            
            return (throttle, steering, action)
        
        # Caution zone - reduce speed and gentle avoidance
        if front_combined < ObstacleAvoidance.CAUTION_THRESHOLD:
            throttle = max(40, int(current_throttle * 0.6))
            
            if left > right + 10:
                steering = max(-50, current_steering - 30)
                action = "ADJUST_LEFT"
            elif right > left + 10:
                steering = min(50, current_steering + 30)
                action = "ADJUST_RIGHT"
            else:
                steering = current_steering
                action = "SLOW_CAUTION"
            
            return (throttle, steering, action)
        
        # Clear path
        return (current_throttle, current_steering, "CLEAR")
    
    @staticmethod
    def get_avoidance_steering(ultrasonic_readings: List[int]) -> int:
        """
        Get steering adjustment to avoid obstacle
        Returns steering delta (-100 to 100)
        """
        left = min(ultrasonic_readings[1], ultrasonic_readings[3]) if len(ultrasonic_readings) > 3 else 999
        right = min(ultrasonic_readings[2], ultrasonic_readings[4]) if len(ultrasonic_readings) > 4 else 999
        
        # Calculate proportional steering based on free space
        if left > right:
            diff = left - right
            steering = max(-80, -int(diff / 2))  # Steer left
        else:
            diff = right - left
            steering = min(80, int(diff / 2))    # Steer right
        
        return steering
    
    @staticmethod
    def calculate_safe_speed(obstacle_map: dict, max_speed: int = 100) -> int:
        """
        Calculate maximum safe speed based on obstacle proximity
        """
        min_front_distance = 999
        
        for direction in ['front', 'front_left', 'front_right']:
            if direction in obstacle_map:
                min_front_distance = min(min_front_distance, obstacle_map[direction]['distance'])
        
        if min_front_distance < ObstacleAvoidance.EMERGENCY_THRESHOLD:
            return 0
        elif min_front_distance < ObstacleAvoidance.CLOSE_THRESHOLD:
            return max_speed // 4
        elif min_front_distance < ObstacleAvoidance.CAUTION_THRESHOLD:
            return max_speed // 2
        else:
            return max_speed
    
    @staticmethod
    def get_lidar_360_obstacle_map(lidar_sectors: list) -> dict:
        """
        Generate obstacle map from 360° LIDAR sector data
        
        Args:
            lidar_sectors: List of dicts with 'start_angle', 'end_angle', 'min_distance', 'avg_distance'
        
        Returns: Obstacle map with directional zones
        """
        NO_OBSTACLE = 12000
        
        sector_map = {
            'front': {'angles': (337.5, 22.5), 'distance': NO_OBSTACLE, 'status': 'clear'},
            'front_right': {'angles': (22.5, 67.5), 'distance': NO_OBSTACLE, 'status': 'clear'},
            'right': {'angles': (67.5, 112.5), 'distance': NO_OBSTACLE, 'status': 'clear'},
            'rear_right': {'angles': (112.5, 157.5), 'distance': NO_OBSTACLE, 'status': 'clear'},
            'rear': {'angles': (157.5, 202.5), 'distance': NO_OBSTACLE, 'status': 'clear'},
            'rear_left': {'angles': (202.5, 247.5), 'distance': NO_OBSTACLE, 'status': 'clear'},
            'left': {'angles': (247.5, 292.5), 'distance': NO_OBSTACLE, 'status': 'clear'},
            'front_left': {'angles': (292.5, 337.5), 'distance': NO_OBSTACLE, 'status': 'clear'},
        }
        
        for sector in lidar_sectors:
            center_angle = (sector['start_angle'] + sector['end_angle']) / 2
            min_dist = sector.get('min_distance')
            
            if min_dist is None or min_dist < 10:
                continue
            
            for zone_name, zone_data in sector_map.items():
                start, end = zone_data['angles']
                
                if start > end:
                    in_zone = center_angle >= start or center_angle < end
                else:
                    in_zone = start <= center_angle < end
                
                if in_zone and min_dist < zone_data['distance']:
                    zone_data['distance'] = min_dist
                    
                    if min_dist < ObstacleAvoidance.EMERGENCY_THRESHOLD * 10:
                        zone_data['status'] = 'emergency'
                    elif min_dist < ObstacleAvoidance.CLOSE_THRESHOLD * 10:
                        zone_data['status'] = 'close'
                    elif min_dist < ObstacleAvoidance.CAUTION_THRESHOLD * 10:
                        zone_data['status'] = 'caution'
        
        return sector_map
    
    @staticmethod
    def get_avoidance_from_lidar_360(lidar_sectors: list,
                                      current_throttle: int = 70,
                                      current_steering: int = 0) -> tuple:
        """
        Calculate avoidance maneuver using full 360° LIDAR scan
        
        Args:
            lidar_sectors: Sector data from YDLIDAR T-mini Plus
            current_throttle: Current throttle value
            current_steering: Current steering value
        
        Returns: (throttle, steering, action_description)
        """
        obstacle_map = ObstacleAvoidance.get_lidar_360_obstacle_map(lidar_sectors)
        
        front = obstacle_map['front']['distance']
        front_left = obstacle_map['front_left']['distance']
        front_right = obstacle_map['front_right']['distance']
        left = obstacle_map['left']['distance']
        right = obstacle_map['right']['distance']
        
        emergency_mm = ObstacleAvoidance.EMERGENCY_THRESHOLD * 10
        close_mm = ObstacleAvoidance.CLOSE_THRESHOLD * 10
        caution_mm = ObstacleAvoidance.CAUTION_THRESHOLD * 10
        
        front_min = min(front, front_left, front_right)
        
        if front_min < emergency_mm:
            return (0, 0, "LIDAR_EMERGENCY_STOP")
        
        if front_min < close_mm:
            throttle = max(20, current_throttle // 3)
            
            left_space = (front_left + left) / 2
            right_space = (front_right + right) / 2
            
            if left_space > right_space + 200:
                steering = -80
                action = "LIDAR_AVOID_LEFT"
            elif right_space > left_space + 200:
                steering = 80
                action = "LIDAR_AVOID_RIGHT"
            else:
                throttle = -30
                steering = 50 if right_space > left_space else -50
                action = "LIDAR_BACKUP"
            
            return (throttle, steering, action)
        
        if front_min < caution_mm:
            throttle = max(40, int(current_throttle * 0.6))
            
            left_space = (front_left + left) / 2
            right_space = (front_right + right) / 2
            
            if left_space > right_space + 100:
                steering = max(-50, current_steering - 25)
                action = "LIDAR_ADJUST_LEFT"
            elif right_space > left_space + 100:
                steering = min(50, current_steering + 25)
                action = "LIDAR_ADJUST_RIGHT"
            else:
                steering = current_steering
                action = "LIDAR_SLOW"
            
            return (throttle, steering, action)
        
        return (current_throttle, current_steering, "LIDAR_CLEAR")
    
    @staticmethod
    def find_best_escape_direction(lidar_sectors: list) -> tuple:
        """
        Find the best direction to escape from obstacles using 360° LIDAR
        
        Returns: (best_angle, max_distance)
        """
        best_angle = 0
        max_distance = 0
        
        for sector in lidar_sectors:
            avg_dist = sector.get('avg_distance', 0)
            if avg_dist > max_distance:
                max_distance = avg_dist
                best_angle = (sector['start_angle'] + sector['end_angle']) / 2
        
        return (best_angle, max_distance)


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
