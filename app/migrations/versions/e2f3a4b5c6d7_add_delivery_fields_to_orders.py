"""add delivery fields to orders

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('delivery_type', sa.String(20), nullable=True))
    op.add_column('orders', sa.Column('delivery_pvz_code', sa.String(50), nullable=True))
    op.add_column('orders', sa.Column('delivery_address', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'delivery_address')
    op.drop_column('orders', 'delivery_pvz_code')
    op.drop_column('orders', 'delivery_type')
