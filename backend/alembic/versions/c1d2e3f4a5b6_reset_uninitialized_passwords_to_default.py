"""safe_credential_workflow_checkpoint

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-10-31 18:00:00.000000

Safe credential workflow checkpoint.
Preserves existing accounts, individual credentials, and custom passwords.
Strictly avoids overwriting passwords with shared defaults.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op: Preserves individual user credentials without applying shared default passwords.
    # Individual account resets are handled via administrative user management endpoints.
    pass


def downgrade() -> None:
    pass
