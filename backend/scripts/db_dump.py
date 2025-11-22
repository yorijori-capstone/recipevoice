#!/usr/bin/env python3
"""
데이터베이스 덤프 생성 스크립트 (pg_dump 대체)

PostgreSQL 클라이언트 도구가 없는 환경에서 Python으로 덤프를 생성합니다.
주요 테이블(recipes, cleaned_recipes, cleaned_steps)의 데이터를 SQL 형식으로 출력합니다.

사용법:
    poetry run python backend/scripts/db_dump.py
    또는
    cd backend/scripts && poetry run python db_dump.py
"""

import psycopg
from pathlib import Path
from datetime import datetime
import json
import sys
import os

# 프로젝트 루트 경로 설정
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DUMP_DIR = PROJECT_ROOT / "db_dumps"
DUMP_DIR.mkdir(exist_ok=True)

# 데이터베이스 연결 정보
DB_CONFIG = {
    "dbname": "recipevoice",
    "user": "recipevoice",
    "password": "recipevoice",
    "host": "localhost",
    "port": 5432,
}

# 덤프할 테이블 목록 (순서 중요: 외래키 의존성 고려)
TABLES = [
    "recipes",
    "cleaned_recipes",
    "cleaned_steps",
    "ingredients",  # 선택적
    "steps",  # 선택적
]


def escape_sql_string(value):
    """SQL 문자열 이스케이프"""
    if value is None:
        return "NULL"
    if isinstance(value, (dict, list)):
        # JSONB 타입은 JSON 문자열로 변환
        return f"'{json.dumps(value, ensure_ascii=False).replace(chr(39), chr(39) + chr(39))}'::jsonb"
    if isinstance(value, str):
        # SQL 문자열 이스케이프: ' -> ''
        escaped = value.replace("'", "''").replace("\\", "\\\\")
        return f"'{escaped}'"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    return str(value)


def generate_insert_sql(table_name, columns, rows):
    """INSERT SQL 문 생성"""
    if not rows:
        return f"-- {table_name}: 0 rows\n"
    
    sql_lines = [f"-- {table_name}: {len(rows)} rows"]
    sql_lines.append(f"TRUNCATE TABLE {table_name} CASCADE;")
    
    for row in rows:
        values = [escape_sql_string(row.get(col)) for col in columns]
        values_str = ", ".join(values)
        sql_lines.append(f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({values_str});")
    
    sql_lines.append("")  # 빈 줄
    return "\n".join(sql_lines)


def dump_table(conn, table_name):
    """테이블 데이터 덤프"""
    try:
        with conn.cursor() as cur:
            # 테이블 존재 확인
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                );
            """, (table_name,))
            
            if not cur.fetchone()[0]:
                return f"-- {table_name}: 테이블이 존재하지 않음\n"
            
            # 컬럼 정보 가져오기
            cur.execute(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = %s 
                ORDER BY ordinal_position;
            """, (table_name,))
            
            columns = [row[0] for row in cur.fetchall()]
            
            if not columns:
                return f"-- {table_name}: 컬럼 없음\n"
            
            # 데이터 가져오기
            cur.execute(f"SELECT * FROM {table_name};")
            rows = cur.fetchall()
            
            # 딕셔너리 형태로 변환
            row_dicts = [dict(zip(columns, row)) for row in rows]
            
            return generate_insert_sql(table_name, columns, row_dicts)
    
    except Exception as e:
        return f"-- {table_name}: 오류 발생 - {str(e)}\n"


def main():
    """메인 함수"""
    print("=" * 60)
    print("데이터베이스 덤프 생성 시작")
    print("=" * 60)
    
    try:
        # 데이터베이스 연결
        print(f"\n[1/4] 데이터베이스 연결 중...")
        print(f"      Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
        print(f"      Database: {DB_CONFIG['dbname']}")
        print(f"      User: {DB_CONFIG['user']}")
        
        conn = psycopg.connect(**DB_CONFIG)
        print("      ✅ 연결 성공")
        
        # 덤프 파일명 생성
        date_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        dump_file = DUMP_DIR / f"recipevoice_backup_{date_str}.sql"
        
        print(f"\n[2/4] 덤프 파일 생성 중...")
        print(f"      경로: {dump_file}")
        
        # SQL 헤더 작성
        sql_content = []
        sql_content.append("-- =========================================")
        sql_content.append("-- RecipeVoice 데이터베이스 덤프")
        sql_content.append(f"-- 생성 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        sql_content.append("-- 생성 도구: Python db_dump.py (pg_dump 대체)")
        sql_content.append("-- =========================================")
        sql_content.append("")
        sql_content.append("BEGIN;")
        sql_content.append("")
        
        # 각 테이블 덤프
        print(f"\n[3/4] 테이블 데이터 덤프 중...")
        total_rows = 0
        
        for table in TABLES:
            print(f"      - {table}...", end=" ", flush=True)
            table_sql = dump_table(conn, table)
            
            # 행 수 추출
            rows_count = table_sql.count("INSERT INTO")
            total_rows += rows_count
            print(f"✅ ({rows_count} rows)")
            
            sql_content.append(table_sql)
        
        # SQL 푸터 작성
        sql_content.append("COMMIT;")
        sql_content.append("")
        sql_content.append("-- =========================================")
        sql_content.append(f"-- 덤프 완료: 총 {total_rows} 행")
        sql_content.append("-- =========================================")
        
        # 파일 저장
        print(f"\n[4/4] 파일 저장 중...")
        with open(dump_file, "w", encoding="utf-8") as f:
            f.write("\n".join(sql_content))
        
        file_size = dump_file.stat().st_size / 1024  # KB
        print(f"      ✅ 저장 완료 ({file_size:.1f} KB)")
        
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ 덤프 생성 완료!")
        print("=" * 60)
        print(f"\n덤프 파일: {dump_file}")
        print(f"\n복원 방법:")
        print(f"  psql -U recipevoice -d recipevoice < {dump_file}")
        print(f"\n또는 (Python 스크립트 사용):")
        print(f"  poetry run python backend/scripts/db_restore.py {dump_file.name}")
        
        return 0
    
    except psycopg.OperationalError as e:
        print(f"\n❌ 데이터베이스 연결 실패:")
        print(f"   {str(e)}")
        print(f"\n확인 사항:")
        print(f"   1. PostgreSQL 서비스가 실행 중인지 확인")
        print(f"   2. 데이터베이스 '{DB_CONFIG['dbname']}'가 존재하는지 확인")
        print(f"   3. 사용자 '{DB_CONFIG['user']}'의 비밀번호가 올바른지 확인")
        return 1
    
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

