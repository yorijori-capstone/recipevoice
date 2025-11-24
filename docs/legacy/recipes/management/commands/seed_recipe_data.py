from django.core.management.base import BaseCommand

from data.app.ingest.db_bulk_seed import seed_from_raw


class Command(BaseCommand):
    help = (
        "Bulk upsert recipe documents into the project SQLite database "
        "using JSON files from the configured raw data directory."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--raw-dir",
            dest="raw_dir",
            default=None,
            help="Optional path (relative to project root) to override config.paths.raw_data_dir.",
        )

    def handle(self, *args, **options):
        stats = seed_from_raw(options.get("raw_dir"))
        self.stdout.write(
            self.style.SUCCESS(
                "Seeding finished: total={total}, ok={ok}, fail={fail}, skip={skip}".format(
                    **stats
                )
            )
        )
