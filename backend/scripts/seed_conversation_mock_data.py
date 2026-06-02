#!/usr/bin/env python3
"""
向 znt_conversations 写入模拟课堂对话数据（独立脚本，不依赖 app 模块）
运行：docker run --rm --network wangsh_wangsh-network -v $(pwd):/app python:3.11-slim sh -c "pip install -q sqlalchemy asyncpg && python3 /app/scripts/seed_conv.py"
"""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = "postgresql+asyncpg://admin:wangshuhao0727@wangsh-postgres:5432/wangsh_db"

TZ = timezone(timedelta(hours=8))
BASE = datetime(2026, 5, 20, 9, 0, 0, tzinfo=TZ)


def _t(minutes: int, seconds: int = 0) -> datetime:
    return BASE + timedelta(minutes=minutes, seconds=seconds)


TEACHER = {"id": 9001, "full_name": "王老师", "student_id": None, "role_code": "teacher", "class_name": "高三(1)班"}
STUDENTS = [
    {"id": 9101, "full_name": "张三", "student_id": "S001", "class_name": "高三(1)班", "role_code": "student"},
    {"id": 9102, "full_name": "李四", "student_id": "S002", "class_name": "高三(1)班", "role_code": "student"},
    {"id": 9103, "full_name": "王五", "student_id": "S003", "class_name": "高三(1)班", "role_code": "student"},
    {"id": 9104, "full_name": "赵六", "student_id": "S004", "class_name": "高三(1)班", "role_code": "student"},
    {"id": 9105, "full_name": "陈七", "student_id": "S005", "class_name": "高三(1)班", "role_code": "student"},
    {"id": 9106, "full_name": "刘八", "student_id": "S006", "class_name": "高三(1)班", "role_code": "student"},
    {"id": 9107, "full_name": "周九", "student_id": "S007", "class_name": "高三(1)班", "role_code": "student"},
    {"id": 9108, "full_name": "吴十", "student_id": "S008", "class_name": "高三(1)班", "role_code": "student"},
]

# (min, sec, user_id, message_type, content)
CONVERSATIONS = [
    (0, 10, 9001, "question", "同学们，今天我们继续学习 Python 中的循环结构。先回忆一下，for 循环的基本语法是什么？"),
    (0, 45, 9101, "question", "for i in range(10) 里面的 i 是什么？"),
    (1, 10, 9103, "question", "range(10) 是从 0 到 9 还是 1 到 10？"),
    (1, 20, 9001, "answer", "range(10) 生成 0 到 9，共 10 个数。i 是循环变量，每次迭代取 range 里的下一个值。"),
    (1, 50, 9102, "question", "那 for i in range(1, 11) 就是 1 到 10 对吗？"),
    (2, 15, 9105, "question", "range 能不能有三个参数？比如 range(1, 10, 2)"),
    (2, 30, 9001, "answer", "对，第三个参数是步长。range(1,10,2) 生成 1,3,5,7,9。"),
    (3, 0, 9001, "question", "现在来看这个例子：for i in range(5): print(i * 2)。每轮输出什么？"),
    (3, 20, 9104, "question", "0, 2, 4, 6, 8 ...那 range(5) 为什么从 0 开始？"),
    (3, 50, 9101, "question", "for 循环能不能遍历一个列表？比如 for x in [1,2,3]"),
    (4, 15, 9001, "answer", "可以。for 循环的 in 后面可以是任何可迭代对象——列表、元组、字符串都行。"),
    (4, 30, 9106, "question", "那 for c in 'hello' 就是遍历每个字符？"),
    (5, 0, 9103, "question", "如果我想同时拿到索引和值怎么办？"),
    (5, 20, 9107, "question", "用 enumerate！for i, v in enumerate(list) 对吧？"),
    (6, 45, 9108, "question", "for 循环里用 break 跳出之后，else 还会执行吗？"),
    (7, 15, 9001, "question", "我们刚才都在说 for 循环。谁能告诉我 while 循环适合什么场景？"),
    (7, 30, 9102, "question", "不知道要循环多少次的时候用 while 对吧？比如用户输入密码"),
    (7, 50, 9104, "question", "while True 是死循环，怎么跳出？"),
    (8, 25, 9101, "question", "while 和 for 哪个效率更高？"),
    (8, 40, 9106, "question", "我试了一下，用 for 遍历列表比用 while + 索引遍历要快一点"),
    (9, 10, 9105, "question", "那为什么还要学 while？直接用 for 不就行了"),
    (9, 50, 9103, "question", "while 循环的条件可以是多个吗？比如 while a > 0 and b < 10"),
    (10, 0, 9001, "question", "刚才有同学问到列表遍历。如何给列表末尾添加元素？"),
    (10, 10, 9107, "question", "用 append！list.append(x)"),
    (10, 20, 9101, "question", "那 insert 和 append 有什么区别？insert 可以在指定位置插入"),
    (10, 40, 9108, "question", "list.pop() 是删除最后一个吗？能把删掉的元素返回吗？"),
    (11, 15, 9102, "question", "列表里能存不同类型的元素吗？比如 [1, hello, 3.14]"),
    (11, 45, 9104, "question", "那怎么判断一个元素在不在列表里？"),
    (12, 0, 9106, "question", "用 if x in list！"),
    (12, 15, 9104, "question", "in 运算符的时间复杂度是多少？是不是 O(n)？"),
    (12, 50, 9101, "question", "列表推导式 [x*2 for x in range(10)] 和 for 循环 append 哪个更快？"),
    (13, 30, 9105, "question", "推导式里能加 if 条件吗？比如 [x for x in nums if x > 10]"),
    (13, 45, 9103, "question", "嵌套推导式怎么写？比如把二维列表展平"),
    (15, 0, 9108, "question", "列表切片 list[1:5:2] 最后一个 2 是什么意思？"),
    (15, 20, 9102, "question", "步长！和 range 的第三个参数一样"),
    (16, 0, 9001, "question", "接下来我们把重复的逻辑封装成函数。定义一个函数用哪个关键字？"),
    (16, 10, 9104, "question", "def！def 函数名(参数):"),
    (16, 25, 9101, "question", "函数里的参数可以设默认值吗？比如 def greet(name='world')"),
    (17, 0, 9103, "question", "return 可以返回多个值吗？比如 return a, b"),
    (17, 30, 9105, "question", "函数内部定义的变量在外面能用吗？"),
    (18, 20, 9108, "question", "什么是 lambda 函数？和 def 有什么区别？"),
    (19, 20, 9106, "question", "sorted(list, key=lambda x: x[1]) 这个 key 参数是什么意思？"),
    (20, 0, 9104, "question", "函数的参数可以传函数进去吗？比如一个函数接收另一个函数作为参数"),
    (20, 45, 9103, "question", "*args 和 **kwargs 是干什么的？"),
    (21, 20, 9105, "question", "装饰器 @something 是怎么实现的？好像跟函数传参有关系"),
    (22, 10, 9001, "question", "编程中难免遇到错误。大家写代码时最常见的报错是什么？"),
    (22, 20, 9107, "question", "SyntaxError！少写了冒号或者括号不匹配"),
    (22, 35, 9102, "question", "IndentationError: unexpected indent。Python 的缩进太严格了"),
    (23, 10, 9108, "question", "我经常遇到 IndexError: list index out of range，怎么避免？"),
    (23, 30, 9104, "question", "在访问之前先检查 if index < len(list)"),
    (23, 50, 9101, "question", "还可以用 try...except 捕获异常！"),
    (24, 30, 9106, "question", "NameError: name x is not defined 是不是说明变量没定义？"),
    (25, 50, 9107, "question", "我的代码运行没报错但结果不对，这种情况怎么办？"),
    (27, 10, 9101, "question", "什么是递归深度错误 RecursionError？"),
    (28, 0, 9001, "question", "好，基础语法和调试我们都过了一遍。现在来做一道算法题：如何判断一个数是不是素数？"),
    (28, 15, 9103, "question", "从 2 遍历到 n-1，看能不能整除！如果能整除就不是素数"),
    (28, 30, 9106, "question", "其实只需要遍历到 sqrt(n) 就够了，因为因子成对出现"),
    (29, 10, 9101, "question", "那怎么求 1 到 100 之间的所有素数？用双层循环吗？"),
    (29, 30, 9105, "question", "可以用埃拉托斯特尼筛法！先假设都是素数，然后筛掉倍数"),
    (30, 30, 9102, "question", "九九乘法表用嵌套循环怎么写？"),
    (30, 45, 9104, "question", "for i in range(1,10): for j in range(1,i+1): print(f'{j}*{i}={i*j}')"),
    (31, 10, 9108, "question", "冒泡排序每次比较相邻两个元素对吗？交换次数是不是太多了？"),
    (31, 50, 9103, "question", "那选择排序和冒泡排序谁更快？"),
    (32, 10, 9106, "question", "选择排序交换次数少，每轮只换一次，但比较次数一样是 O(n²)"),
    (32, 30, 9101, "question", "Python 内置的 sort() 是什么排序算法？"),
    (33, 10, 9105, "question", "二分查找的前提是数组有序对吧？怎么用 Python 实现？"),
    (33, 50, 9102, "question", "递归实现二分查找和循环实现哪个更好？"),
    (34, 30, 9104, "question", "快速排序的原理是什么？就是选一个基准然后左右分治？"),
    (35, 0, 9001, "question", "今天我们学了循环、列表、函数、调试和算法基础。谁来总结一下今天最重要的收获？"),
    (36, 30, 9105, "question", "老师，下节课可以讲一下文件和异常处理吗？我之前读写文件老是出错"),
    (36, 45, 9108, "question", "我也想学 JSON 和 CSV 的数据读写！"),
    (37, 0, 9104, "question", "还有正则表达式！之前处理字符串都是手写的，太痛苦了"),
    (37, 30, 9101, "question", "老师，那个九九乘法表练习有样例代码吗？"),
]


async def main():
    engine = create_async_engine(DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession)

    async with Session() as s:
        # 1. agent
        r = await s.execute(text("SELECT id FROM znt_agents ORDER BY id LIMIT 1"))
        aid = r.scalar_one_or_none()
        if not aid:
            await s.execute(
                text("INSERT INTO znt_agents (id, name, agent_type, is_active) VALUES (1, 'test', 'general', true)")
            )
            await s.commit()
            aid = 1
        print(f"agent_id={aid}")

        # 2. users — clear old test entries by student_id, then insert fresh
        test_sids = [s["student_id"] for s in STUDENTS]
        for sid in test_sids:
            await s.execute(text("DELETE FROM znt_conversations WHERE user_id IN (SELECT id FROM sys_users WHERE student_id = :sid)"), {"sid": sid})
        await s.execute(text("DELETE FROM sys_users WHERE student_id = ANY(:sids)"), {"sids": test_sids})
        await s.execute(text("DELETE FROM znt_conversations WHERE user_id = :tid"), {"tid": TEACHER["id"]})
        await s.execute(text("DELETE FROM sys_users WHERE id = :tid"), {"tid": TEACHER["id"]})
        await s.commit()

        for u in [TEACHER] + STUDENTS:
            await s.execute(
                text(
                    "INSERT INTO sys_users (id, full_name, student_id, class_name, role_code, is_active, created_at, updated_at) "
                    "VALUES (:id, :full_name, :student_id, :class_name, :role_code, true, NOW(), NOW())"
                ),
                u,
            )

        # 3. conversations
        for ts, uid, mt, ct in [
            (_t(m, s), uid, mt, ct) for (m, s, uid, mt, ct) in CONVERSATIONS
        ]:
            await s.execute(
                text(
                    "INSERT INTO znt_conversations (user_id, agent_id, message_type, content, created_at) "
                    "VALUES (:uid, :aid, :mt, :ct, :ts)"
                ),
                {"uid": uid, "aid": aid, "mt": mt, "ct": ct, "ts": ts},
            )

        await s.commit()
        print(f"Done! {len(CONVERSATIONS)} records for agent_id={aid}")

    await engine.dispose()


asyncio.run(main())
