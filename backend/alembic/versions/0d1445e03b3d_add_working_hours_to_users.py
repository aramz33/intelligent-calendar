"""add_working_hours_to_users

Revision ID: 0d1445e03b3d
Revises: 57ff4033bbd8
Create Date: 2025-12-24 18:34:18.942107

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = '0d1445e03b3d'
down_revision: Union[str, None] = '57ff4033bbd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add working hours fields to users table
    op.add_column('users', sa.Column('working_hours_start', sa.Time(), server_default='09:00:00', nullable=True))
    op.add_column('users', sa.Column('working_hours_end', sa.Time(), server_default='17:00:00', nullable=True))
    op.add_column('users', sa.Column('working_days', JSONB, server_default='["monday", "tuesday", "wednesday", "thursday", "friday"]', nullable=True))
    op.add_column('users', sa.Column('default_task_duration', sa.Integer(), server_default='60', nullable=True))


def downgrade() -> None:
    # Remove working hours fields from users table
    op.drop_column('users', 'default_task_duration')
    op.drop_column('users', 'working_days')
    op.drop_column('users', 'working_hours_end')
    op.drop_column('users', 'working_hours_start')
