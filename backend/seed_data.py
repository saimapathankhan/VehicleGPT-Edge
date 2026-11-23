
from database import SessionLocal
from models import Vehicle, SensorReading


def seed_data():
    db = SessionLocal()

    try:
        # Avoid inserting duplicate sample vehicles
        existing = db.query(Vehicle).filter(
            Vehicle.registration_number == "MH31AB1234"
        ).first()

        if existing:
            print("Sample data already exists!")
            return

        # Create sample vehicles
        vehicles = [
            Vehicle(
                name="Vehicle Alpha",
                registration_number="MH31AB1234",
                model="SUV",
                status="healthy",
            ),
            Vehicle(
                name="Vehicle Beta",
                registration_number="MH31CD5678",
                model="Sedan",
                status="healthy",
            ),
            Vehicle(
                name="Vehicle Gamma",
                registration_number="MH31EF9012",
                model="Hatchback",
                status="monitoring",
            ),
        ]

        db.add_all(vehicles)
        db.commit()

        for vehicle in vehicles:
            db.refresh(vehicle)

        # Demonstration sensor readings (simulated, not real vehicle data)
        readings = [
            SensorReading(
                vehicle_id=vehicles[0].id,
                engine_temperature=88.0,
                rpm=2200,
                vibration=0.25,
                fuel_level=72.0,
            ),
            SensorReading(
                vehicle_id=vehicles[1].id,
                engine_temperature=94.0,
                rpm=2500,
                vibration=0.30,
                fuel_level=54.0,
            ),
            SensorReading(
                vehicle_id=vehicles[2].id,
                engine_temperature=115.0,
                rpm=3100,
                vibration=0.85,
                fuel_level=35.0,
            ),
        ]

        db.add_all(readings)
        db.commit()

        print("Sample vehicles and sensor readings inserted successfully!")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
