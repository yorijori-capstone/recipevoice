"""
레시피 정제 모듈
타이머 필요 여부 및 시간 추출
"""

import re
from typing import Dict, List


class RecipeCleaner:
    """레시피 텍스트에서 타이머 정보 추출"""
    
    # 타이머 필요 키워드
    TIMER_KEYWORDS = [
        "끓이", "볶", "익히", "졸이", "삶", "튀기",
        "재우", "발효", "숙성", "식히", "굽"
    ]
    
    # 즉시 행동 키워드 (타이머 불필요)
    IMMEDIATE_KEYWORDS = [
        "준비", "씻", "썰", "다지", "채썰", "채치",
        "손질", "제거", "넣", "섞", "버무리"
    ]
    
    @staticmethod
    def extract_time(text: str) -> int:
        """
        텍스트에서 시간 추출
        
        예시:
        - "10분간 끓입니다" → 600초
        - "5분" → 300초
        - "1시간" → 3600초
        """
        
        # 시간 패턴
        patterns = [
            (r'(\d+)\s*시간', 3600),  # N시간
            (r'(\d+)\s*분', 60),      # N분
            (r'(\d+)\s*초', 1),       # N초
        ]
        
        total_seconds = 0
        
        for pattern, multiplier in patterns:
            match = re.search(pattern, text)
            if match:
                value = int(match.group(1))
                total_seconds += value * multiplier
        
        # 시간 정보 없으면 기본값 60초
        return total_seconds if total_seconds > 0 else 60
    
    @staticmethod
    def needs_timer(instruction: str) -> bool:
        """
        타이머 필요 여부 판단
        
        Args:
            instruction: 조리 지시사항
        
        Returns:
            bool: 타이머 필요 여부
        """
        
        # 즉시 행동 키워드 체크 (우선순위 높음)
        for keyword in RecipeCleaner.IMMEDIATE_KEYWORDS:
            if keyword in instruction:
                return False
        
        # 타이머 필요 키워드 체크
        for keyword in RecipeCleaner.TIMER_KEYWORDS:
            if keyword in instruction:
                return True
        
        # 시간 명시 체크 (분, 시간 등)
        if re.search(r'\d+\s*(분|시간|초)', instruction):
            return True
        
        return False
    
    @staticmethod
    def clean_step(step: Dict) -> Dict:
        """
        단계 정제 (타이머 정보 추가)
        
        Args:
            step: {"order": 1, "instruction": "물을 붓고 10분간 끓입니다"}
        
        Returns:
            {
                "order": 1,
                "instruction": "물을 붓고 10분간 끓입니다",
                "timer_required": true,
                "estimated_time_sec": 600
            }
        """
        
        instruction = step["instruction"]
        
        # 타이머 정보 추출
        timer_required = RecipeCleaner.needs_timer(instruction)
        estimated_time_sec = RecipeCleaner.extract_time(instruction) if timer_required else 60
        
        return {
            **step,
            "timer_required": timer_required,
            "estimated_time_sec": estimated_time_sec
        }
    
    @staticmethod
    def clean_recipe(recipe: Dict) -> Dict:
        """
        레시피 전체 정제
        
        Args:
            recipe: {
                "title": "김치찌개",
                "ingredients": [...],
                "steps": [...]
            }
        
        Returns:
            정제된 레시피 (각 step에 timer_required 추가)
        """
        
        cleaned_steps = [
            RecipeCleaner.clean_step(step)
            for step in recipe["steps"]
        ]
        
        return {
            **recipe,
            "steps": cleaned_steps
        }


# 테스트
if __name__ == "__main__":
    # 테스트 레시피
    recipe = {
        "title": "김치찌개",
        "steps": [
            {"order": 1, "instruction": "김치를 준비합니다."},
            {"order": 2, "instruction": "냄비에 김치를 넣고 볶아주세요."},
            {"order": 3, "instruction": "물을 붓고 10분간 끓입니다."}
        ]
    }
    
    # 정제
    cleaner = RecipeCleaner()
    cleaned = cleaner.clean_recipe(recipe)
    
    # 결과
    for step in cleaned["steps"]:
        print(f"{step['order']}번: {step['instruction']}")
        print(f"  → 타이머 필요: {step['timer_required']}")
        print(f"  → 예상 시간: {step['estimated_time_sec']}초")
        print()