@echo off
REM Setup script for coupons app (Windows)

echo Installing Hypothesis for property-based testing...
pip install hypothesis

echo Running database migrations...
python manage.py migrate

echo Running tests...
python manage.py test coupons

echo Setup complete!
pause
