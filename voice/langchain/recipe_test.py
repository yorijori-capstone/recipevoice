# recipe_test.py
import os
from langchain.agents import initialize_agent, AgentType
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from tool.recipe_tool import recipe_tool  # ✅ Tool import

# ✅ 0️⃣ Google API 키 설정
os.environ["GOOGLE_API_KEY"] = "key값"  # 여기에 실제 키 입력

# ✅ 1️⃣ LLM 초기화
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

# ✅ 2️⃣ Prompt 템플릿
# → LLM이 반드시 Python 리스트 튜플 형태를 출력하도록 유도
prompt = PromptTemplate(
    template="""
당신은 요리 전문가입니다. 
아래 레시피를 Python 리스트 튜플 형태로만 출력하세요. 
**추가 설명, 인사말, 문장은 절대 포함하지 마세요.**

레시피: {recipe}

출력 예시:
[
    ("단계 제목", "구체적인 설명"),
    ...
]
""",
    input_variables=["recipe"]
)

# ✅ 3️⃣ Agent 초기화 (Tool 포함)
tools = [recipe_tool]

agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True,
    agent_kwargs={
        # 👉 시스템 수준에서 recipe_tool 호출을 강제
        "system_message": (
            "레시피 관련 요청이 들어오면 반드시 recipe_tool을 호출해야 합니다. "
            "직접 설명하거나 텍스트로 레시피를 출력하지 말고, "
            "Python 리스트 튜플 형태로 recipe_tool을 실행하세요."
        )
    }
)

# ✅ 4️⃣ 실제 실행
query = """
'스파게티 알리오 올리오' 레시피 단계를 리스트 튜플 형태로 생성한 뒤,
그 리스트를 recipe_tool에 전달하여 실행하세요.
"""
agent.run(query)
