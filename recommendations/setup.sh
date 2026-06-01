#!/bin/bash
# Setup script for recommendations app (Unix/Linux/Mac)

echo "Setting up recommendations app..."

echo "Running database migrations..."
python manage.py migrate recommendations

echo "Running property-based tests..."
python manage.py test recommendations.test_properties --keepdb

echo "Setup complete!"
