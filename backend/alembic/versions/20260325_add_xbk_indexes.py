"""add xbk indexes

Revision ID: 20260325_xbk_idx
Revises: 78ef5c1ccb1d
Create Date: 2026-03-25

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20260325_xbk_idx'
down_revision = '20260323_0006'
branch_labels = None
depends_on = None


def upgrade():
    # xbk_selections indexes
    op.create_index(
        'idx_xbk_selections_year_term_student',
        'xbk_selections',
        ['year', 'term', 'student_no'],
        unique=False
    )
    op.create_index(
        'idx_xbk_selections_year_term_course',
        'xbk_selections',
        ['year', 'term', 'course_code'],
        unique=False
    )

    # xbk_students indexes
    op.create_index(
        'idx_xbk_students_year_term_class',
        'xbk_students',
        ['year', 'term', 'class_name'],
        unique=False
    )

    # xbk_courses indexes
    op.create_index(
        'idx_xbk_courses_year_term_grade',
        'xbk_courses',
        ['year', 'term', 'grade'],
        unique=False
    )


def downgrade():
    op.drop_index('idx_xbk_courses_year_term_grade', table_name='xbk_courses')
    op.drop_index('idx_xbk_students_year_term_class', table_name='xbk_students')
    op.drop_index('idx_xbk_selections_year_term_course', table_name='xbk_selections')
    op.drop_index('idx_xbk_selections_year_term_student', table_name='xbk_selections')
