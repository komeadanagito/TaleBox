你正在把一章已出版小说改编为“有限选项式角色扮演阅读”。请只依据给定原文分析，不续写原文之外的事实，不泄露本章之后的剧情。

小说名：{{NOVEL_TITLE}}
章节名：{{CHAPTER_TITLE}}
上一章摘要：{{PREVIOUS_SUMMARY}}

【带段落编号的本章原文】
{{CHAPTER_CONTENT}}
【原文结束】

请输出一个合法 JSON 对象，不要输出 Markdown：
{
  "summary": "本章开局背景摘要，80字以内",
  "goal": "玩家在本章可推进的核心目标，40字以内",
  "location": "主要地点",
  "characters": [
    {
      "id": "稳定的英文或拼音短横线ID",
      "name": "姓名",
      "role": "本章身份",
      "description": "不剧透的角色简介，50字以内",
      "status": "entering或continuing",
      "playable": true,
      "initials": "一个汉字"
    }
  ],
  "beats": [
    {
      "id": "beat-01",
      "order": 1,
      "title": "不剧透的剧情节点标题",
      "summary": "这一节点发生的核心事件",
      "startParagraphId": "p-0001",
      "endParagraphId": "p-0005",
      "location": "地点",
      "characterIds": ["角色ID"],
      "required": true,
      "completionCondition": "玩家满足什么事实后可进入下一节点"
    }
  ],
  "blocks": [
    { "type": "narration", "text": "忠于原文的开场旁白" },
    { "type": "dialogue", "speaker": "人物姓名", "text": "原文中存在或忠实改写的台词" }
  ],
  "choices": [
    { "id": "choice-1", "label": "以可扮演角色视角可执行的行动或台词", "hint": "该选择的意图，不剧透结果" }
  ]
}

规则：
1. characters 返回本章最重要的 2~6 人，至少一人 playable=true；幕后身份、短暂功能角色或被操控会破坏剧情的角色设为 false。
2. blocks 返回 3~6 段，保持原作事件顺序和文风，不大段复制原文。
3. choices 返回 2~4 项，只允许有限选择，不提供自由输入。
4. 过程可以分支，但选项不得让故事脱离本章核心事件。
5. beats 按原文顺序返回 4~12 个剧情节点，段落 ID 必须来自输入；覆盖整章但不要彼此大范围重叠。
6. 必须将决定章节能否自然衔接的节点标记为 required=true。
