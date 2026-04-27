"""Run: python -m src.database.seed"""
import asyncio
import asyncpg
import bcrypt
from src.config.settings import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


async def seed():
    conn = await asyncpg.connect(
        host=settings.DB_HOST, port=settings.DB_PORT,
        database=settings.DB_NAME, user=settings.DB_USER, password=settings.DB_PASSWORD,
    )
    try:
        async with conn.transaction():
            print("Seeding buses...")
            bus_ids = await conn.fetch("""
                INSERT INTO buses (bus_number, registration_number, capacity, bus_type, status) VALUES
                ('PB-01','PB-10-A-1234',40,'standard','active'),
                ('PB-02','PB-10-B-5678',40,'standard','active'),
                ('PB-03','PB-10-C-9012',50,'ac','active'),
                ('PB-04','PB-10-D-3456',40,'standard','active'),
                ('PB-05','PB-10-E-7890',35,'electric','active')
                ON CONFLICT DO NOTHING RETURNING id
            """)

            print("Seeding drivers...")
            driver_ids = await conn.fetch("""
                INSERT INTO drivers (name, phone, license_number, status) VALUES
                ('Rajesh Kumar','9876543210','DL-PB-2020-001234','active'),
                ('Suresh Singh','9876543211','DL-PB-2019-005678','active'),
                ('Amit Sharma','9876543212','DL-PB-2021-009012','active'),
                ('Vikram Patel','9876543213','DL-PB-2020-003456','active'),
                ('Harpreet Kaur','9876543214','DL-PB-2022-007890','active')
                ON CONFLICT DO NOTHING RETURNING id
            """)

            print("Seeding routes...")
            route_ids = await conn.fetch("""
                INSERT INTO routes (route_number, route_name, start_point, end_point, total_distance, estimated_duration, is_active) VALUES
                ('R-101','City Center to Railway Station','City Center','Railway Station',12.5,35,true),
                ('R-102','Bus Stand to University','Bus Stand','Punjab University',8.3,25,true),
                ('R-103','Airport to Mall Road','Airport','Mall Road',15.7,45,true)
                ON CONFLICT DO NOTHING RETURNING id
            """)

            print("Seeding bus stops...")
            stop_ids = await conn.fetch("""
                INSERT INTO bus_stops (stop_name, stop_code, latitude, longitude, address, landmark) VALUES
                ('City Center','CC-01',30.7333,76.7794,'Sector 17, Chandigarh','Near Plaza'),
                ('Sector 22','S22-01',30.7290,76.7850,'Sector 22, Chandigarh','Market Area'),
                ('ISBT 43','ISBT-43',30.7200,76.8000,'Sector 43, Chandigarh','Bus Terminal'),
                ('Sector 35','S35-01',30.7150,76.8100,'Sector 35, Chandigarh','Shopping Complex'),
                ('Railway Station','RS-01',30.7050,76.8200,'Railway Station Road','Main Entrance'),
                ('Bus Stand','BS-01',30.7400,76.7700,'Main Bus Stand','City Bus Stand'),
                ('Sector 14','S14-01',30.7450,76.7750,'Sector 14, Chandigarh','Market'),
                ('Panjab University','PU-01',30.7600,76.7700,'University Campus','Main Gate'),
                ('Airport','AP-01',30.6735,76.7885,'Chandigarh Airport','Terminal'),
                ('Sector 8','S8-01',30.7400,76.7900,'Sector 8, Chandigarh','Market'),
                ('Mall Road','MR-01',30.7500,76.8000,'Mall Road','Shopping District')
                ON CONFLICT DO NOTHING RETURNING id
            """)

            # Fetch actual IDs from DB
            routes = await conn.fetch("SELECT id FROM routes ORDER BY id")
            stops = await conn.fetch("SELECT id FROM bus_stops ORDER BY id")

            if len(routes) >= 3 and len(stops) >= 11:
                r1, r2, r3 = routes[0]['id'], routes[1]['id'], routes[2]['id']
                s = [row['id'] for row in stops]

                print("Mapping stops to routes...")
                await conn.execute("""
                    INSERT INTO route_stops (route_id, stop_id, stop_sequence, distance_from_start, estimated_time_from_start)
                    VALUES ($1,$2,1,0,0),($1,$3,2,2.5,7),($1,$4,3,5.0,14),($1,$5,4,8.5,24),($1,$6,5,12.5,35),
                           ($7,$8,1,0,0),($7,$9,2,3.0,10),($7,$10,3,8.3,25),
                           ($11,$12,1,0,0),($11,$13,2,7.5,20),($11,$14,3,15.7,45)
                    ON CONFLICT DO NOTHING
                """, r1, s[0], s[1], s[2], s[3], s[4],
                     r2, s[5], s[6], s[7],
                     r3, s[8], s[9], s[10])

                print("Creating trips...")
                from datetime import datetime, timedelta, timezone
                now = datetime.now(timezone.utc)
                future = now + timedelta(minutes=30)
                buses = await conn.fetch("SELECT id FROM buses ORDER BY id")
                drivers = await conn.fetch("SELECT id FROM drivers ORDER BY id")

                await conn.execute("""
                    INSERT INTO trips (bus_id, driver_id, route_id, trip_status, scheduled_start_time, actual_start_time, current_stop_id)
                    VALUES ($1,$2,$3,'active',$4,$4,$5),
                           ($6,$7,$8,'active',$4,$4,$9),
                           ($10,$11,$12,'scheduled',$13,NULL,NULL)
                    ON CONFLICT DO NOTHING
                """, buses[0]['id'], drivers[0]['id'], r1, now, s[1],
                     buses[1]['id'], drivers[1]['id'], r2, s[6],
                     buses[2]['id'], drivers[2]['id'], r3, future)

            print("Creating users...")
            hashed = hash_password("admin123")
            await conn.execute("""
                INSERT INTO users (name, email, phone, password_hash, user_type) VALUES
                ('Admin User','admin@bustransit.gov.in','9999999999',$1,'admin'),
                ('Test Commuter','user@example.com','8888888888',$1,'commuter')
                ON CONFLICT DO NOTHING
            """, hashed)

        print("✓ Database seeded successfully")
        print("\n=== Test Credentials ===")
        print("Admin: phone=9999999999, password=admin123")
        print("User:  phone=8888888888, password=admin123")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
