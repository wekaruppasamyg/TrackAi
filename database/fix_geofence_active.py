"""
One-off maintenance script: backfill is_active=True on existing geofences
that were created before the create_geofence() fix.

Safe to run multiple times (idempotent) — it only touches rows where
is_active is not already True, and reports what it changed.

Usage:
    cd backend
    python fix_geofence_active.py
"""

import sys
import os

# Add backend directory to path to find app module (same pattern as init_db.py)
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
backend_dir = os.path.abspath(backend_dir)
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

from app.database import SessionLocal
from app.models import Geofence


def fix_inactive_geofences():
    db = SessionLocal()
    try:
        all_geofences = db.query(Geofence).all()
        print(f"Found {len(all_geofences)} total geofence(s) in the database.\n")

        to_fix = [g for g in all_geofences if not g.is_active]

        if not to_fix:
            print("✅ All geofences already have is_active=True. Nothing to do.")
            return

        print(f"⚠️  {len(to_fix)} geofence(s) currently have is_active=False/NULL:\n")
        for g in to_fix:
            print(f"   - id={g.id}  name={g.name!r}  user_id={g.user_id}  is_active={g.is_active}")

        print("\nUpdating these to is_active=True...")
        for g in to_fix:
            g.is_active = True
            db.add(g)
        db.commit()

        print(f"✅ Fixed {len(to_fix)} geofence(s). They will now be checked on future location updates.")

    except Exception as e:
        print(f"❌ Error while fixing geofences: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Backfilling is_active on existing geofences...\n")
    fix_inactive_geofences()
    print("\nDone.")