
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
    JSON,
)
from sqlalchemy.sql import func

from database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)

    registration_number = Column(
        String(30),
        unique=True,
        nullable=False,
    )

    model = Column(String(100), nullable=True)
    status = Column(String(30), default="healthy")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)

    vehicle_id = Column(
        Integer,
        ForeignKey("vehicles.id"),
        nullable=False,
    )

    engine_temperature = Column(Float, nullable=False)
    rpm = Column(Integer, nullable=False)
    vibration = Column(Float, nullable=False)
    fuel_level = Column(Float, nullable=False)

    recorded_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )


class DiagnosticHistory(Base):
    __tablename__ = "diagnostic_history"

    id = Column(Integer, primary_key=True, index=True)

    vehicle_id = Column(
        Integer,
        ForeignKey("vehicles.id"),
        nullable=False,
    )

    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)

    source = Column(String(30), nullable=True)

    findings = Column(JSON, nullable=True)
    sensor_metrics = Column(JSON, nullable=True)

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )
