"""
Google Maps Integration for Waypoint Navigation
Handles route optimization, ETA calculation, and directions
"""

import os
import json
from typing import List, Dict, Optional, Tuple
import requests

class GoogleMapsRouter:
    """Google Maps API integration for route planning"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Google Maps router
        api_key: Google Maps API key (from environment variable GOOGLE_MAPS_API_KEY)
        """
        self.api_key = api_key or os.environ.get('')
        self.base_url = "https://maps.googleapis.com/maps/api"
        self.enabled = bool(self.api_key)
    
    def get_directions(self, origin: Tuple[float, float], 
                      destination: Tuple[float, float],
                      waypoints: Optional[List[Tuple[float, float]]] = None,
                      optimize_route: bool = True) -> Dict:
        """
        Get directions from origin to destination via waypoints
        
        Args:
            origin: (lat, lng) tuple
            destination: (lat, lng) tuple
            waypoints: List of (lat, lng) tuples
            optimize_route: If True, optimize waypoint order
        
        Returns:
            Dictionary with route info, distance, duration, steps
        """
        if not self.enabled:
            return {
                'status': 'DISABLED',
                'message': 'Google Maps API key not configured',
                'fallback': True
            }
        
        # Format waypoints parameter
        waypoints_str = ""
        if waypoints:
            waypoints_str = "|".join([f"{lat},{lng}" for lat, lng in waypoints])
            if optimize_route:
                waypoints_str = f"optimize:true|{waypoints_str}"
        
        # Build request
        params = {
            'origin': f"{origin[0]},{origin[1]}",
            'destination': f"{destination[0]},{destination[1]}",
            'key': self.api_key,
            'mode': 'walking',  # Use walking for rover (slower, more realistic)
            'alternatives': False
        }
        
        if waypoints_str:
            params['waypoints'] = waypoints_str
        
        try:
            response = requests.get(
                f"{self.base_url}/directions/json",
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data['status'] == 'OK':
                    route = data['routes'][0]
                    
                    return {
                        'status': 'OK',
                        'distance': route['legs'][0]['distance']['value'],  # meters
                        'duration': route['legs'][0]['duration']['value'],   # seconds
                        'distance_text': route['legs'][0]['distance']['text'],
                        'duration_text': route['legs'][0]['duration']['text'],
                        'steps': self._parse_steps(route['legs'][0]['steps']),
                        'polyline': route['overview_polyline']['points'],
                        'bounds': route['bounds']
                    }
                else:
                    return {'status': data['status'], 'error': data.get('error_message')}
            else:
                return {'status': 'HTTP_ERROR', 'code': response.status_code}
        
        except Exception as e:
            return {'status': 'ERROR', 'message': str(e)}
    
    def get_geocode(self, lat: float, lng: float) -> Dict:
        """
        Get address from coordinates (reverse geocoding)
        """
        if not self.enabled:
            return {'status': 'DISABLED'}
        
        try:
            response = requests.get(
                f"{self.base_url}/geocode/json",
                params={
                    'latlng': f"{lat},{lng}",
                    'key': self.api_key
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'OK' and data['results']:
                    return {
                        'status': 'OK',
                        'address': data['results'][0]['formatted_address'],
                        'place_name': data['results'][0]['name'] if 'name' in data['results'][0] else ''
                    }
        except Exception as e:
            pass
        
        return {'status': 'NOT_FOUND'}
    
    def get_elevation(self, lat: float, lng: float) -> Dict:
        """
        Get elevation at coordinates
        """
        if not self.enabled:
            return {'status': 'DISABLED'}
        
        try:
            response = requests.get(
                f"{self.base_url}/elevation/json",
                params={
                    'locations': f"{lat},{lng}",
                    'key': self.api_key
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'OK' and data['results']:
                    return {
                        'status': 'OK',
                        'elevation': data['results'][0]['elevation'],
                        'resolution': data['results'][0]['resolution']
                    }
        except Exception as e:
            pass
        
        return {'status': 'NOT_FOUND'}
    
    @staticmethod
    def _parse_steps(steps: List[Dict]) -> List[Dict]:
        """Parse navigation steps from Google API"""
        parsed = []
        for step in steps:
            parsed.append({
                'instruction': step['html_instructions'],
                'distance': step['distance']['value'],
                'duration': step['duration']['value'],
                'start_location': step['start_location'],
                'end_location': step['end_location']
            })
        return parsed
    
    def calculate_eta(self, distance: float, avg_speed: float = 1.0) -> float:
        """
        Calculate ETA in seconds
        
        Args:
            distance: Distance in meters
            avg_speed: Average speed in m/s (default 1.0 m/s ≈ 3.6 km/h)
        
        Returns:
            Estimated time in seconds
        """
        if avg_speed <= 0:
            return 0
        return distance / avg_speed


class MapsVisualization:
    """Generate map URLs for embedding in dashboard"""
    
    @staticmethod
    def generate_static_map_url(center_lat: float, center_lng: float,
                               waypoints: Optional[List[Tuple[float, float]]] = None,
                               api_key: Optional[str] = None,
                               zoom: int = 15,
                               size: str = "400x400") -> str:
        """
        Generate Google Static Maps URL
        """
        if not api_key:
            api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
        
        url = f"https://maps.googleapis.com/maps/api/staticmap"
        url += f"?center={center_lat},{center_lng}"
        url += f"&zoom={zoom}"
        url += f"&size={size}"
        url += f"&key={api_key}"
        
        # Add markers for waypoints
        if waypoints:
            for i, (lat, lng) in enumerate(waypoints):
                marker_color = "red" if i == 0 else ("green" if i == len(waypoints) - 1 else "blue")
                url += f"&markers=color:{marker_color}|{lat},{lng}"
        
        return url
    
    @staticmethod
    def generate_embed_map_url(center_lat: float, center_lng: float,
                              waypoints: Optional[List[Tuple[float, float]]] = None,
                              api_key: Optional[str] = None,
                              zoom: int = 15) -> str:
        """
        Generate URL for embedded interactive map
        """
        if not api_key:
            api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
        
        waypoint_str = ""
        if waypoints:
            for i, (lat, lng) in enumerate(waypoints):
                waypoint_str += f"&q={lat},{lng}"
        
        url = f"https://maps.google.com/maps"
        url += f"?q={center_lat},{center_lng}"
        url += waypoint_str
        url += f"&z={zoom}"
        url += f"&output=embed"
        
        return url


# Example usage
if __name__ == "__main__":
    # Example with fallback (no API key)
    router = GoogleMapsRouter()
    
    if router.enabled:
        # Get directions with multiple waypoints
        origin = (34.0522, -118.2437)  # Los Angeles
        destination = (34.0530, -118.2445)
        waypoints = [(34.0525, -118.2435)]
        
        result = router.get_directions(origin, destination, waypoints)
        print("Route result:", json.dumps(result, indent=2))
        
        # Get elevation
        elevation = router.get_elevation(34.0522, -118.2437)
        print("Elevation:", elevation)
    else:
        print("Google Maps API not configured")
        print("Set GOOGLE_MAPS_API_KEY environment variable to enable")
