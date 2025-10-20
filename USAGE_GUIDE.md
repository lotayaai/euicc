# eUICC Profile Manager - Usage Guide

## Overview
The eUICC Profile Manager is a complete web-based solution for managing embedded SIM profiles and certificates according to GSMA standards.

## Access URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs

## Features

### 1. Dashboard
View system statistics and recent activity:
- Total profiles count
- Enabled/disabled profiles
- Certificate inventory
- Recent profiles overview

### 2. Profile Management

#### Creating a Profile
1. Navigate to the "Profiles" tab
2. Click "Create Profile"
3. Fill in the required fields:
   - **Profile Name**: Descriptive name for the profile
   - **ICCID**: 19-20 digit Integrated Circuit Card Identifier
   - **IMSI**: 15 digit International Mobile Subscriber Identity (optional)
   - **Ki**: 128-bit authentication key (optional)
   - **OPC**: 128-bit operator variant algorithm configuration field (optional)
   - **Standard**: Select from SGP.21, SGP.22, SGP.01, or SGP.02
4. Click "Create"

#### Managing Profiles
- **Enable/Disable**: Toggle profile status with the Enable/Disable button
- **Edit**: Modify profile details
- **Delete**: Remove profile from the system

### 3. Certificate Management

#### Adding a Certificate
1. Navigate to the "Certificates" tab
2. Click "Add Certificate"
3. Paste the PEM-formatted certificate data
4. Click "Parse Certificate" to auto-extract certificate details
5. Review and adjust the certificate information:
   - Certificate Name
   - Issuer
   - Subject
   - Serial Number
   - Key ID
   - Validity dates
   - CRL Distribution Point URL
   - Standard
6. Click "Save Certificate"

#### Viewing Certificates
- All certificates are displayed with complete details
- Click on the CRL URL to access the Certificate Revocation List
- Delete certificates using the Delete button

## API Endpoints

### Profile Endpoints
```bash
# List all profiles
curl http://localhost:8001/api/profiles

# Create a profile
curl -X POST http://localhost:8001/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Profile",
    "iccid": "89012345678901234567",
    "imsi": "310123456789012",
    "standard": "SGP.22"
  }'

# Enable a profile
curl -X POST http://localhost:8001/api/profiles/{profile_id}/enable

# Disable a profile
curl -X POST http://localhost:8001/api/profiles/{profile_id}/disable

# Delete a profile
curl -X DELETE http://localhost:8001/api/profiles/{profile_id}
```

### Certificate Endpoints
```bash
# List all certificates
curl http://localhost:8001/api/certificates

# Parse a certificate
curl -X POST http://localhost:8001/api/certificates/parse \
  -H "Content-Type: application/json" \
  -d '{"pem_data": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}'

# Add a certificate
curl -X POST http://localhost:8001/api/certificates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Certificate Name",
    "issuer": "...",
    "subject": "...",
    "serial_number": "...",
    "not_before": "2017-02-22T00:00:00Z",
    "not_after": "2052-02-21T23:59:59Z",
    "pem_data": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
  }'
```

### Statistics
```bash
# Get system statistics
curl http://localhost:8001/api/stats
```

## Supported Standards

### SGP.21
RSP Technical Specification v2 for consumer devices

### SGP.22
RSP Technical Specification v3 for consumer devices (latest)

### SGP.01
Embedded SIM Remote Provisioning Architecture for M2M

### SGP.02
Remote Provisioning Architecture for Embedded UICC Technical Specification (M2M)

## GSMA Certificate Issuers

The system supports management of certificates from recognized GSMA CIs:

### GSM Association - RSP2 Root CI1
- **CA**: DigiCert
- **Standards**: SGP.21, SGP.22 v2, v3
- **Key ID**: 81370f5125d0b1d408d4c3b232e6d25e795bebfb
- **Expires**: February 21, 2052
- **CRL**: http://gsma-crl.symauth.com/offlineca/gsma-rsp2-root-ci1.crl

### GSM Association - M2M31 Root CI2
- **CA**: Cybertrust
- **Standards**: SGP.01, SGP.02
- **Key ID**: d7a7d0c7c04ea76076e3f44faebde8779e2948d4
- **Expires**: March 15, 2052

## Service Management

### Start Services
```bash
sudo supervisorctl restart all
```

### Check Service Status
```bash
sudo supervisorctl status
```

### View Logs
```bash
# Backend logs
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/backend.err.log

# Frontend logs
tail -f /var/log/supervisor/frontend.out.log
tail -f /var/log/supervisor/frontend.err.log
```

## Development

### Backend (FastAPI)
- Location: `/app/backend/`
- Main file: `server.py`
- Dependencies: `requirements.txt`
- Hot reload enabled

### Frontend (React)
- Location: `/app/frontend/`
- Main component: `src/App.js`
- Dependencies: `package.json`
- Hot reload enabled

## Troubleshooting

### Services not starting
```bash
sudo supervisorctl restart backend frontend
sudo supervisorctl status
```

### MongoDB connection issues
```bash
ps aux | grep mongod
# If not running:
mongod --dbpath /data/db &
```

### Frontend build issues
```bash
cd /app/frontend
yarn install
```

### Backend dependency issues
```bash
cd /app/backend
pip install -r requirements.txt
```

## Security Notes

- This is a development/testing tool
- In production, implement proper authentication and authorization
- Use HTTPS for all communications
- Protect sensitive key material (Ki, OPC)
- Regularly update certificates and CRLs
- Follow GSMA security guidelines for eSIM management

## License

Apache License 2.0 - See LICENSE file for details
