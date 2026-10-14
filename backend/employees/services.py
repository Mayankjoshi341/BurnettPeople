
from django.core.exceptions import ValidationError
from django.db import transaction

from accounts.models import User
from accounts.services.invitations import create_or_resend_invitation
from employees.models import Employee

from accounts.models import AuditEvent
from accounts.services.audit import record_audit_event
@transaction.atomic
def create_employee_with_invitation(*, employee_data, created_by):
    """
    Create a preboarding employee and inactive portal account,
    then schedule an activation invitation after commit.
    """

    email = employee_data["official_email"].strip().lower()
    employee_code = employee_data["employee_code"].strip().upper()

    first_name = employee_data["first_name"].strip()
    last_name = employee_data["last_name"].strip()

    # Friendly validation before relying on database constraints.
    if User.objects.filter(email__iexact=email).exists():
        raise ValidationError({
            "official_email": "An account with this email already exists."
        })

    if Employee.objects.filter(
        official_email__iexact=email
    ).exists():
        raise ValidationError({
            "official_email": "An employee with this email already exists."
        })

    if Employee.objects.filter(
        employee_code__iexact=employee_code
    ).exists():
        raise ValidationError({
            "employee_code": "This employee code already exists."
        })

    # The employee can exist in HR records without login access.
    user = User.objects.create_user( 
        email=email,
        password=None,
        first_name=first_name,
        last_name=last_name,
        role=User.Role.EMPLOYEE,
        is_active=False,
    ) # type: ignore

    employee = Employee.objects.create(
        user=user,
        employee_code=employee_code,
        official_email=email,
        first_name=first_name,
        last_name=last_name,
        department=employee_data["department"],
        designation=employee_data["designation"],
        manager=employee_data.get("manager"),
        work_location=employee_data.get("work_location"),
        employment_type=employee_data.get(
            "employment_type",
            Employee.EmploymentType.FULL_TIME,
        ),
        employment_status=Employee.EmploymentStatus.PREBOARDING,
        date_of_joining=employee_data["date_of_joining"],
        phone_number=employee_data.get("phone_number", ""),
        created_by=created_by,
    )

    invitation = create_or_resend_invitation(
        user=user,
        created_by=created_by,
    )
    record_audit_event(
        action=AuditEvent.Action.EMPLOYEE_CREATED,
        actor=created_by,
        subject_user=user,
        subject_email=user.email,
        object_type="Employee",
        object_id=employee.pk,
        metadata={
            "employee_code": employee.employee_code,
            "employment_status": employee.employment_status,
        },
    )
    
    return employee, invitation
