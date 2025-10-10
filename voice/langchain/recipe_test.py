import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.agents import initialize_agent, AgentType
from tool.recipe_tool import recipe_tool  # Tool import

# 🔑 API 키
os.environ["GOOGLE_API_KEY"] = "AIzaSyCu5qhmKkUVM3drBvQBabIpiEbgUYX63qk"

# 1️⃣ LLM 초기화
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

# 2️⃣ Prompt 작성 (Python 리스트 튜플 출력 유도)
template = """
당신은 요리 전문가입니다. 

아래 레시피를 Python 리스트 튜플 형태로만 출력하세요. 
추가 설명, 인사말, 문장은 절대 포함하지 마세요.

레시피: {recipe}

출력 예시:
[
    ("단계 제목", "구체적인 설명"),
    ...
]
"""
prompt = PromptTemplate(template=template, input_variables=["recipe"])

# 3️⃣ Agent 초기화 (Tool 포함)
tools = [recipe_tool]

agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)

# 4️⃣ 실행 예시
query = "스파게티 아글리오 올리오 단계별 레시피를 리스트 튜플로 만들어 주세요"
agent.run(query)
