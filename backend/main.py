
import os
from typing import Any

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from models import (
    Vehicle,
    SensorReading,
    DiagnosticHistory,
)


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="VehicleGPT Edge",
    description="Vehicle monitoring and diagnostics assistant",
    version="2.1.0",
)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# REQUEST MODEL
# --------------------------------------------------

class DiagnosticRequest(BaseModel):
    vehicle_id: int
    question: str = Field(
        default="Explain vehicle health.",
        max_length=1000,
    )


# --------------------------------------------------
# SAFE NUMBER CONVERSION
# --------------------------------------------------

def number(value: Any):
    """Convert database values into numbers safely."""

    try:
        if value is None:
            return None

        return float(value)

    except (ValueError, TypeError):
        return None


# --------------------------------------------------
# VEHICLE SENSOR ANALYSIS
# --------------------------------------------------

def analyze_vehicle(vehicle, readings):

    findings = []
    metrics = {}

    if not readings:
        return (
            [
                "No sensor readings are available for this vehicle. "
                "A sensor-based diagnosis cannot be confirmed yet."
            ],
            metrics,
        )

    latest = readings[0]

    temperature = number(latest.engine_temperature)
    rpm = number(latest.rpm)
    vibration = number(latest.vibration)
    fuel = number(latest.fuel_level)

    metrics = {
        "engine_temperature": temperature,
        "rpm": rpm,
        "vibration": vibration,
        "fuel_level": fuel,
        "recorded_at": (
            latest.recorded_at.isoformat()
            if latest.recorded_at
            else None
        ),
    }

    # ENGINE TEMPERATURE

    if temperature is not None:

        if temperature >= 110:
            findings.append(
                f"Critical engine temperature reading: {temperature:g}. "
                "Stop safely and arrange an urgent inspection."
            )

        elif temperature >= 100:
            findings.append(
                f"Engine temperature is high at {temperature:g}. "
                "Check the cooling system and monitor temperature."
            )

        else:
            findings.append(
                f"Engine temperature is {temperature:g}; "
                "this is not flagged as high by the current screening rule."
            )

    # RPM

    if rpm is not None:

        if rpm < 0:
            findings.append(
                "The RPM reading is invalid and needs sensor verification."
            )

        elif rpm > 5000:
            findings.append(
                f"RPM is elevated at {rpm:g}. "
                "Interpret this against the vehicle model and operating conditions."
            )

        else:
            findings.append(
                f"Recorded engine speed is {rpm:g} RPM."
            )

    # VIBRATION

    if vibration is not None:

        if vibration >= 1.0:
            findings.append(
                f"Vibration is elevated at {vibration:g}. "
                "Inspect mounting, tyres, and rotating components."
            )

        else:
            findings.append(
                f"Vibration reading is {vibration:g}; "
                "it is not flagged by the current screening threshold."
            )

    # FUEL LEVEL

    if fuel is not None:

        if fuel <= 10:
            findings.append(
                f"Fuel level is low at {fuel:g}%. "
                "Refuelling is recommended."
            )

        else:
            findings.append(
                f"Fuel level is {fuel:g}%."
            )

    if not findings:
        findings.append(
            "The latest readings do not contain enough valid numeric "
            "data for a meaningful sensor assessment."
        )

    return findings, metrics


# --------------------------------------------------
# RULE-BASED AI ANSWER
# --------------------------------------------------

def build_rule_based_answer(
    vehicle,
    question,
    findings,
    metrics,
    readings,
):

    q = question.lower()
    status = str(vehicle.status or "unknown").lower()

    if any(
        word in q
        for word in ["attention", "problem", "issue", "risk", "danger"]
    ):

        title = "Vehicle risk review"

        explanation = (
            "The following findings should be reviewed first. "
            "This is a preliminary screening, not a confirmed mechanical diagnosis."
        )

    elif any(
        word in q
        for word in ["fuel", "petrol", "diesel", "tank"]
    ):

        title = "Fuel review"

        fuel = metrics.get("fuel_level")

        explanation = (
            f"The latest recorded fuel level is {fuel:g}%."
            if fuel is not None
            else "No usable fuel-level reading is available."
        )

    elif any(
        word in q
        for word in ["temperature", "heat", "overheat", "engine hot"]
    ):

        title = "Engine temperature review"

        temp = metrics.get("engine_temperature")

        explanation = (
            f"The latest recorded engine temperature is {temp:g}."
            if temp is not None
            else "No usable engine-temperature reading is available."
        )

    elif any(
        word in q
        for word in ["vibration", "shaking", "noise"]
    ):

        vibration = metrics.get("vibration")

        title = "Vibration review"

        explanation = (
            f"The latest vibration reading is {vibration:g}."
            if vibration is not None
            else "No usable vibration reading is available."
        )

    elif any(
        word in q
        for word in ["rpm", "engine speed"]
    ):

        rpm = metrics.get("rpm")

        title = "Engine speed review"

        explanation = (
            f"The latest recorded RPM is {rpm:g}."
            if rpm is not None
            else "No usable RPM reading is available."
        )

    elif any(
        word in q
        for word in ["healthy", "health", "condition", "status", "explain"]
    ):

        title = "Vehicle health summary"

        explanation = (
            f"The database currently marks this vehicle as '{status}'. "
            "That label alone does not prove that every component is healthy."
        )

    else:

        title = "Vehicle diagnostic summary"

        explanation = (
            "I checked the vehicle's latest available sensor data. "
            "Here are the findings relevant to reviewing its condition."
        )

    findings_text = "\n".join(
        f"- {item}" for item in findings
    )

    if len(readings) > 1:

        history_note = (
            f"\nThe database contains {len(readings)} recent readings. "
            "Compare readings over time before concluding that a trend exists."
        )

    else:

        history_note = (
            "\nOnly one recent reading is available, "
            "so a trend cannot be established."
        )

    return (
        f"{title}\n\n"
        f"Vehicle: {vehicle.name}\n"
        f"Registration: {vehicle.registration_number}\n"
        f"Vehicle type: {vehicle.model}\n"
        f"Database status: {status}\n\n"
        f"{explanation}\n\n"
        f"Sensor findings:\n{findings_text}"
        f"{history_note}\n\n"
        "Recommended next step: verify unusual readings and compare them "
        "with the manufacturer's specifications. If a critical warning "
        "appears, stop safely and have the vehicle inspected. "
        "This software provides preliminary guidance, not a substitute "
        "for a qualified mechanic."
    )


# --------------------------------------------------
# OPENAI INTEGRATION
# --------------------------------------------------

def try_openai_answer(
    vehicle,
    question,
    findings,
    metrics,
    fallback,
):

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        return fallback, "rule_based"

    try:

        from openai import OpenAI

        client = OpenAI(api_key=api_key)

        response = client.responses.create(

            model=os.getenv(
                "OPENAI_MODEL",
                "gpt-4.1-mini",
            ),

            instructions=(
                "You are VehicleGPT Edge, a careful vehicle-health assistant. "
                "Answer the user's specific question using only the provided "
                "vehicle details and sensor readings. Explain the evidence, "
                "uncertainty, and practical next steps. Never invent readings, "
                "claim a component is faulty without evidence, or present "
                "threshold-based screening as a confirmed diagnosis. "
                "Use concise, clear language."
            ),

            input=(
                f"Vehicle name: {vehicle.name}\n"
                f"Registration: {vehicle.registration_number}\n"
                f"Vehicle type: {vehicle.model}\n"
                f"Database status: {vehicle.status}\n"
                f"Latest sensor metrics: {metrics}\n"
                f"Analysis findings: {findings}\n"
                f"User question: {question}\n\n"
                f"Fallback analysis for context:\n{fallback}"
            ),
        )

        answer = (response.output_text or "").strip()

        if answer:
            return answer, "openai"

        return fallback, "rule_based"

    except Exception:

        # Use fallback if OpenAI is unavailable.

        return fallback, "rule_based"


# --------------------------------------------------
# HOME API
# --------------------------------------------------

@app.get("/")
def home():

    return {
        "message": "Welcome to VehicleGPT Edge",
        "status": "running",
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health_check():

    return {
        "status": "healthy",
        "application": "VehicleGPT Edge",
    }


# --------------------------------------------------
# GET ALL VEHICLES
# --------------------------------------------------

@app.get("/vehicles")
def get_vehicles(db: Session = Depends(get_db)):

    vehicles = (
        db.query(Vehicle)
        .order_by(Vehicle.id)
        .all()
    )

    return [
        {
            "id": vehicle.id,
            "name": vehicle.name,
            "registration_number": vehicle.registration_number,
            "model": vehicle.model,
            "status": vehicle.status,
        }
        for vehicle in vehicles
    ]


# --------------------------------------------------
# GET SINGLE VEHICLE
# --------------------------------------------------

@app.get("/vehicles/{vehicle_id}")
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
):

    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id)
        .first()
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    return {
        "id": vehicle.id,
        "name": vehicle.name,
        "registration_number": vehicle.registration_number,
        "model": vehicle.model,
        "status": vehicle.status,
    }


# --------------------------------------------------
# GET VEHICLE SENSOR READINGS
# --------------------------------------------------

@app.get("/vehicles/{vehicle_id}/readings")
def get_vehicle_readings(
    vehicle_id: int,
    db: Session = Depends(get_db),
):

    vehicle = (
        db.query(Vehicle.id)
        .filter(Vehicle.id == vehicle_id)
        .first()
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.vehicle_id == vehicle_id)
        .order_by(desc(SensorReading.recorded_at))
        .limit(100)
        .all()
    )

    return [
        {
            "id": reading.id,
            "vehicle_id": reading.vehicle_id,
            "engine_temperature": reading.engine_temperature,
            "rpm": reading.rpm,
            "vibration": reading.vibration,
            "fuel_level": reading.fuel_level,
            "recorded_at": (
                reading.recorded_at.isoformat()
                if reading.recorded_at
                else None
            ),
        }
        for reading in readings
    ]


# --------------------------------------------------
# ANALYTICS SUMMARY
# --------------------------------------------------

@app.get("/analytics/summary")
def analytics_summary(db: Session = Depends(get_db)):

    return {
        "total_vehicles": db.query(Vehicle).count(),
        "total_sensor_readings": db.query(SensorReading).count(),
        "total_diagnostics": db.query(DiagnosticHistory).count(),
    }


# --------------------------------------------------
# AI VEHICLE DIAGNOSTICS
# --------------------------------------------------

@app.post("/ai/diagnostics")
def ai_diagnostics(
    payload: DiagnosticRequest,
    db: Session = Depends(get_db),
):

    # Find vehicle

    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == payload.vehicle_id)
        .first()
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    question = (
        payload.question.strip()
        or "Explain vehicle health."
    )

    # Fetch latest sensor readings

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.vehicle_id == payload.vehicle_id)
        .order_by(desc(SensorReading.recorded_at))
        .limit(5)
        .all()
    )

    # Analyze vehicle

    findings, metrics = analyze_vehicle(
        vehicle,
        readings,
    )

    # Generate fallback answer

    fallback = build_rule_based_answer(
        vehicle=vehicle,
        question=question,
        findings=findings,
        metrics=metrics,
        readings=readings,
    )

    # Generate AI answer

    answer, source = try_openai_answer(
        vehicle=vehicle,
        question=question,
        findings=findings,
        metrics=metrics,
        fallback=fallback,
    )

    # Save diagnostic history in MySQL

    diagnostic = DiagnosticHistory(
        vehicle_id=vehicle.id,
        question=question,
        answer=answer,
        source=source,
        findings=findings,
        sensor_metrics=metrics,
    )

    try:

        db.add(diagnostic)
        db.commit()
        db.refresh(diagnostic)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to save diagnostic history.",
        )

    return {
        "diagnostic_id": diagnostic.id,
        "answer": answer,
        "vehicle_id": vehicle.id,
        "vehicle_name": vehicle.name,
        "source": source,
        "sensor_metrics": metrics,
        "findings": findings,
        "saved": True,
    }


# --------------------------------------------------
# GET VEHICLE DIAGNOSTIC HISTORY
# --------------------------------------------------

@app.get("/vehicles/{vehicle_id}/diagnostics")
def get_diagnostic_history(
    vehicle_id: int,
    db: Session = Depends(get_db),
):

    vehicle = (
        db.query(Vehicle.id)
        .filter(Vehicle.id == vehicle_id)
        .first()
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    records = (
        db.query(DiagnosticHistory)
        .filter(DiagnosticHistory.vehicle_id == vehicle_id)
        .order_by(desc(DiagnosticHistory.created_at))
        .all()
    )

    return [
        {
            "id": record.id,
            "question": record.question,
            "answer": record.answer,
            "source": record.source,
            "findings": record.findings,
            "sensor_metrics": record.sensor_metrics,
            "created_at": (
                record.created_at.isoformat()
                if record.created_at
                else None
            ),
        }
        for record in records
    ]
