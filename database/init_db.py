"""
Database initialization and schema creation for TrackAI
"""

import sys
import os
from dotenv import load_dotenv

# Add backend directory to path to find app module
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
backend_dir = os.path.abspath(backend_dir)
sys.path.insert(0, backend_dir)


# Load environment variables from the backend .env file
load_dotenv(os.path.join(backend_dir, '.env'))

from app.database import init_db, SessionLocal
from app.models import User, Location, Geofence
from app.services.auth import hash_password
from app.config import DATABASE_URL

def seed_database():
    """Seed the database with sample data"""
    db = SessionLocal()
    # Hardcoded credentials for the admin user
    admin_username = "sanjay_100"
    admin_password = "sanjay09871"
    
    try:
        print(f"Cleaning database and creating 2 users...")
        
        # Clear everything to ensure a count of exactly 2 users
        db.query(Location).delete()
        db.query(Geofence).delete()
        db.query(User).delete()
        db.commit()

        sample_user = User(
            username=admin_username,
            email="demo@trackkai.com",
            full_name="System Administrator",
            is_active=True,
            is_admin=True,
            is_consent_given=True,
            hashed_password=hash_password(admin_password)
        )
        db.add(sample_user)

        demo_user = User(
            username="demo_user",
            email="user@trackkai.com",
            full_name="Regular User",
            is_active=True,
            is_admin=False,
            is_consent_given=True,
            hashed_password=hash_password("password123")
        )
        db.add(demo_user)
            
        db.commit()
        print(f"✓ Created 2 users: {admin_username} and {demo_user.username}")
        
        # Create only 1 location per user (Total 2)
        from datetime import datetime, timedelta, timezone
        
        loc1 = Location(
            user_id=sample_user.id,
            latitude=51.5074,
            longitude=-0.1278,
            timestamp=datetime.now(timezone.utc)
        )
        loc2 = Location(
            user_id=demo_user.id,
            latitude=40.7128,
            longitude=-74.0060,
            timestamp=datetime.now(timezone.utc)
        )
        db.add_all([loc1, loc2])
        db.commit()
        
        # Create sample geofence
        sample_geofence = Geofence(
            user_id=sample_user.id,
            name="Home",
            description="Home location",
            latitude=51.5074,
            longitude=-0.1278,
            radius=500,
            is_active=True,
        )
        db.add(sample_geofence)
        db.commit()
        print(f"✓ Created sample geofence: {sample_geofence.name}")

        # --- Verification Step ---
        print("\nVerifying admin user creation and authentication within init_db.py...")
        verified_user = db.query(User).filter(User.username == "sanjay_100").first()
        if verified_user:
            print(f"✅ Admin user '{verified_user.username}' found in DB.")
            # Attempt to authenticate within the script
            from app.services.auth import authenticate_user
            authenticated_admin = authenticate_user(db, "sanjay_100", "sanjay09871")
            if authenticated_admin:
                print(f"✅ Admin user '{authenticated_admin.username}' successfully authenticated within init_db.py.")
            else:
                print(f"❌ Admin user '{verified_user.username}' FAILED authentication within init_db.py. Password hash mismatch?")
        else:
            print("❌ Admin user 'sanjay_100' NOT FOUND in DB after creation.")
        # --- End Verification Step ---
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Initializing TrackAI database...")
    os.chdir(backend_dir) # Ensure relative paths in .env point to the backend folder
    abs_db_path = os.path.abspath('trackkai.db')
    print(f"Database File: {abs_db_path}")

    # Attempt to remove the old database file to handle schema changes
    db_path = 'trackkai.db'
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            print(f"✓ Removed old database file at {db_path}")
        except Exception as e:
            print(f"❌ ERROR: Could not delete {db_path}. You MUST stop the backend server (run.py) first!")
            sys.exit(1)

    init_db()
    print("✓ Database tables created")
    
    print("\nSeeding sample data...")
    seed_database()
    print("\n✅ Database initialization complete!")
