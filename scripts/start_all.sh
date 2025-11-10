#!/bin/bash

echo "=========================================="
echo "요리조리 서버 시작"
echo "=========================================="

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# Planning 서버 시작
echo ""
echo "▶ Planning 서버 시작 (포트 8100)..."
poetry run python -m llm.planning_server.main &
PLANNING_PID=$!
sleep 2

# Timer 서버 시작
echo ""
echo "▶ Timer 서버 시작 (포트 8101)..."
poetry run python -m timer.main &
TIMER_PID=$!
sleep 2

echo ""
echo "=========================================="
echo "✅ 서버 실행 완료!"
echo "=========================================="
echo "Planning 서버: http://localhost:8100"
echo "Timer 서버: http://localhost:8101"
echo ""
echo "Planning PID: $PLANNING_PID"
echo "Timer PID: $TIMER_PID"
echo ""
echo "종료하려면 Ctrl+C를 누르세요"
echo "=========================================="

# Ctrl+C 시 모든 프로세스 종료
trap "echo ''; echo '서버 종료 중...'; kill $PLANNING_PID $TIMER_PID; exit" INT TERM

# 대기
wait
