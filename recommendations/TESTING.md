# Testing Guide for Recommendations App

## Overview

This document describes how to run the property-based tests for the recommendations app.

## Prerequisites

1. Ensure Hypothesis is installed:
   ```bash
   pip install hypothesis
   ```

2. Run migrations to create the database tables:
   ```bash
   python manage.py migrate recommendations
   ```

## Running Property Tests

### Run All Property Tests

```bash
python manage.py test recommendations.test_properties --keepdb
```

The `--keepdb` flag preserves the test database between runs for faster execution.

### Run Specific Property Test

To run only the manual association persistence test:

```bash
python manage.py test recommendations.test_properties.RelatedProductPropertyTests.test_property_19_manual_association_persistence --keepdb
```

## Property Test Details

### Property 19: Manual Association Persistence

**File**: `recommendations/test_properties.py`

**Validates**: Requirements 7.2

**Description**: Verifies that manual related product associations created by admins are:
1. Stored in the database with all fields
2. Retrievable by product ID
3. Accessible via reverse relationships
4. Persistent across queries

**Test Strategy**: Uses Hypothesis to generate random order values (0-1000) and verifies that associations are correctly stored and retrieved for each value.

**Iterations**: 100 examples per test run

## Expected Output

When the test passes, you should see:

```
test_property_19_manual_association_persistence (recommendations.test_properties.RelatedProductPropertyTests) ... ok

----------------------------------------------------------------------
Ran 1 test in X.XXXs

OK
```

## Troubleshooting

### Database Errors

If you encounter database errors, try:
1. Delete the test database: `rm db.sqlite3`
2. Run migrations again: `python manage.py migrate`
3. Re-run tests

### Import Errors

If you see import errors for Hypothesis:
```bash
pip install hypothesis
```

### Slow Test Execution

Property-based tests run 100 examples by default. To reduce iterations during development:

```python
@settings(max_examples=10)  # Reduce from 100 to 10
```

## Next Steps

After confirming the property test passes:
1. Proceed to implement the recommendation engine
2. Add more property tests for other requirements
3. Implement unit tests for edge cases
