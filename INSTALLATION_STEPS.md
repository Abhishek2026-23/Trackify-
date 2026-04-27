# Complete Installation Guide

## Step-by-Step Installation

### Prerequisites Installation

#### 1. Install Node.js
**Windows:**
```bash
# Download from https://nodejs.org/
# Install LTS version (18.x or higher)
# Verify installation
node --version
npm --version
```

**Linux/Mac:**
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

#### 2. Install PostgreSQL
**Windows:**
```bash
# Download from https://www.postgresql.org/download/windows/
# Run installer, set password for postgres user
# Add to PATH: C:\Program Files\PostgreSQL\14\bin
```

**Linux:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Mac:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

#### 3. Install Redis
**Windows:**
```bash
# Download from https://github.com/microsoftarchive/redis/releases
# Or use WSL2 with Linux installation
```

**Linux:**
```bash
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Mac:**
```bash
brew install redis
brew services start redis
```

### Project Setup

#### Step 1: Download/Clone Project
```bash
# If using git
git clone <repository-url>
cd bus-tracking-system

# Or extract downloaded zip
unzip bus-tracking-system.zip
cd bus-tracking-system
```

#### Step 2: Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your settings
# Windows: notepad .env
# Linux/Mac: nano .env
```

**Configure .env:**
```env
NODE_ENV=development
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bus_tracking
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:19006
```

#### Step 3: Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL prompt:
CREATE DATABASE bus_tracking;
\q
```

#### Step 4: Run Migrations
```bash
# Still in backend directory
npm run db:migrate
```

Expected output:
```
Starting database migration...
✓ Database migration completed successfully
```

#### Step 5: Seed Database
```bash
npm run db:seed
```

Expected output:
```
Seeding database...
Seeding buses...
Seeding drivers...
Seeding routes...
✓ Database seeded successfully

=== Test Credentials ===
Admin: phone=9999999999, password=admin123
User: phone=8888888888, password=admin123
```

#### Step 6: Start Backend
```bash
npm run dev
```

Expected output:
```
✓ PostgreSQL connected
✓ Redis connected
✓ Server running on port 5000
✓ Environment: development
```

#### Step 7: Test Backend (New Terminal)
```bash
# Health check
curl http://localhost:5000/api/v1/health

# Expected: {"status":"ok","timestamp":"..."}

# Get routes
curl http://localhost:5000/api/v1/routes

# Expected: {"routes":[...]}
```

#### Step 8: Start GPS Simulator (New Terminal)
```bash
cd backend
npm run simulate
```

Expected output:
```
GPS Simulator started...
✓ Location updated: 30.7333, 76.7794
✓ Location updated: 30.7320, 76.7810
...
```

#### Step 9: Web Dashboard Setup (New Terminal)
```bash
cd web-dashboard

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit if needed (default should work)
# REACT_APP_API_URL=http://localhost:5000/api/v1
# REACT_APP_SOCKET_URL=http://localhost:5000

# Start dashboard
npm start
```

Browser should open automatically at http://localhost:3000

#### Step 10: Mobile App Setup (Optional)
```bash
cd mobile-app

# Install dependencies
npm install

# Install Expo CLI globally
npm install -g expo-cli

# Update API URL in src/config.js
# Change to your computer's IP address
# Find IP: ipconfig (Windows) or ifconfig (Linux/Mac)

# Start Expo
npm start
```

Scan QR code with Expo Go app on your phone.

### Verification Checklist

- [ ] Node.js installed (v18+)
- [ ] PostgreSQL installed and running
- [ ] Redis installed and running
- [ ] Database created and migrated
- [ ] Database seeded with test data
- [ ] Backend server running on port 5000
- [ ] GPS simulator sending updates
- [ ] Web dashboard accessible at localhost:3000
- [ ] Can see bus moving on map
- [ ] Mobile app running (optional)

### Troubleshooting

#### Backend won't start
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check if port 5000 is available
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # Linux/Mac
```

#### Database connection error
```bash
# Verify credentials
psql -U postgres -d bus_tracking

# If password error, reset:
# Windows: Use pgAdmin
# Linux: sudo -u postgres psql
```

#### Redis connection error
```bash
# Start Redis
# Windows: redis-server.exe
# Linux: sudo systemctl start redis
# Mac: brew services start redis

# Test connection
redis-cli ping
```

#### GPS simulator not updating
```bash
# Check backend logs
# Verify trip_id=1 exists in database
psql -U postgres -d bus_tracking -c "SELECT * FROM trips WHERE id=1;"
```

#### Web dashboard blank page
```bash
# Check browser console for errors
# Verify API URL in .env
# Check CORS settings in backend .env
```

#### Mobile app won't connect
```bash
# Update API_URL in mobile-app/src/config.js
# Use your computer's IP, not localhost
# Ensure phone and computer on same network
# Check firewall allows port 5000
```

### Next Steps

1. **Explore the Dashboard**: Open http://localhost:3000
2. **Watch Real-time Updates**: See bus moving on map
3. **Test APIs**: Use Postman or curl
4. **Read Documentation**: Check API_DOCUMENTATION.md
5. **Deploy to Production**: See DEPLOYMENT.md

### Getting Help

- Check FAQ.md for common questions
- Review TESTING_GUIDE.md for testing
- See DEPLOYMENT.md for production setup
- Create GitHub issue for bugs
