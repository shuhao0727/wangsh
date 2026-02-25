import asyncio
import os
import sys
import random
from datetime import datetime, timedelta

# Add backend directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal
from app.models.core.user import User
from app.models.agents.ai_agent import AIAgent, ZntConversation

# Try importing faker, if not present, attempt to install or use fallback
try:
    from faker import Faker
    fake = Faker('zh_CN')
except ImportError:
    print("Faker library not found. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "faker"])
    from faker import Faker
    fake = Faker('zh_CN')

async def seed_users(session: AsyncSession, count=10):
    print(f"Creating {count} mock users...")
    users = []
    for _ in range(count):
        # Ensure unique username and student_id
        suffix = fake.random_number(digits=4)
        username = f"{fake.user_name()}_{suffix}"
        student_id = f"{fake.random_number(digits=8)}_{suffix}"
        
        user = User(
            username=username,
            full_name=fake.name(),
            role_code=random.choice(['student', 'admin', 'teacher']),
            is_active=True,
            student_id=student_id,
            class_name=f"{random.randint(2020, 2025)}级{random.randint(1, 10)}班",
            study_year=str(random.randint(2020, 2025))
        )
        users.append(user)
    
    session.add_all(users)
    await session.commit()
    
    # Refresh to get IDs
    for user in users:
        await session.refresh(user)
        
    print(f"✅ Successfully created {len(users)} users.")
    return users

async def seed_agents(session: AsyncSession, count=5):
    print(f"Creating {count} mock AI agents...")
    agents = []
    agent_types = ['general', 'dify', 'openai']
    model_names = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'deepseek-chat', 'gemini-pro']
    
    for _ in range(count):
        agent = AIAgent(
            name=f"{fake.company()}助手",
            description=fake.catch_phrase(),
            agent_type=random.choice(agent_types),
            model_name=random.choice(model_names),
            is_active=True,
            has_api_key=True,
            api_endpoint=fake.url(),
            created_at=datetime.utcnow()
        )
        agents.append(agent)
        
    session.add_all(agents)
    await session.commit()
    
    # Refresh to get IDs
    for agent in agents:
        await session.refresh(agent)
        
    print(f"✅ Successfully created {len(agents)} agents.")
    return agents

async def seed_conversations(session: AsyncSession, users, agents, session_count=120):
    print(f"Creating {session_count} conversation sessions with messages...")
    conversations = []
    
    if not users or not agents:
        print("⚠️ No users or agents available to create conversations.")
        return

    for _ in range(session_count):
        user = random.choice(users)
        agent = random.choice(agents)
        
        session_id = fake.uuid4()
        
        # Create a conversation with 2-10 messages
        num_messages = random.randint(2, 10)

        # Keep data fresh so default UI filters (last hour) show results
        base_time = datetime.utcnow() - timedelta(minutes=random.randint(0, 90))
        
        for i in range(num_messages):
            msg_time = base_time + timedelta(minutes=i*2)
            
            # Alternate between question and answer (backend analytics relies on these values)
            if i % 2 == 0:
                # Question
                msg = ZntConversation(
                    user_id=user.id,
                    user_name=user.full_name,
                    agent_id=agent.id,
                    agent_name=agent.name,
                    session_id=session_id,
                    message_type="question",
                    content=fake.sentence(nb_words=12),
                    created_at=msg_time
                )
            else:
                # Answer
                msg = ZntConversation(
                    user_id=user.id,
                    user_name=user.full_name,
                    agent_id=agent.id,
                    agent_name=agent.name,
                    session_id=session_id,
                    message_type="answer",
                    content=fake.paragraph(nb_sentences=3),
                    response_time_ms=random.randint(500, 3000),
                    created_at=msg_time
                )
            conversations.append(msg)
            
    session.add_all(conversations)
    await session.commit()
    print(f"✅ Successfully created {len(conversations)} messages across {session_count} sessions.")

async def main():
    print("🚀 Starting data seeding process...")
    async with AsyncSessionLocal() as session:
        try:
            # 0. Clean up old data
            print("🧹 Cleaning up old data...")
            # Delete in order of dependency: Conversations -> Agents, Users
            await session.execute(delete(ZntConversation))
            await session.execute(delete(AIAgent))
            await session.execute(delete(User))
            await session.commit()
            print("✅ Cleanup complete.")

            # 1. Seed Users
            new_users = await seed_users(session, count=10)
            
            # 2. Seed Agents
            new_agents = await seed_agents(session, count=5)
            
            # 3. Seed Conversations using all available users and agents
            # Fetch all to include pre-existing ones if needed, or just use new ones
            stmt_users = select(User)
            result_users = await session.execute(stmt_users)
            all_users = result_users.scalars().all()
            
            stmt_agents = select(AIAgent)
            result_agents = await session.execute(stmt_agents)
            all_agents = result_agents.scalars().all()
            
            await seed_conversations(session, all_users, all_agents, session_count=120)
            
            print("🎉 Data seeding completed successfully!")
            
        except Exception as e:
            print(f"❌ An error occurred during seeding: {e}")
            await session.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(main())
