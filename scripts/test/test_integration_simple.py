"""
Planning + Timer 서버 통합 테스트
"""

import requests
import json
import time


def test_integration():
    print("=" * 60)
    print("요리조리 통합 테스트")
    print("=" * 60)
    
    # Planning 서버 테스트
    print("\n[Step 1] Planning 서버 호출 (포트 8100)")
    print("-" * 60)
    
    recipe_data = {
        "title": "김치찌개",
        "ingredients": [
            {"name": "김치", "quantity": "300g"},
            {"name": "돼지고기", "quantity": "200g"}
        ],
        "steps": [
            {"order": 1, "instruction": "김치를 준비합니다."},
            {"order": 2, "instruction": "냄비에 넣고 볶아주세요."},
            {"order": 3, "instruction": "물을 붓고 10분간 끓입니다."}
        ]
    }
    
    try:
        response = requests.post(
            "http://localhost:8100/plan",
            json=recipe_data,
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        
        print(f"✅ Planning 성공!")
        print(f"   레시피: {result['title']}")
        print(f"   단계 수: {len(result['planned_steps'])}개")
        
        # 첫 번째 단계 출력
        first_step = result['planned_steps'][0]
        print(f"\n   [첫 번째 단계]")
        print(f"   - 스크립트: {first_step['script'][:50]}...")
        print(f"   - 타이머 필요: {first_step.get('timer_required', False)}")
        
        # 타이머 필요 단계 찾기
        timer_steps = [s for s in result['planned_steps'] if s.get('timer_required')]
        
        if not timer_steps:
            print("\nℹ️  타이머가 필요한 단계가 없습니다.")
            return
        
        print(f"\n[Step 2] 타이머 필요 단계: {len(timer_steps)}개")
        for step in timer_steps:
            print(f"   - {step['order']}번: {step['script'][:40]}...")
        
        # Timer 서버 테스트
        print(f"\n[Step 3] Timer 서버 호출 (포트 8101)")
        print("-" * 60)
        
        step = timer_steps[0]
        timer_response = requests.post(
            "http://localhost:8101/timers",
            json={
                "duration_sec": step['estimated_time_sec'],
                "label": step['script'][:30],
                "auto_start": True
            },
            timeout=10
        )
        timer_response.raise_for_status()
        timer = timer_response.json()
        
        print(f"✅ 타이머 생성 성공!")
        print(f"   Timer ID: {timer['timer_id']}")
        print(f"   상태: {timer['status']}")
        print(f"   총 시간: {timer['duration_sec']}초")
        
        # 타이머 상태 조회
        print(f"\n[Step 4] 타이머 진행 확인 (3초 후)")
        print("-" * 60)
        time.sleep(3)
        
        check_response = requests.get(
            f"http://localhost:8101/timers/{timer['timer_id']}",
            timeout=5
        )
        check_response.raise_for_status()
        status = check_response.json()
        
        print(f"✅ 타이머 상태 조회 성공!")
        print(f"   남은 시간: {status['remaining_sec']}초")
        print(f"   진행률: {status['progress_percent']}%")
        
        print("\n" + "=" * 60)
        print("✅ 통합 테스트 완료!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        print("\n서버 확인:")
        print("  Planning: http://localhost:8100/health")
        print("  Timer: http://localhost:8101/health")


if __name__ == "__main__":
    test_integration()
