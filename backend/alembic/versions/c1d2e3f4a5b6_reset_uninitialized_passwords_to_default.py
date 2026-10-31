"""reset_uninitialized_passwords_to_default

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-10-31 18:00:00.000000

Safely sets temporary passwords of uninitialized users (must_change_password=True)
to the official institutional default password ('cce@123').
Preserves any user who has already changed their password (must_change_password=False).
Preserves FIREBASE_MANAGED_ACCOUNT admin users.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.core.security import get_password_hash

# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Compute the standard Argon2id hash for the institutional initial password
    default_hash = get_password_hash("cce@123")

    # Update all accounts with must_change_password=True, excluding FIREBASE_MANAGED_ACCOUNT
    users_table = sa.table(
        "users",
        sa.column("password_hash", sa.String),
        sa.column("must_change_password", sa.Boolean),
    )

    op.execute(
        users_table.update()
        .where(
            sa.and_(
                users_table.c.must_change_password.is_(True),
                users_table.c.password_hash.is_not(None),
                users_table.c.password_hash != "FIREBASE_MANAGED_ACCOUNT",
            )
        )
        .values(password_hash=default_hash)
    )


def downgrade() -> None:
    pass

