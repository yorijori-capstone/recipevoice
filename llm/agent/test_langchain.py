import os
from langchain.tools import tool
from langchain.agents import initialize_agent, AgentType
from langchain_google_genai import ChatGoogleGenerativeAI

from dotenv import load_dotenv

# .env 파일에서 API 키 로드
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다.")
os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

# tool 정의
@tool
def sum_numbers(input: str) -> float:
    """두 수를 더합니다. 예시 입력: '5 and 7'"""
    try:
        parts = input.replace("and", ",").split(",")
        a, b = [float(p.strip()) for p in parts]
        return a + b
    except Exception:
        return "입력 형식: '숫자 and 숫자' 예: '5 and 7'"

@tool
def multiply_numbers(input: str) -> float:
    """두 수를 곱합니다. 예시 입력: '3 and 4'"""
    try:
        parts = input.replace("and", ",").split(",")
        a, b = [float(p.strip()) for p in parts]
        return a * b
    except Exception:
        return "입력 형식: '숫자 and 숫자'"
# ✅ 2. Tool 리스트 정의
tools = [sum_numbers, multiply_numbers]

# 🧠 Gemini LLM
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

# ⚙️ Agent 초기화 (ReAct 기반)
agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True,
)

# 🧩 테스트
print("\n--- 테스트 1 ---")
result = agent.invoke({"input": "Add 12.5 and 7.5"})
print("결과:", result["output"])

print("\n--- 테스트 2 ---")
result = agent.invoke({"input": "Multiply 3.2 and 4"})
print("결과:", result["output"])
