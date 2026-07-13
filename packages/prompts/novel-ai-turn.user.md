章节：{{CHAPTER_TITLE}}
当前身份：{{ROLE_NAME}}
叙事模式：{{NARRATIVE_MODE}}
已识别角色姓名：{{CHARACTER_NAMES}}
当前地点：{{CURRENT_LOCATION}}
上一选择：{{SELECTED_CHOICE}}
上一选择模式：{{SELECTED_CHOICE_KIND}}
最近选择：{{RECENT_DECISIONS}}
是否为本章最后窗口：{{IS_FINAL}}

当前故事运行快照（版本化状态、角色可见记忆与已知图谱；为空表示第一回合）：
<runtime>
{{STORY_RUNTIME}}
</runtime>

当前原文窗口：
<source>
{{SOURCE_PARAGRAPHS}}
</source>

输出结构：
{
  "location": "当前剧情所在地点",
  "blocks": [
    { "type": "narration", "speaker": null, "text": "忠于当前原文的叙事" },
    { "type": "dialogue", "speaker": "原文人物名", "text": "忠于当前原文含义的对话" }
  ],
  "choices": [
    { "kind": "observe", "label": "符合当前叙事模式的有限选择", "hint": "选择意图" }
  ]
}

约束：
- blocks 返回 2 至 8 项，只呈现当前窗口，不总结整章。
- location 仅在当前原文明示地点变化时更新，否则原样返回当前地点。
- speaker 必须逐字选自“已识别角色姓名”，不得用身份或性别代称。
- type 只能是 narration、dialogue、action；narration 的 speaker 必须为 null。
- choices 返回 2 至 3 项，kind 只能是 observe、focus、act、speak、explore；最后窗口返回空数组。
- 遵循原作：不得返回 explore，所有选择都必须自然衔接原文，基本不改变原作事实。
- 自由探索：选择应更具差异性，至少包含一个能改变当前行动或局部结果的 explore；同时保留一个贴近原著走向的选项。
- 玩家自由输入按 explore 处理：理解行动意图，但不要把玩家输入原样扩写成不符合人物或世界观的事实。
- 运行快照只能作为已经发生过的分支事实使用，不得据此提前推断原文后续。
