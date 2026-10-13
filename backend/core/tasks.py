from celery import shared_task


@shared_task(name="core.worker_smoke_test")
def worker_smoke_test(message="BurnettPeople worker is connected"):
    return {
        "status": "ok",
        "message": message,
    }