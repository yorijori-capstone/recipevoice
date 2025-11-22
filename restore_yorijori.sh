#!/usr/bin/env bash
set -euo pipefail

DB="yorijori"
USER="postgres"
DUMP_SQL="db_dumps/yorijori_full_backup.sql"
DUMP_CUSTOM="db_dumps/yorijori_full_backup.dump"
MIGRATION="backend/migrations/001_create_cleaned_recipes.sql"

# 1️⃣ DB 생성 (이미 있으면 PASS)
psql -U $USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB';" | grep -q 1 || \
psql -U $USER -c "CREATE DATABASE $DB;"

# 2️⃣ SQL 백업 복원 (선택)
if [[ -f "$DUMP_SQL" ]]; then
  echo "▶ Restoring SQL dump ..."
  psql -U $USER -d $DB < "$DUMP_SQL"
fi

# 3️⃣ custom dump 복원 (선택)
if [[ -f "$DUMP_CUSTOM" ]]; then
  echo "▶ Restoring custom dump ..."
  pg_restore -U $USER -d $DB "$DUMP_CUSTOM"
fi

# 4️⃣ 마이그레이션 실행 (cleaned_* 테이블 생성)
if [[ -f "$MIGRATION" ]]; then
  echo "▶ Running migration for cleaned_recipes / cleaned_steps ..."
  psql -U $USER -d $DB -f "$MIGRATION"
fi

# 5️⃣ 확인
echo "▶ Verifying tables..."
psql -U $USER -d $DB -c "\dt"
psql -U $USER -d $DB -c "SELECT COUNT(*) FROM cleaned_recipes;"
psql -U $USER -d $DB -c "SELECT COUNT(*) FROM cleaned_steps;"

echo "✅ All done!"