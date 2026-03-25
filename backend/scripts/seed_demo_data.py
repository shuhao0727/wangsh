"""
写入模拟数据脚本 - 用于前端展示效果
包含：测评配置、题目、学生答题、初级画像、讨论消息、三维融合画像
"""
import asyncio
import json
from datetime import datetime, timedelta, date

import asyncpg

DB = dict(host='postgres', port=5432, database='wangsh_db', user='admin', password='dev_postgres_password')

async def main():
    conn = await asyncpg.connect(**DB)

    # ─── 0. 获取管理员ID ───
    admin_id = await conn.fetchval(
        "SELECT id FROM sys_users WHERE role_code='super_admin' AND full_name='系统超级管理员' LIMIT 1"
    )
    if not admin_id:
        admin_id = await conn.fetchval("SELECT id FROM sys_users WHERE role_code='super_admin' LIMIT 1")
    print(f'0. admin_id={admin_id}')

    # ─── 1. 创建测评配置 ───
    print('1. 创建测评配置...')
    config_id = await conn.fetchval("""
        INSERT INTO znt_assessment_configs
        (title, subject, grade, teaching_objectives, knowledge_points,
         total_score, time_limit_minutes, question_config, enabled, created_by_user_id)
        VALUES ('Python基础语法测评', '信息技术', '高一',
                '掌握Python基础语法，包括变量、数据类型、运算符、条件判断和循环',
                '变量与数据类型,运算符,条件判断,循环结构,函数基础',
                100, 45,
                $1, true, $2)
        RETURNING id
    """, json.dumps({
        'choice': {'count': 4, 'score_each': 10},
        'fill': {'count': 2, 'score_each': 10},
        'short_answer': {'count': 2, 'score_each': 20}
    }), admin_id)
    print(f'   config_id={config_id}')

    # ─── 2. 添加题目 ───
    print('2. 添加题目...')
    questions = [
        ('choice', 'Python中哪个关键字用于定义函数？',
         json.dumps({'A': 'func', 'B': 'def', 'C': 'function', 'D': 'define'}),
         'B', 10, 'easy', '变量与数据类型', 'Python使用def关键字定义函数'),
        ('choice', 'for i in range(5) 循环执行几次？',
         json.dumps({'A': '4', 'B': '5', 'C': '6', 'D': '3'}),
         'B', 10, 'easy', '循环结构', 'range(5)生成0-4共5个数'),
        ('choice', 'x = 10，x的数据类型是？',
         json.dumps({'A': 'str', 'B': 'float', 'C': 'int', 'D': 'bool'}),
         'C', 10, 'easy', '变量与数据类型', '整数字面量类型为int'),
        ('choice', '以下哪个是Python的逻辑运算符？',
         json.dumps({'A': '&&', 'B': 'and', 'C': '&', 'D': 'AND'}),
         'B', 10, 'medium', '运算符', 'Python使用and/or/not作为逻辑运算符'),
        ('fill', 'Python中用于输出内容的内置函数是____',
         None, 'print', 10, 'easy', '函数基础', 'print()是Python的内置输出函数'),
        ('fill', 'Python中用于获取列表长度的函数是____',
         None, 'len', 10, 'easy', '函数基础', 'len()返回序列的长度'),
        ('short_answer', '请简述Python中for循环和while循环的区别，并各举一个使用场景',
         None, 'for循环用于遍历可迭代对象，循环次数确定；while循环根据条件判断，循环次数不确定。for适合遍历列表，while适合等待用户输入。',
         20, 'medium', '循环结构', None),
        ('short_answer', '请解释Python中if-elif-else语句的执行流程',
         None, '先判断if条件，为True则执行if代码块；否则依次判断elif条件；都不满足则执行else代码块。整个结构只会执行一个分支。',
         20, 'medium', '条件判断', None),
    ]
    q_ids = []
    for qt, content, options, answer, score, diff, kp, expl in questions:
        qid = await conn.fetchval("""
            INSERT INTO znt_assessment_questions
            (config_id, question_type, content, options, correct_answer, score, difficulty, knowledge_point, explanation, source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual') RETURNING id
        """, config_id, qt, content, options, answer, score, diff, kp, expl)
        q_ids.append(qid)
    print(f'   {len(q_ids)} questions created')

    # ─── 3. 模拟学生答题 ───
    print('3. 模拟学生答题...')

    # 选几个真实的高一(2)班学生
    students = await conn.fetch("""
        SELECT id, full_name FROM sys_users
        WHERE class_name='高一(2)班' AND role_code='student' AND is_deleted=false
        ORDER BY id LIMIT 6
    """)
    print(f'   found {len(students)} students')

    # 每个学生的模拟答案和得分
    student_scores = [
        # (choice answers, fill answers, short scores, total)
        (['B','B','C','B'], ['print','len'], [18, 16], 94),  # 优秀
        (['B','B','C','A'], ['print','len'], [15, 14], 79),  # 良好
        (['B','A','C','B'], ['print','map'], [12, 10], 62),  # 中等
        (['A','B','A','B'], ['print','len'], [8, 6],   44),  # 待提升
        (['B','B','C','B'], ['print','len'], [16, 15], 91),  # 优秀
        (['B','A','C','A'], ['input','len'], [10, 8],  48),  # 待提升
    ]

    now = datetime.utcnow()
    session_ids = []
    for i, (student, scores) in enumerate(zip(students, student_scores)):
        sid = student['id']
        sname = student['full_name']
        choices, fills, shorts, total = scores

        started = now - timedelta(hours=6, minutes=30-i*5)
        submitted = started + timedelta(minutes=20+i*3)

        # 创建 session
        sess_id = await conn.fetchval("""
            INSERT INTO znt_assessment_sessions
            (config_id, user_id, status, earned_score, total_score, started_at, submitted_at)
            VALUES ($1, $2, 'graded', $3, 100, $4, $5) RETURNING id
        """, config_id, sid, total, started, submitted)
        session_ids.append(sess_id)

        # 创建 answers
        earned_list = []
        for j, (qid, qt) in enumerate(zip(q_ids, [q[0] for q in questions])):
            if qt == 'choice':
                ans = choices[j]
                correct = questions[j][3]
                is_correct = ans == correct
                ai_score = 10 if is_correct else 0
            elif qt == 'fill':
                fi = j - 4
                ans = fills[fi]
                correct = questions[j][3]
                is_correct = ans.lower() == correct.lower()
                ai_score = 10 if is_correct else 0
            else:
                si = j - 6
                ans = f'{sname}的回答：关于{questions[j][6]}的理解...'
                is_correct = shorts[si] >= 12
                ai_score = shorts[si]

            earned_list.append(ai_score)
            await conn.execute("""
                INSERT INTO znt_assessment_answers
                (session_id, question_id, question_type, student_answer, is_correct, ai_score, max_score, ai_feedback)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            """, sess_id, qid, qt, ans, is_correct, ai_score,
                 questions[j][4],
                 f'{"回答正确！" if is_correct else "需要加强理解。"}')

        print(f'   {sname}: session={sess_id}, score={total}/100')

    # ─── 4. 创建初级画像 ───
    print('4. 创建初级画像...')
    for i, (student, scores) in enumerate(zip(students, student_scores)):
        sid = student['id']
        total = scores[3]
        kp_scores = {}
        for j, q in enumerate(questions):
            kp = q[6]
            if kp not in kp_scores:
                kp_scores[kp] = {'earned': 0, 'total': 0}
            kp_scores[kp]['total'] += q[4]
            # 简化：按总分比例分配
            if q[0] == 'choice':
                kp_scores[kp]['earned'] += (q[4] if scores[0][j] == q[3] else 0)
            elif q[0] == 'fill':
                fi = j - 4
                kp_scores[kp]['earned'] += (q[4] if scores[1][fi].lower() == q[3].lower() else 0)
            else:
                si = j - 6
                kp_scores[kp]['earned'] += scores[2][si]

        wrong_kps = [k for k, v in kp_scores.items() if v['earned'] < v['total'] * 0.6]

        summaries = [
            f"该学生在本次Python基础测评中得分{total}/100。" +
            "知识掌握较为扎实，" + ("各知识点均表现优秀。" if total >= 85 else
            "部分知识点需要加强。" if total >= 60 else "多个知识点存在明显不足，建议重点复习。") +
            f"薄弱环节：{'、'.join(wrong_kps) if wrong_kps else '无'}。"
        ]

        await conn.execute("""
            INSERT INTO znt_assessment_basic_profiles
            (session_id, user_id, config_id, earned_score, total_score, knowledge_scores, wrong_points, ai_summary)
            VALUES ($1,$2,$3,$4,100,$5,$6,$7)
        """, session_ids[i], sid, config_id, total,
             json.dumps(kp_scores, ensure_ascii=False),
             json.dumps(wrong_kps, ensure_ascii=False),
             summaries[0])

    print('   basic profiles created')

    # ─── 5. 模拟讨论数据 ───
    print('5. 创建讨论数据...')
    disc_id = await conn.fetchval("""
        INSERT INTO znt_group_discussion_sessions
        (session_date, class_name, group_no, group_name, created_by_user_id, message_count)
        VALUES ($1, '高一(2)班', 'demo1', 'Python学习讨论组', $2, 12)
        ON CONFLICT (session_date, class_name, group_no) DO UPDATE SET group_name='Python学习讨论组'
        RETURNING id
    """, date.today(), admin_id)

    # 添加成员
    for s in students[:4]:
        await conn.execute("""
            INSERT INTO znt_group_discussion_members (session_id, user_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
        """, disc_id, s['id'])

    # 添加讨论消息
    messages = [
        (students[0], '大家觉得Python的for循环和while循环哪个更常用？'),
        (students[1], '我觉得for循环更常用，遍历列表特别方便'),
        (students[2], '同意，不过while循环在处理用户输入时很有用'),
        (students[0], '对，比如写一个猜数字游戏就需要while'),
        (students[3], '我还是不太理解range()函数的用法'),
        (students[1], 'range(5)就是生成0到4的序列，range(1,10)是1到9'),
        (students[0], '还可以加步长，range(0,10,2)就是0,2,4,6,8'),
        (students[2], '列表推导式里用for也很方便，[x**2 for x in range(10)]'),
        (students[3], '哦我明白了，那嵌套循环呢？'),
        (students[1], '嵌套循环就是循环里面再套循环，比如打印九九乘法表'),
        (students[0], '对，外层控制行，内层控制列'),
        (students[2], '大家有没有试过用递归代替循环？虽然不是必须的但很有趣'),
    ]
    base_time = datetime.utcnow() - timedelta(hours=3)
    for idx, (student, content) in enumerate(messages):
        await conn.execute("""
            INSERT INTO znt_group_discussion_messages
            (session_id, user_id, user_display_name, content, created_at)
            VALUES ($1, $2, $3, $4, $5)
        """, disc_id, student['id'], student['full_name'], content,
             base_time + timedelta(minutes=idx*2))

    print(f'   discussion session={disc_id}, {len(messages)} messages')

    # ─── 6. 获取一个可用的智能体 ───
    agent_id = await conn.fetchval(
        "SELECT id FROM znt_agents WHERE is_deleted=false AND is_active=true LIMIT 1"
    )
    if not agent_id:
        agent_id = await conn.fetchval("""
            INSERT INTO znt_agents (name, description, agent_type, is_active, is_deleted)
            VALUES ('画像分析助手', '用于生成学生学习画像', 'openai', true, false)
            RETURNING id
        """)
    print(f'   agent_id={agent_id}')

    # ─── 6. 创建三维融合画像 ───
    print('6. 创建三维融合画像...')

    # 个人画像 - 为前4个学生生成
    individual_profiles = [
        (students[0], 94, {'知识掌握': 92, '协作能力': 88, '自主学习': 85, '思维特征': 90, '知识盲点修复': 78}, """## 一、知识掌握（基于测评）

该生在Python基础测评中表现优异，得分94/100。变量与数据类型、运算符、循环结构等核心知识点掌握扎实，仅在简答题表述上略有不足。函数基础部分满分，说明对print、len等内置函数理解到位。

## 二、协作能力（基于讨论）

在小组讨论中表现活跃，主动发起话题并引导讨论方向。能够用具体代码示例（如range步长、猜数字游戏）帮助同学理解概念，展现了良好的知识分享意识和表达能力。发言质量高，逻辑清晰。

## 三、自主学习（基于AI对话）

善于利用AI智能体进行深度学习，提问质量较高，能够从基础概念延伸到实际应用场景。有明显的深度追问习惯，不满足于表面理解。

## 四、思维特征

综合三方数据分析，该生属于**应用型思维**。不仅能记忆和理解知识点，还善于将知识应用到实际编程场景中，如用while循环设计猜数字游戏、用range步长生成偶数序列等。

## 五、知识盲点（三方数据交叉验证）

暂未发现明显知识盲点。简答题中对条件判断的执行流程描述可以更加精确，建议加强对if-elif-else分支逻辑的系统性理解。

## 六、个性化学习建议

1. 尝试挑战更复杂的编程项目（如小型游戏开发），将基础知识融会贯通
2. 可以开始学习Python的面向对象编程，为进阶做准备
3. 鼓励在小组讨论中担任"小老师"角色，通过教学巩固自身理解"""),

        (students[1], 79, {'知识掌握': 78, '协作能力': 72, '自主学习': 65, '思维特征': 70, '知识盲点修复': 55}, """## 一、知识掌握（基于测评）

得分79/100，整体表现良好。选择题中运算符部分失分，说明对Python逻辑运算符（and/or/not）与其他语言的区别认识不够清晰。填空题和简答题表现中等偏上。

## 二、协作能力（基于讨论）

讨论中积极回应同学提问，能够用简洁的语言解释range()函数和嵌套循环的概念。互动模式以"解答者"为主，善于将复杂概念简化表达。

## 三、自主学习（基于AI对话）

使用AI智能体频率适中，主要围绕课堂知识点进行巩固性学习。提问较为基础，建议增加探索性提问。

## 四、思维特征

属于**理解型思维**，能够准确理解和复述知识点，但在创造性应用方面还有提升空间。

## 五、知识盲点

- 运算符：对Python特有的逻辑运算符掌握不牢
- 测评中运算符题目失分，讨论中未涉及该话题，AI对话中也未主动提问

## 六、个性化学习建议

1. 重点复习Python运算符，特别是逻辑运算符和位运算符的区别
2. 多做运算符相关的编程练习，如布尔表达式求值
3. 尝试在讨论中主动提出自己不确定的知识点，利用同伴学习"""),

        (students[2], 62, {'知识掌握': 60, '协作能力': 50, '自主学习': 40, '思维特征': 55, '知识盲点修复': 35}, """## 一、知识掌握（基于测评）

得分62/100，刚过及格线。选择题中循环结构和填空题中函数基础部分失分较多，说明对range()函数和常用内置函数的掌握不够熟练。简答题得分偏低，文字表达能力需要加强。

## 二、协作能力（基于讨论）

在讨论中能够参与互动，提出了列表推导式和递归等进阶话题，说明有一定的知识广度。但发言频率偏低，主动性有待提高。

## 三、自主学习（基于AI对话）

AI对话数据较少，自主学习意识需要加强。建议更多利用AI智能体进行针对性练习。

## 四、思维特征

属于**记忆型向理解型过渡**阶段。能记住部分知识点但理解深度不够，容易在变式题目中出错。

## 五、知识盲点

- 循环结构：range()函数参数理解不清
- 函数基础：混淆了print和input、len和map等函数
- 简答题表述能力薄弱

## 六、个性化学习建议

1. 每天花15分钟在Python交互环境中练习range()和常用内置函数
2. 尝试用自己的话写出每个知识点的理解笔记，提升表达能力
3. 积极参与小组讨论，多向同学请教不理解的概念"""),

        (students[3], 44, {'知识掌握': 42, '协作能力': 45, '自主学习': 30, '思维特征': 38, '知识盲点修复': 25}, """## 一、知识掌握（基于测评）

得分44/100，未达及格线。多个知识点存在明显不足：变量与数据类型基础概念混淆，运算符使用不熟练，简答题得分很低。需要系统性地重新学习基础知识。

## 二、协作能力（基于讨论）

在讨论中主要以提问为主，表现出学习意愿但基础薄弱。能够坦诚表达自己的困惑（如"不太理解range()函数"），这是积极的学习态度。

## 三、自主学习（基于AI对话）

AI对话数据不足，建议大幅增加与AI智能体的互动频率，利用AI进行基础知识的反复练习和答疑。

## 四、思维特征

目前处于**记忆型思维**阶段，对知识点的理解停留在表面，需要通过大量练习建立深层理解。

## 五、知识盲点

- 变量与数据类型：基础概念不清晰
- 运算符：逻辑运算符使用错误
- 循环结构：range()函数不理解
- 函数基础：常用函数混淆

## 六、个性化学习建议

1. 从Python官方教程的基础章节重新开始，每天学习一个小知识点
2. 每个知识点配合3-5道练习题，确保理解后再进入下一个
3. 主动找成绩好的同学结对学习，遇到问题及时请教"""),
    ]

    for student, score, dims, text in individual_profiles:
        await conn.execute("""
            INSERT INTO znt_student_profiles
            (profile_type, target_id, config_id, discussion_session_id, agent_ids,
             agent_id, data_sources, result_text, scores, created_by_user_id)
            VALUES ('individual', $1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, str(student['id']), config_id, disc_id,
             json.dumps([agent_id]),
             agent_id,
             json.dumps(['assessment', 'discussion', 'agent_chat']),
             text,
             json.dumps({'total': score, 'dimensions': dims}, ensure_ascii=False),
             admin_id)

    print(f'   4 individual profiles created')

    # 小组画像
    group_text = """## 一、整体水平

小组4名成员平均分69.75/100，最高分94分，最低分44分，分差较大。整体知识掌握呈两极分化：2人优秀（90+），1人中等（62），1人待提升（44）。循环结构和函数基础是共同薄弱点。

## 二、成员互补性

成员间知识互补性较强：高分同学在变量与数据类型、运算符方面表现突出，可以帮助低分同学；而低分同学在讨论中提出的基础问题，也促使高分同学重新审视和巩固基础概念。

## 三、协作模式

讨论呈现"一主导、一辅助、两跟随"的模式。第一位同学主导话题方向，第二位同学积极补充解答，第三位同学偶尔贡献进阶观点，第四位同学主要提问。整体参与度不够均衡。

## 四、薄弱环节

- range()函数的参数用法（多人不清楚）
- 循环的实际应用场景理解不足
- 简答题文字表达能力普遍偏弱

## 五、小组提升建议

1. 建立"结对帮扶"机制，高分同学每周辅导低分同学一次
2. 每次讨论前设定明确的讨论主题和目标，确保每人至少发言3次
3. 小组共同完成一个编程小项目（如计算器或猜数字游戏），在实践中巩固知识"""

    await conn.execute("""
        INSERT INTO znt_student_profiles
        (profile_type, target_id, config_id, discussion_session_id, agent_ids,
         agent_id, data_sources, result_text, scores, created_by_user_id)
        VALUES ('group', $1, $2, $3, $4, $5, $6, $7, $8, $9)
    """, str(disc_id), config_id, disc_id,
         json.dumps([agent_id]),
         agent_id,
         json.dumps(['assessment', 'discussion']),
         group_text,
         json.dumps({'avg_score': 69.75, 'max': 94, 'min': 44, 'dimensions': {'整体水平': 68, '成员互补性': 72, '协作模式': 58, '知识覆盖': 65, '讨论质量': 62}}),
         admin_id)
    print('   group profile created')

    # 群体画像
    class_text = """## 一、知识点掌握分布

全班整体表现：变量与数据类型掌握最好（平均正确率78%），其次是函数基础（72%）。运算符（65%）和条件判断（60%）处于中等水平。循环结构是最薄弱的知识点（55%），特别是range()函数的多参数用法和嵌套循环。

## 二、共性问题

1. **运算符混淆**：约35%的学生将Python的and/or与其他语言的&&/||混淆
2. **range()理解不足**：约40%的学生不清楚range的三参数用法
3. **简答表达薄弱**：简答题平均得分率仅58%，多数学生能理解概念但无法准确表述

## 三、学习模式分析

全班学习模式呈正态分布：约20%的学生属于应用型（能灵活运用知识），50%属于理解型（能理解但应用不足），30%属于记忆型（停留在表面记忆）。自主学习意识整体偏弱，AI智能体使用率不到40%。

## 四、分层教学建议

- **优秀层（≥85分，约20%）**：引入面向对象编程、文件操作等进阶内容，鼓励参与编程竞赛或开源项目
- **中等层（60-84分，约45%）**：强化运算符和循环结构的练习，通过项目式学习提升应用能力
- **待提升层（<60分，约35%）**：回归基础，每日一练，建立知识点检查清单，安排结对辅导

## 五、教学调整建议

1. 下节课安排一次运算符和循环结构的专项练习课，重点讲解range()的多种用法
2. 增加课堂编程实践环节，减少纯理论讲授，让学生在"做中学"
3. 建立班级编程互助群，鼓励学生课后互相答疑，教师每周汇总共性问题进行集中讲解"""

    await conn.execute("""
        INSERT INTO znt_student_profiles
        (profile_type, target_id, config_id, discussion_session_id, agent_ids,
         agent_id, data_sources, result_text, scores, created_by_user_id)
        VALUES ('class', '高一(2)班', $1, NULL, $2, $3, $4, $5, $6, $7)
    """, config_id,
         json.dumps([]),
         agent_id,
         json.dumps(['assessment']),
         class_text,
         json.dumps({'avg_score': 69.5, 'pass_rate': 0.65, 'dimensions': {'知识掌握': 68, '共性问题': 52, '学习模式': 58, '分层教学': 62, '教学效果': 55}}),
         admin_id)
    print('   class profile created')

    print(f'\n=== Summary ===')
    print(f'Config: id={config_id}')
    print(f'Questions: {len(q_ids)}')
    print(f'Students with sessions: {len(students)}')
    print(f'Discussion: id={disc_id}')
    print(f'Profiles: 4 individual + 1 group + 1 class')

    await conn.close()
    print('\nDone!')

asyncio.run(main())
