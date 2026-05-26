"""increase product name and description length

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a7b8
Create Date: 2026-05-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TSV_EXPR = """
    setweight(to_tsvector('russian', coalesce(name, '')), 'A')
    ||
    setweight(to_tsvector('russian', coalesce(description, '')), 'B')
"""


def upgrade() -> None:
    op.drop_column('products', 'tsv')
    op.alter_column('products', 'name', type_=sa.String(255), existing_nullable=False)
    op.alter_column('products', 'description', type_=sa.String(5000), existing_nullable=True)
    op.add_column('products', sa.Column('tsv', sa.dialects.postgresql.TSVECTOR(), sa.Computed(TSV_EXPR, persisted=True), nullable=False))


def downgrade() -> None:
    op.drop_column('products', 'tsv')
    op.alter_column('products', 'name', type_=sa.String(100), existing_nullable=False)
    op.alter_column('products', 'description', type_=sa.String(500), existing_nullable=True)
    op.add_column('products', sa.Column('tsv', sa.dialects.postgresql.TSVECTOR(), sa.Computed(TSV_EXPR, persisted=True), nullable=False))
