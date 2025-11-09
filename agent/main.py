"""
요리조리 Agent 메인 (간단 버전)
"""

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate

from .memory import RecipeTrackingMemory
from .tools.planning_tool import PlanningTool
from .tools.timer_tool import create_timer_tools


def create_yorijori_agent():
    """요리조리 Agent 생성"""
    
    # 1. LLM 설정
    llm = ChatOpenAI(
        model="gpt-4",
        temperature=0.7
    )
    
    # 2. Memory 생성
    memory = RecipeTrackingMemory(
        memory_key="chat_history",
        return_messages=True
    )
    
    # 3. Tools 준비
    planning_tool = PlanningTool()
    timer_tools = create_timer_tools()
    tools = [planning_tool] + timer_tools
    
    # 4. Prompt
    prompt = PromptTemplate.from_template("""
당신은 요리조리 음성 안내 AI입니다.

규칙:
1. 레시피 시작 시 planning_service 호출
2. timer_required가 true이면 timer_create 호출
3. 친절하고 격려하는 톤

대화 기록: {chat_history}
Tools: {tools}
Tool Names: {tool_names}

사용자: {input}

생각: {agent_scratchpad}
""")
    
    # 5. Agent 생성
    agent = create_react_agent(llm, tools, prompt)
    
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        verbose=True,
        max_iterations=10
    )
    
    return agent_executor, memory


if __name__ == "__main__":
    """간단 테스트"""
    agent, memory = create_yorijori_agent()
    
    # 테스트
    response = agent.invoke({
        "input": "김치찌개 만들기 시작"
    })
    
    print(response["output"])