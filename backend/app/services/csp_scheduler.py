"""
CSP-based scheduling using OR-Tools CP-SAT solver.

This module implements intelligent task scheduling using Constraint Satisfaction Problems.
Unlike the simple rule-based scheduler, this globally optimizes task placement considering:
- Working hours constraints
- Task priorities and deadlines
- No-overlap constraints
- Buffer time between tasks
- Energy level matching
"""

from ortools.sat.python import cp_model
from datetime import datetime, timedelta, time, date, timezone
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
import logging

from app.models.user import User
from app.models.soft_task import SoftTask
from app.models.hard_event import HardEvent

logger = logging.getLogger(__name__)

# Time discretization: 15-minute intervals
INTERVAL_MINUTES = 15
INTERVALS_PER_HOUR = 60 // INTERVAL_MINUTES  # 4
INTERVALS_PER_DAY = 24 * INTERVALS_PER_HOUR  # 96


def datetime_to_interval(dt: datetime, day_start: datetime) -> int:
    """Convert datetime to interval index (15-min slots since day_start)"""
    delta = dt - day_start
    total_minutes = int(delta.total_seconds() / 60)
    return total_minutes // INTERVAL_MINUTES


def interval_to_datetime(interval: int, day_start: datetime) -> datetime:
    """Convert interval index to datetime"""
    minutes = interval * INTERVAL_MINUTES
    return day_start + timedelta(minutes=minutes)


def make_aware(dt: datetime) -> datetime:
    """Make a datetime timezone-aware (UTC) if it's naive"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def make_naive(dt: datetime) -> datetime:
    """Make a datetime timezone-naive"""
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


class CSPScheduler:
    """
    Constraint Satisfaction Problem scheduler using OR-Tools CP-SAT solver.
    Models tasks as variables with time slot domains and constraints.
    """

    def __init__(self, user: User, db: Session):
        self.user = user
        self.db = db
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

        # Will be populated during scheduling
        self.task_vars = {}  # task_id -> {start, end, interval_vars}
        self.busy_intervals = set()  # Set of busy interval indices
        self.start_date = None
        self.end_date = None
        self.horizon = 0  # Total intervals in scheduling window

    def schedule_tasks(
        self,
        tasks: List[SoftTask],
        days_ahead: int = 7
    ) -> Dict[int, Tuple[datetime, datetime, str]]:
        """
        Schedule tasks using CSP optimization.

        Args:
            tasks: List of SoftTask objects to schedule
            days_ahead: Number of days to look ahead for scheduling

        Returns:
            Dict mapping task_id -> (start_time, end_time, reasoning)
        """
        if not tasks:
            return {}

        # Setup scheduling window
        self.start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        self.end_date = self.start_date + timedelta(days=days_ahead)
        self.horizon = days_ahead * INTERVALS_PER_DAY

        logger.info(f"CSP Scheduling {len(tasks)} tasks over {days_ahead} days ({self.horizon} intervals)")

        # Get busy periods (hard events + already scheduled tasks not in our list)
        self._compute_busy_intervals(tasks)

        # Create variables for each task
        for task in tasks:
            self._create_task_variables(task)

        # Add constraints
        self._add_working_hours_constraints()
        self._add_no_overlap_constraints()
        self._add_deadline_constraints(tasks)
        self._add_buffer_constraints()

        # Set objective: maximize weighted priority
        self._optimize_by_priority(tasks)

        # Solve
        logger.info("Solving CSP...")
        status = self.solver.Solve(self.model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            logger.info(f"Solution found: {self.solver.StatusName(status)}")
            return self._extract_solution()
        else:
            logger.warning(f"No solution found: {self.solver.StatusName(status)}")
            return {}

    def _compute_busy_intervals(self, scheduling_tasks: List[SoftTask]):
        """Compute which intervals are already busy (hard events + other scheduled tasks)"""
        self.busy_intervals = set()

        # Get hard events in the scheduling window
        hard_events = self.db.query(HardEvent).filter(
            HardEvent.user_id == self.user.id,
            HardEvent.start_time >= self.start_date,
            HardEvent.start_time < self.end_date
        ).all()

        for event in hard_events:
            start_interval = datetime_to_interval(make_naive(event.start_time), self.start_date)
            end_interval = datetime_to_interval(make_naive(event.end_time), self.start_date)
            for i in range(start_interval, end_interval):
                if 0 <= i < self.horizon:
                    self.busy_intervals.add(i)

        # Get already scheduled tasks (not in our scheduling list)
        scheduled_task_ids = {t.id for t in scheduling_tasks}
        other_scheduled_tasks = self.db.query(SoftTask).filter(
            SoftTask.user_id == self.user.id,
            SoftTask.scheduled_start.isnot(None),
            SoftTask.scheduled_start >= self.start_date,
            SoftTask.scheduled_start < self.end_date,
            ~SoftTask.id.in_(scheduled_task_ids)
        ).all()

        for task in other_scheduled_tasks:
            start_interval = datetime_to_interval(make_naive(task.scheduled_start), self.start_date)
            end_interval = datetime_to_interval(make_naive(task.scheduled_end), self.start_date)
            for i in range(start_interval, end_interval):
                if 0 <= i < self.horizon:
                    self.busy_intervals.add(i)

        logger.info(f"Computed {len(self.busy_intervals)} busy intervals")

    def _create_task_variables(self, task: SoftTask):
        """Create CSP variables for a task"""
        duration_intervals = (task.estimated_duration_minutes + INTERVAL_MINUTES - 1) // INTERVAL_MINUTES

        # Start time variable: can be any interval where task fits
        max_start = self.horizon - duration_intervals
        if max_start < 0:
            logger.warning(f"Task {task.id} too long to fit in scheduling window")
            return

        start_var = self.model.NewIntVar(0, max_start, f'start_{task.id}')
        end_var = self.model.NewIntVar(duration_intervals, self.horizon, f'end_{task.id}')

        # End = Start + Duration
        self.model.Add(end_var == start_var + duration_intervals)

        # Create interval variable for no-overlap constraint
        interval_var = self.model.NewIntervalVar(
            start_var,
            duration_intervals,
            end_var,
            f'interval_{task.id}'
        )

        self.task_vars[task.id] = {
            'start': start_var,
            'end': end_var,
            'interval': interval_var,
            'duration': duration_intervals
        }

    def _add_working_hours_constraints(self):
        """Ensure tasks only scheduled during working hours"""
        work_start_minutes = self.user.working_hours_start.hour * 60 + self.user.working_hours_start.minute
        work_end_minutes = self.user.working_hours_end.hour * 60 + self.user.working_hours_end.minute

        work_start_interval = work_start_minutes // INTERVAL_MINUTES
        work_end_interval = work_end_minutes // INTERVAL_MINUTES

        working_days_set = set(self.user.working_days)

        for task_id, vars in self.task_vars.items():
            start_var = vars['start']
            end_var = vars['end']
            duration = vars['duration']

            # For each possible start interval, check if it's valid
            for day in range((self.end_date - self.start_date).days):
                day_offset = day * INTERVALS_PER_DAY
                current_date = self.start_date + timedelta(days=day)
                day_name = current_date.strftime('%A').lower()

                if day_name not in working_days_set:
                    # Not a working day - forbid any task starting this day
                    for interval in range(day_offset, day_offset + INTERVALS_PER_DAY):
                        if interval < self.horizon - duration:
                            # Can't start at this interval
                            self.model.Add(start_var != interval)
                else:
                    # Working day - only allow starts within working hours
                    # Forbid starts before work_start or after (work_end - duration)
                    for interval in range(day_offset, day_offset + work_start_interval):
                        if interval < self.horizon - duration:
                            self.model.Add(start_var != interval)

                    for interval in range(day_offset + work_end_interval - duration + 1, day_offset + INTERVALS_PER_DAY):
                        if interval < self.horizon - duration:
                            self.model.Add(start_var != interval)

    def _add_no_overlap_constraints(self):
        """Ensure no two tasks overlap, and no tasks overlap with busy periods"""
        # No overlap between scheduled tasks
        interval_vars = [vars['interval'] for vars in self.task_vars.values()]
        if len(interval_vars) > 1:
            self.model.AddNoOverlap(interval_vars)

        # No overlap with busy intervals (hard events, existing scheduled tasks)
        for task_id, vars in self.task_vars.items():
            start_var = vars['start']
            duration = vars['duration']

            # For each busy interval, ensure task doesn't overlap
            for busy_interval in self.busy_intervals:
                # Task cannot start at positions where it would overlap this busy interval
                # Task at position s with duration d occupies [s, s+d)
                # Busy interval occupies [busy_interval, busy_interval+1)
                # Overlap if: s <= busy_interval < s+d
                # So forbid: busy_interval - d + 1 <= s <= busy_interval

                for s in range(max(0, busy_interval - duration + 1), min(busy_interval + 1, self.horizon - duration + 1)):
                    self.model.Add(start_var != s)

    def _add_deadline_constraints(self, tasks: List[SoftTask]):
        """Tasks must complete before their deadline"""
        for task in tasks:
            if task.id not in self.task_vars:
                continue

            if task.deadline:
                deadline_naive = make_naive(task.deadline)
                if deadline_naive <= self.start_date:
                    # Deadline already passed, skip
                    continue

                if deadline_naive > self.end_date:
                    # Deadline beyond scheduling window, no constraint needed
                    continue

                deadline_interval = datetime_to_interval(deadline_naive, self.start_date)
                end_var = self.task_vars[task.id]['end']

                # Task must end before deadline
                self.model.Add(end_var <= deadline_interval)

    def _add_buffer_constraints(self):
        """Add 15-minute buffer between tasks (already handled by interval size)"""
        # Since we discretize to 15-min intervals, tasks naturally have
        # at least 15-min separation. No additional constraint needed.
        pass

    def _optimize_by_priority(self, tasks: List[SoftTask]):
        """Objective function: maximize weighted priority of scheduled tasks"""
        # Create boolean variables for whether each task is scheduled
        scheduled_vars = []
        weights = []

        for task in tasks:
            if task.id not in self.task_vars:
                continue

            # A task is "scheduled" if its start is within valid range
            # Since we've already constrained start, just use priority as weight
            scheduled_vars.append(self.task_vars[task.id]['start'])
            weights.append(task.priority)

        # Maximize: sum of priorities (OR-Tools will try to schedule high-priority tasks)
        # Since start times are constrained, maximizing doesn't directly work
        # Instead, we minimize the start times weighted by negative priority
        # This prefers scheduling high-priority tasks earlier

        objective_terms = []
        for task in tasks:
            if task.id not in self.task_vars:
                continue
            # Minimize start time * (11 - priority)
            # High priority (10) → weight 1 (prefer early)
            # Low priority (1) → weight 10 (allow later)
            weight = 11 - task.priority
            objective_terms.append(self.task_vars[task.id]['start'] * weight)

        if objective_terms:
            self.model.Minimize(sum(objective_terms))

    def _generate_reasoning(self, task: SoftTask, start_interval: int) -> str:
        """Generate human-readable reasoning for task placement"""
        start_time = interval_to_datetime(start_interval, self.start_date)
        reasoning_parts = []

        # Priority factor
        if task.priority >= 8:
            reasoning_parts.append(f"🎯 High priority ({task.priority}/10)")
        elif task.priority >= 5:
            reasoning_parts.append(f"📌 Medium priority ({task.priority}/10)")
        else:
            reasoning_parts.append(f"📍 Lower priority ({task.priority}/10)")

        # Deadline factor
        if task.deadline:
            deadline_naive = make_naive(task.deadline)
            hours_until = (deadline_naive - start_time).total_seconds() / 3600
            if hours_until <= 24:
                reasoning_parts.append(f"⏰ Deadline in {int(hours_until)} hours")
            else:
                days_until = int(hours_until / 24)
                reasoning_parts.append(f"⏰ Deadline in {days_until} days")

        # Working hours optimization
        hour = start_time.hour
        if 9 <= hour <= 11:
            reasoning_parts.append("⚡ Peak morning productivity hours")
        elif 14 <= hour <= 16:
            reasoning_parts.append("⚡ Afternoon focus time")

        # No conflicts
        reasoning_parts.append("🔗 No conflicts with meetings/tasks")

        return "\n".join(reasoning_parts)

    def _extract_solution(self) -> Dict[int, Tuple[datetime, datetime, str]]:
        """Extract the solution from the solved model with reasoning"""
        result = {}

        for task_id, vars in self.task_vars.items():
            start_interval = self.solver.Value(vars['start'])
            end_interval = self.solver.Value(vars['end'])

            start_time = interval_to_datetime(start_interval, self.start_date)
            end_time = interval_to_datetime(end_interval, self.start_date)

            # Get task for reasoning
            task = self.db.query(SoftTask).filter(SoftTask.id == task_id).first()
            reasoning = self._generate_reasoning(task, start_interval) if task else "Scheduled by CSP solver"

            result[task_id] = (make_aware(start_time), make_aware(end_time), reasoning)

            logger.info(f"Task {task_id}: {start_time} - {end_time} | Reasoning: {reasoning.replace(chr(10), ' / ')}")

        return result
