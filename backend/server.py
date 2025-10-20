from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os
import uuid
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
import base64
import json
import csv
import io

app = FastAPI(title="eUICC Profile Manager API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/euicc_db')
client = MongoClient(MONGO_URL)
db = client.euicc_db
profiles_collection = db.profiles
certificates_collection = db.certificates

# Models
class Profile(BaseModel):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    iccid: str
    imsi: Optional[str] = None
    ki: Optional[str] = None
    opc: Optional[str] = None
    status: str = "disabled"  # disabled, enabled
    standard: str = "SGP.22"  # SGP.21, SGP.22, SGP.01, SGP.02
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class Certificate(BaseModel):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    issuer: str
    subject: str
    serial_number: str
    not_before: str
    not_after: str
    key_id: Optional[str] = None
    crl_url: Optional[str] = None
    standard: Optional[str] = None
    pem_data: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    iccid: Optional[str] = None
    imsi: Optional[str] = None
    ki: Optional[str] = None
    opc: Optional[str] = None
    status: Optional[str] = None
    standard: Optional[str] = None

# Root endpoint
@app.get("/api")
def read_root():
    return {"message": "eUICC Profile Manager API", "version": "1.0.0"}

# Profile endpoints
@app.get("/api/profiles")
def get_profiles():
    profiles = list(profiles_collection.find({}, {"_id": 0}))
    return profiles

@app.get("/api/profiles/{profile_id}")
def get_profile(profile_id: str):
    profile = profiles_collection.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@app.post("/api/profiles")
def create_profile(profile: Profile):
    profile_dict = profile.model_dump()
    existing = profiles_collection.find_one({"iccid": profile.iccid})
    if existing:
        raise HTTPException(status_code=400, detail="Profile with this ICCID already exists")
    result = profiles_collection.insert_one(profile_dict)
    profile_dict.pop('_id', None)
    return profile_dict

@app.put("/api/profiles/{profile_id}")
def update_profile(profile_id: str, profile_update: ProfileUpdate):
    existing = profiles_collection.find_one({"id": profile_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    update_data = {k: v for k, v in profile_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    profiles_collection.update_one({"id": profile_id}, {"$set": update_data})
    updated = profiles_collection.find_one({"id": profile_id}, {"_id": 0})
    return updated

@app.delete("/api/profiles/{profile_id}")
def delete_profile(profile_id: str):
    result = profiles_collection.delete_one({"id": profile_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile deleted successfully"}

@app.post("/api/profiles/{profile_id}/enable")
def enable_profile(profile_id: str):
    existing = profiles_collection.find_one({"id": profile_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profiles_collection.update_one(
        {"id": profile_id},
        {"$set": {"status": "enabled", "updated_at": datetime.utcnow().isoformat()}}
    )
    updated = profiles_collection.find_one({"id": profile_id}, {"_id": 0})
    return updated

@app.post("/api/profiles/{profile_id}/disable")
def disable_profile(profile_id: str):
    existing = profiles_collection.find_one({"id": profile_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profiles_collection.update_one(
        {"id": profile_id},
        {"$set": {"status": "disabled", "updated_at": datetime.utcnow().isoformat()}}
    )
    updated = profiles_collection.find_one({"id": profile_id}, {"_id": 0})
    return updated

# Certificate endpoints
@app.get("/api/certificates")
def get_certificates():
    certs = list(certificates_collection.find({}, {"_id": 0}))
    return certs

@app.get("/api/certificates/{cert_id}")
def get_certificate(cert_id: str):
    cert = certificates_collection.find_one({"id": cert_id}, {"_id": 0})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return cert

@app.post("/api/certificates/parse")
def parse_certificate(data: dict):
    try:
        pem_data = data.get("pem_data", "")
        if not pem_data:
            raise HTTPException(status_code=400, detail="PEM data is required")
        
        # Parse the certificate
        cert_bytes = pem_data.encode('utf-8')
        cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())
        
        # Extract certificate information
        issuer = ", ".join([f"{attr.oid._name}={attr.value}" for attr in cert.issuer])
        subject = ", ".join([f"{attr.oid._name}={attr.value}" for attr in cert.subject])
        
        cert_info = {
            "issuer": issuer,
            "subject": subject,
            "serial_number": hex(cert.serial_number),
            "not_before": cert.not_valid_before_utc.isoformat(),
            "not_after": cert.not_valid_after_utc.isoformat(),
            "version": cert.version.value,
            "signature_algorithm": cert.signature_algorithm_oid._name,
        }
        
        return cert_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing certificate: {str(e)}")

@app.post("/api/certificates")
def create_certificate(certificate: Certificate):
    cert_dict = certificate.model_dump()
    result = certificates_collection.insert_one(cert_dict)
    cert_dict.pop('_id', None)
    return cert_dict

@app.delete("/api/certificates/{cert_id}")
def delete_certificate(cert_id: str):
    result = certificates_collection.delete_one({"id": cert_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {"message": "Certificate deleted successfully"}

# Statistics endpoint
@app.get("/api/stats")
def get_stats():
    total_profiles = profiles_collection.count_documents({})
    enabled_profiles = profiles_collection.count_documents({"status": "enabled"})
    disabled_profiles = profiles_collection.count_documents({"status": "disabled"})
    total_certificates = certificates_collection.count_documents({})
    
    return {
        "total_profiles": total_profiles,
        "enabled_profiles": enabled_profiles,
        "disabled_profiles": disabled_profiles,
        "total_certificates": total_certificates
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
