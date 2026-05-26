"""increase product name and description length

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a7b8
Create Date: 2026-05-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('products', 'name', type_=sa.String(255), existing_nullable=False)
    op.alter_column('products', 'description', type_=sa.String(5000), existing_nullable=True)


def downgrade() -> None:
    op.alter_column('products', 'name', type_=sa.String(100), existing_nullable=False)
    op.alter_column('products', 'description', type_=sa.String(500), existing_nullable=True)
