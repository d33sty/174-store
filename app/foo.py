from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy import (
    Integer,
    String,
    Boolean,
    Numeric,
    Text,
    ForeignKey,
    DateTime,
    Date,
)
from decimal import Decimal
from datetime import datetime, date


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    start_date: Mapped[date] = mapped_column(Date, default=date.today)

    employees: Mapped[list["Employee"]] = relationship(
        "Employee", secondary="participations", back_populates="projects", viewonly=True
    )

    participations: Mapped[list["Participation"]] = relationship(
        "Participation", back_populates="project", single_parent=True
    )


class Employee(Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(120), unique=True)
    projects: Mapped[list["Project"]] = relationship(
        "Project", secondary="participations", back_populates="employees", viewonly=True
    )

    participations: Mapped[list["Participation"]] = relationship(
        "Participation", back_populates="employee", single_parent=True
    )


class Participation(Base):
    __tablename__ = "participations"
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), primary_key=True
    )
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id"), primary_key=True
    )

    role: Mapped[str] = mapped_column(String(50))

    project: Mapped["Project"] = relationship(
        "Project", back_populates="participations"
    )
    employee: Mapped["Employee"] = relationship(
        "Employee", back_populates="participations"
    )
