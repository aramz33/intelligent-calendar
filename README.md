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

**Frontend (Coming Soon):**
- Next.js 15 (App Router)
- Tailwind CSS
- TypeScript

**Future AI Components:**
- OR-Tools for constraint satisfaction
- scikit-learn for velocity prediction
- Local LLM for natural language task parsing

### Database Schema

- **Users**: User accounts with timezone preferences
- **Calendar Sources**: iCal feed connections
- **Hard Events**: Fixed appointments from external calendars
- **Soft Tasks**: Flexible tasks that can be automatically scheduled

## 📦 Current Status: Phase 1 Complete ✅

### Implemented Features

- ✅ User registration and authentication (JWT)
- ✅ PostgreSQL database with proper relationships
- ✅ Task CRUD operations
- ✅ RESTful API with FastAPI
- ✅ Database migrations with Alembic
- ✅ API documentation (Swagger UI)

### API Endpoints

**Authentication:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get JWT token

**Users:**
- `GET /api/v1/users/me` - Get current user info
- `PATCH /api/v1/users/me` - Update user profile

**Tasks:**
- `POST /api/v1/tasks/` - Create a new task
- `GET /api/v1/tasks/` - List all tasks
- `GET /api/v1/tasks/{id}` - Get specific task
- `PATCH /api/v1/tasks/{id}` - Update task
- `DELETE /api/v1/tasks/{id}` - Delete task

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Node.js 18+ (for frontend, coming soon)

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
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=10080
   API_V1_PREFIX=/api/v1
   PROJECT_NAME=Intelligent Calendar
   BACKEND_CORS_ORIGINS=["http://localhost:3000"]
   ENVIRONMENT=development
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

## 📋 Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Basic backend setup
- [x] User authentication
- [x] Task CRUD operations
- [x] Database schema

### Phase 2: Calendar Integration (Next)
- [ ] iCal/ICS parser
- [ ] External calendar sync
- [ ] Hard event display
- [ ] Basic calendar UI

### Phase 3: Simple Scheduling
- [ ] Rule-based task placement
- [ ] Manual drag-and-drop with ripple effect
- [ ] Working hours enforcement

### Phase 4: Intelligent Scheduling (CSP)
- [ ] OR-Tools integration
- [ ] Constraint satisfaction solver
- [ ] Priority-based optimization
- [ ] Handle 50+ tasks efficiently

### Phase 5: Machine Learning
- [ ] Velocity tracking (actual vs estimated time)
- [ ] ML predictor for task duration
- [ ] Habit learning from completion data

### Phase 6: NLP & Advanced Features
- [ ] Natural language task parsing
- [ ] Energy-based scheduling
- [ ] Recurring task patterns
- [ ] Analytics dashboard

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📝 License

MIT License - Feel free to use this for your own intelligent calendar!

## 👨‍💻 Author

Built as a learning project combining Data Science expertise with full-stack development.

---

**Current Version:** v0.1.0 (Phase 1)
**Last Updated:** December 2024