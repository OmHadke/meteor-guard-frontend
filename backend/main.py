from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import httpx, math
from typing import Optional

app = FastAPI(title="MeteorGuard API", version="0.1.0")

SBDB_QUERY = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"  # JPL SBDB Query[9]
SBDB_LOOKUP = "https://ssd-api.jpl.nasa.gov/sbdb.api"       # JPL SBDB Lookup[15]

class NeoSearchQuery(BaseModel):
    pha: bool = Field(False, description="Filter potentially hazardous (PHA)")
    limit: int = Field(20, ge=1, le=100)

class EntryParams(BaseModel):
    diameter_m: float = Field(..., gt=1)
    density_kg_m3: float = Field(3000, gt=100)
    velocity_kms: float = Field(..., gt=1)
    angle_deg: float = Field(..., gt=5, lt=90)
    composition: str = Field("stony", description="stony|iron|cometary")
    lat: float = Field(0, ge=-90, le=90)
    lon: float = Field(0, ge=-180, le=180)

@app.get("/health")
async def health():
    return {"ok": True}

@app.post("/neo/search")
async def neo_search(q: NeoSearchQuery):
    params = {
        "sb-kind": "ast",
        "fields": "des,shortname,spkid,diameter,albedo,pha",
        "limit": q.limit,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(SBDB_QUERY, params=params)
        r.raise_for_status()
        data = r.json()
    rows = data.get("data", [])
    out = []
    for row in rows:
        des, shortname, spkid, diameter, albedo, pha = row
        if q.pha and str(pha).lower() != "y":
            continue
        out.append({
            "des": des,
            "name": shortname,
            "spkid": spkid,
            "diameter": float(diameter) if diameter else None,
            "albedo": float(albedo) if albedo else None,
            "pha": pha
        })
        if len(out) >= q.limit:
            break
    return out

@app.get("/neo/detail/{des}")
async def neo_detail(des: str):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(SBDB_LOOKUP, params={"sstr": des, "phys-par": "1"})
        r.raise_for_status()
    return r.json()

@app.post("/simulate")
async def simulate(p: EntryParams):
    # Minimal kernel for demo: kinetic energy + naive overpressure scaling
    r = p.diameter_m / 2.0
    volume = 4.0/3.0 * math.pi * r**3
    mass = volume * p.density_kg_m3
    v = p.velocity_kms * 1000.0
    ke_j = 0.5 * mass * v * v
    e_kt = ke_j / 4.184e12  # kilotons TNT equivalent

    regime = "airburst" if (p.diameter_m < 50 and p.angle_deg < 45) else "impact"
    r_5psi = (e_kt ** (1.0/3.0)) * 1000.0
    r_1psi = r_5psi * 2.5

    return {
        "regime": regime,
        "e_kt": e_kt,
        "center": {"lat": p.lat, "lon": p.lon},
        "overpressure_radii_m": {"1psi": r_1psi, "5psi": r_5psi}
    }

# Optional: basic CORS for local dev
try:
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
except Exception:
    pass
