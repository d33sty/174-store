"""server-side timestamps

Revision ID: a1b2c3d4e5f6
Revises: fb96eba89eef
Create Date: 2026-05-18

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fb96eba89eef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES_WITH_CREATED_AND_UPDATED = [
    ('products', 'created_at'),
    ('products', 'updated_at'),
    ('cart_items', 'created_at'),
    ('cart_items', 'updated_at'),
    ('replies', 'created_at'),
    ('replies', 'updated_at'),
]

TABLES_WITH_SINGLE_DATE = [
    ('reviews', 'comment_date'),
]


def upgrade() -> None:
    # Fill NULLs before adding NOT NULL constraint
    for table, col in TABLES_WITH_CREATED_AND_UPDATED + TABLES_WITH_SINGLE_DATE:
        op.execute(f"UPDATE {table} SET {col} = now() WHERE {col} IS NULL")

    for table, col in TABLES_WITH_CREATED_AND_UPDATED + TABLES_WITH_SINGLE_DATE:
        op.execute(
            f"ALTER TABLE {table} "
            f"ALTER COLUMN {col} TYPE TIMESTAMPTZ USING {col} AT TIME ZONE 'UTC'"
        )
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {col} SET DEFAULT now()")
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {col} SET NOT NULL")


def downgrade() -> None:
    for table, col in TABLES_WITH_CREATED_AND_UPDATED + TABLES_WITH_SINGLE_DATE:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {col} DROP DEFAULT")
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {col} DROP NOT NULL")
        op.execute(
            f"ALTER TABLE {table} "
            f"ALTER COLUMN {col} TYPE TIMESTAMP USING {col} AT TIME ZONE 'UTC'"
        )
