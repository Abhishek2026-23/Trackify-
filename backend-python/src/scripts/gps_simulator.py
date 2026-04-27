"""GPS simulator for testing. Run: python -m src.scripts.gps_simulator"""
import asyncio
import httpx
from src.config.settings import settings

API_URL = f"http://localhost:{settings.PORT}/api/v1"

ROUTE_COORDINATES = [
    {"lat": 30.7333, "lng": 76.7794},  # City Center
    {"lat": 30.7320, "lng": 76.7810},
    {"lat": 30.7290, "lng": 76.7850},  # Sector 22
    {"lat": 30.7250, "lng": 76.7920},
    {"lat": 30.7200, "lng": 76.8000},  # ISBT 43
    {"lat": 30.7180, "lng": 76.8050},
    {"lat": 30.7150, "lng": 76.8100},  # Sector 35
    {"lat": 30.7100, "lng": 76.8150},
    {"lat": 30.7050, "lng": 76.8200},  # Railway Station
]

index = 0


async def simulate():
    global index
    async with httpx.AsyncClient() as client:
        while True:
            coord = ROUTE_COORDINATES[index]
            payload = {
                "trip_id": 1,
                "bus_id": 1,
                "latitude": coord["lat"],
                "longitude": coord["lng"],
                "speed": 35 + (index % 5) * 2,
                "heading": 90,
                "accuracy": 5,
            }
            try:
                r = await client.post(f"{API_URL}/location/update", json=payload)
                print(f"✓ Location updated: {coord['lat']}, {coord['lng']} → {r.status_code}")
            except Exception as e:
                print(f"GPS simulation error: {e}")

            index = (index + 1) % len(ROUTE_COORDINATES)
            await asyncio.sleep(5)


if __name__ == "__main__":
    print("GPS Simulator started...")
    asyncio.run(simulate())
