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

# Bulk import endpoints
@app.post("/api/profiles/import/json")
def import_profiles_json(data: dict):
    """Import profiles from JSON array"""
    try:
        profiles_data = data.get("profiles", [])
        imported = []
        skipped = []
        
        for profile_data in profiles_data:
            # Check if ICCID already exists
            existing = profiles_collection.find_one({"iccid": profile_data.get("iccid")})
            if existing:
                skipped.append({"iccid": profile_data.get("iccid"), "reason": "Already exists"})
                continue
            
            # Create profile with UUID
            profile = Profile(**profile_data)
            profile_dict = profile.model_dump()
            result = profiles_collection.insert_one(profile_dict)
            profile_dict.pop('_id', None)
            imported.append(profile_dict)
        
        return {
            "success": True,
            "imported_count": len(imported),
            "skipped_count": len(skipped),
            "imported": imported,
            "skipped": skipped
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error importing profiles: {str(e)}")

@app.post("/api/profiles/import/csv")
async def import_profiles_csv(file: UploadFile = File(...)):
    """Import profiles from CSV file"""
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))
        
        imported = []
        skipped = []
        
        for row in csv_reader:
            # Check if ICCID already exists
            if not row.get('iccid'):
                skipped.append({"row": row, "reason": "Missing ICCID"})
                continue
                
            existing = profiles_collection.find_one({"iccid": row['iccid']})
            if existing:
                skipped.append({"iccid": row['iccid'], "reason": "Already exists"})
                continue
            
            # Create profile
            profile_data = {
                "name": row.get('name', 'Imported Profile'),
                "iccid": row['iccid'],
                "imsi": row.get('imsi', None),
                "ki": row.get('ki', None),
                "opc": row.get('opc', None),
                "standard": row.get('standard', 'SGP.22'),
                "status": row.get('status', 'disabled')
            }
            
            profile = Profile(**profile_data)
            profile_dict = profile.model_dump()
            result = profiles_collection.insert_one(profile_dict)
            profile_dict.pop('_id', None)
            imported.append(profile_dict)
        
        return {
            "success": True,
            "imported_count": len(imported),
            "skipped_count": len(skipped),
            "imported": imported,
            "skipped": skipped
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error importing CSV: {str(e)}")

@app.post("/api/profiles/scan")
def scan_profiles_text(data: dict):
    """Scan and parse profiles from text format"""
    try:
        text_data = data.get("text", "")
        profiles = []
        current_profile = {}
        
        lines = text_data.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                
                # Map common fields
                if key in ['name', 'profile name', 'profile_name']:
                    current_profile['name'] = value
                elif key in ['iccid', 'icc-id', 'icc_id']:
                    current_profile['iccid'] = value
                elif key in ['imsi']:
                    current_profile['imsi'] = value
                elif key in ['ki', 'key']:
                    current_profile['ki'] = value
                elif key in ['opc', 'op', 'operator code']:
                    current_profile['opc'] = value
                elif key in ['standard', 'spec', 'specification']:
                    current_profile['standard'] = value
                elif key in ['status', 'state']:
                    current_profile['status'] = value
            
            # Check if we have minimum required data
            if 'iccid' in current_profile and len(current_profile.get('iccid', '')) >= 19:
                if current_profile not in profiles:
                    profiles.append(current_profile.copy())
                    current_profile = {}
        
        # Add last profile if exists
        if 'iccid' in current_profile:
            profiles.append(current_profile)
        
        return {
            "success": True,
            "profiles_found": len(profiles),
            "profiles": profiles
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error scanning profiles: {str(e)}")

@app.post("/api/profiles/import/text")
def import_scanned_profiles(data: dict):
    """Import scanned profiles after preview"""
    try:
        profiles_data = data.get("profiles", [])
        imported = []
        skipped = []
        
        for profile_data in profiles_data:
            if not profile_data.get('iccid'):
                skipped.append({"data": profile_data, "reason": "Missing ICCID"})
                continue
            
            # Check if ICCID already exists
            existing = profiles_collection.find_one({"iccid": profile_data['iccid']})
            if existing:
                skipped.append({"iccid": profile_data['iccid'], "reason": "Already exists"})
                continue
            
            # Set defaults
            if 'name' not in profile_data:
                profile_data['name'] = f"Profile {profile_data['iccid'][:10]}"
            if 'standard' not in profile_data:
                profile_data['standard'] = 'SGP.22'
            if 'status' not in profile_data:
                profile_data['status'] = 'disabled'
            
            # Create profile
            profile = Profile(**profile_data)
            profile_dict = profile.model_dump()
            result = profiles_collection.insert_one(profile_dict)
            profile_dict.pop('_id', None)
            imported.append(profile_dict)
        
        return {
            "success": True,
            "imported_count": len(imported),
            "skipped_count": len(skipped),
            "imported": imported,
            "skipped": skipped
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error importing profiles: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
