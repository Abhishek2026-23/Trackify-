from geopy.distance import geodesic


def calculate_distance(coord1: dict, coord2: dict) -> float:
    """Return distance in meters between two lat/lng dicts."""
    return geodesic(
        (coord1["lat"], coord1["lng"]),
        (coord2["lat"], coord2["lng"])
    ).meters


def calculate_eta(distance_meters: float, speed_kmh: float) -> int:
    """Return ETA in minutes given distance (m) and speed (km/h)."""
    if speed_kmh <= 0:
        speed_kmh = 30  # default city speed
    time_hours = (distance_meters / 1000) / speed_kmh
    return round(time_hours * 60)


def is_near_stop(bus_location: dict, stop_location: dict, threshold_meters: float = 100) -> bool:
    return calculate_distance(bus_location, stop_location) <= threshold_meters
