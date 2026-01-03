# Intelligent Calendar

A self-hosted, AI-powered calendar application that automatically schedules tasks based on priorities, deadlines, and available time.

## 🎯 Project Vision

Create a "Motion-like" intelligent calendar that:
- Connects to external calendars via iCal
- Automatically schedules flexible tasks around fixed appointments
- Learns from your work patterns to improve scheduling over time
- Uses constraint satisfaction and machine learning for optimal task placement

## 🏗️ Architecture

### Tech Stack

**Backend:**
- FastAPI (Python 3.11+)
- PostgreSQL with SQLAlchemy ORM
- Alembic for database migrations
- JWT authentication

**Frontend:**
- Next.js 15 (App Router)
- Tailwind CSS + shadcn/ui
- TypeScript
- React Hook Form + Zod validation
- @dnd-kit for drag-and-drop
- date-fns for date manipulation
- Axios for API communication

**AI Components:**
- OR-Tools CP-SAT solver (implemented)
- Constraint satisfaction scheduling (implemented)
- Future: scikit-learn for velocity prediction
- Future: Local LLM for natural language task parsing

### Database Schema

- **Users**: User accounts with timezone preferences
- **Calendar Sources**: iCal feed connections
- **Hard Events**: Fixed appointments from external calendars
- **Soft Tasks**: Flexible tasks that can be automatically scheduled

## 📦 Current Status: Phase 4 Complete ✅

### Implemented Features

**Core Functionality:**
- ✅ User registration and authentication (JWT)
- ✅ PostgreSQL database with proper relationships
- ✅ Task CRUD operations with priority, deadline, and energy tracking
- ✅ RESTful API with FastAPI
- ✅ Database migrations with Alembic
- ✅ API documentation (Swagger UI)

**Calendar Integration:**
- ✅ Google Calendar OAuth 2.0 integration
- ✅ iCal/ICS feed synchronization (with basic auth support)
- ✅ Multi-calendar source management
- ✅ Recurring event support
- ✅ 6-month ahead calendar sync
- ✅ Background auto-sync every 15 minutes

**Intelligent Scheduling:**
- ✅ OR-Tools CP-SAT constraint satisfaction solver
- ✅ Auto-scheduling with priority optimization
- ✅ AI-generated reasoning explanations for task placements
- ✅ Working hours enforcement
- ✅ Drag-and-drop with ripple effect cascading
- ✅ 15-minute time interval granularity

**Frontend UI:**
- ✅ Next.js 15 responsive web application
- ✅ Multi-view calendar (Day/Week/Month/Year)
- ✅ Drag-and-drop task scheduling (@dnd-kit)
- ✅ Task creation/editing modal with validation
- ✅ Dark mode support
- ✅ Real-time calendar updates
- ✅ OAuth popup flow
- ✅ Sidebar navigation and task management
- ✅ shadcn/ui component library

### API Endpoints

**Authentication:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get JWT token

**Users:**
- `GET /api/v1/users/me` - Get current user info
- `PATCH /api/v1/users/me` - Update user profile and working hours

**Tasks:**
- `POST /api/v1/tasks/` - Create a new task
- `GET /api/v1/tasks/` - List all tasks
- `GET /api/v1/tasks/{id}` - Get specific task
- `PATCH /api/v1/tasks/{id}` - Update task
- `DELETE /api/v1/tasks/{id}` - Delete task

**Calendar:**
- `GET /api/v1/calendar/` - Get calendar view with events and tasks
- `POST /api/v1/calendar/sources` - Add iCal source
- `GET /api/v1/calendar/sources` - List all calendar sources
- `DELETE /api/v1/calendar/sources/{id}` - Remove calendar source
- `POST /api/v1/calendar/sources/{id}/sync` - Manually sync calendar
- `GET /api/v1/calendar/oauth/google/authorize` - Initiate Google OAuth
- `GET /api/v1/calendar/oauth/google/callback` - Handle OAuth callback

**Scheduling:**
- `POST /api/v1/schedule/auto-schedule` - Auto-schedule with simple algorithm
- `POST /api/v1/schedule/csp-schedule` - Auto-schedule with CSP optimizer
- `POST /api/v1/schedule/move-task` - Move task with ripple effect

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Node.js 18+

### Backend Setup

1. **Clone the repository**
```bash
   git clone <your-repo-url>
   cd intelligent-calendar
```

2. **Set up Python virtual environment**
```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
   pip install -r requirements.txt
```

4. **Set up PostgreSQL database**
```bash
   psql postgres
   CREATE DATABASE intelligent_calendar;
   CREATE USER calendar_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE intelligent_calendar TO calendar_user;
   \c intelligent_calendar
   GRANT ALL ON SCHEMA public TO calendar_user;
   \q
```

5. **Configure environment variables**

   Create `backend/.env`:
```env
   DATABASE_URL=postgresql://calendar_user:your_password@localhost:5432/intelligent_calendar
   SECRET_KEY=<generate-with-openssl-rand-hex-32>
   TOKEN_ENCRYPTION_KEY=<generate-with-Fernet.generate_key()>
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=10080
   GOOGLE_CLIENT_ID=<from-google-cloud-console>
   GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/calendar/oauth/google/callback
   BACKEND_CORS_ORIGINS=["http://localhost:3000"]
   ENVIRONMENT=development
   DEV_DISABLE_AUTH=True  # Optional: bypass auth for development
```

6. **Run database migrations**
```bash
   alembic upgrade head
```

7. **Start the backend server**
```bash
   uvicorn app.main:app --reload
```

8. **Access API documentation**

   Open http://localhost:8000/docs

### Frontend Setup

1. **Navigate to frontend directory**
```bash
   cd frontend
```

2. **Install dependencies**
```bash
   npm install
```

3. **Start the development server**
```bash
   npm run dev
```

4. **Access the application**

   Open http://localhost:3000

### Quick Start with Dev Mode

For rapid development, enable `DEV_DISABLE_AUTH=True` in `backend/.env` to bypass authentication. The system will automatically create and use a dev user.

## 📋 Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Basic backend setup
- [x] User authentication
- [x] Task CRUD operations
- [x] Database schema

### Phase 2: Calendar Integration ✅ COMPLETE
- [x] iCal/ICS parser
- [x] External calendar sync (iCal + Google OAuth)
- [x] Hard event display
- [x] Basic calendar UI
- [x] Multi-view calendar (Day/Week/Month/Year)

### Phase 3: Simple Scheduling ✅ COMPLETE
- [x] Rule-based task placement
- [x] Manual drag-and-drop with ripple effect
- [x] Working hours enforcement

### Phase 4: Intelligent Scheduling (CSP) ✅ COMPLETE
- [x] OR-Tools integration
- [x] Constraint satisfaction solver
- [x] Priority-based optimization
- [x] Handle 50+ tasks efficiently
- [x] AI-generated reasoning for task placements

### Phase 5: Machine Learning (In Progress)
- [x] Velocity tracking fields (actual vs estimated time)
- [ ] ML predictor for task duration
- [ ] Habit learning from completion data

### Phase 6: NLP & Advanced Features (Partial)
- [ ] Natural language task parsing
- [x] Energy-based scheduling (energy_required field)
- [x] Recurring task patterns
- [ ] Analytics dashboard

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📝 License

MIT License - Feel free to use this for your own intelligent calendar!

## 👨‍💻 Author

Built as a learning project combining Data Science expertise with full-stack development.

---

**Current Version:** v0.4.0 (Phase 4 Complete)
**Last Updated:** January 2026