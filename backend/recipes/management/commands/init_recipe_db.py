from django.core.management.base import BaseCommand

from data.app.ingest.db_init import initialize_database


class Command(BaseCommand):
    help = "Initialize the project PostgreSQL schema defined in config.yaml."

    def handle(self, *args, **options):
        initialize_database()
        self.stdout.write(
            self.style.SUCCESS("PostgreSQL schema initialization completed.")
        )
