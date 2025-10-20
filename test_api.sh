#!/bin/bash

echo "=== eUICC Profile Manager API Tests ==="
echo ""

echo "1. Testing API Root Endpoint..."
curl -s http://localhost:8001/api | python3 -m json.tool
echo ""

echo "2. Testing Stats Endpoint..."
curl -s http://localhost:8001/api/stats | python3 -m json.tool
echo ""

echo "3. Testing Profiles List..."
curl -s http://localhost:8001/api/profiles | python3 -m json.tool | head -30
echo ""

echo "4. Testing Certificates List..."
curl -s http://localhost:8001/api/certificates | python3 -m json.tool | head -30
echo ""

echo "=== All tests completed ==="
