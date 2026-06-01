# Manual Steps Required

Due to Python environment configuration issues, the following steps need to be completed manually:

## 1. Run Database Migrations

Execute the following command to create the database tables:

```bash
python manage.py migrate recommendations
```

**Expected Output**:
```
Operations to perform:
  Apply all migrations: recommendations
Running migrations:
  Applying recommendations.0001_initial... OK
```

This will create two tables:
- `related_products`
- `recommendation_clicks`

## 2. Run Property-Based Test

Execute the property test to verify the RelatedProduct model:

```bash
python manage.py test recommendations.test_properties.RelatedProductPropertyTests.test_property_19_manual_association_persistence --keepdb
```

**Expected Output**:
```
test_property_19_manual_association_persistence (recommendations.test_properties.RelatedProductPropertyTests) ... ok

----------------------------------------------------------------------
Ran 1 test in X.XXXs

OK
```

## 3. Verify Admin Interface

1. Start the development server:
   ```bash
   python manage.py runserver
   ```

2. Navigate to: `http://localhost:8000/admin/`

3. Log in with admin credentials

4. Verify that you can see:
   - "Related Products" under "RECOMMENDATIONS"
   - "Recommendation Clicks" under "RECOMMENDATIONS"

5. Try creating a manual related product association:
   - Click "Related Products" → "Add Related Product"
   - Select a source product
   - Select a related product
   - Set an order value
   - Save

6. Verify the association appears in the list

## Troubleshooting

### Python Environment Issue

The virtual environment is configured for Python 3.13 but the system has Python 3.11/3.12. To fix:

**Option 1: Recreate Virtual Environment**
```bash
# Deactivate current environment
deactivate

# Remove old environment
rmdir /s env

# Create new environment with available Python
python -m venv env

# Activate new environment
env\Scripts\activate.bat

# Reinstall dependencies
pip install -r requirements.txt  # if exists
pip install django hypothesis
```

**Option 2: Update pyvenv.cfg**
Edit `env/pyvenv.cfg` and change:
```
home = C:\Users\makvi\AppData\Local\Programs\Python\Python312
executable = C:\Users\makvi\AppData\Local\Programs\Python\Python312\python.exe
```

Then reinstall the environment.

## Verification Checklist

- [ ] Migrations applied successfully
- [ ] Property test passes (100 examples)
- [ ] Admin interface shows both models
- [ ] Can create RelatedProduct via admin
- [ ] Can view RecommendationClick in admin

## What Has Been Completed

✅ Django app structure created
✅ Models defined (RelatedProduct, RecommendationClick)
✅ Admin interface configured
✅ Migration file generated
✅ Property test implemented
✅ App added to INSTALLED_APPS
✅ Documentation created

## Next Task

Once the above manual steps are completed, proceed to:
- **Task 2**: Implement database indexes for performance
