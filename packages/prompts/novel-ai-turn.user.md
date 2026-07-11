章节：{{CHAPTER_TITLE}}
当前身份：{{ROLE_NAME}}
已识别角色姓名：{{CHARACTER_NAMES}}
当前地点：{{CURRENT_LOCATION}}
上一选择：{{SELECTED_CHOICE}}
最近选择：{{RECENT_DECISIONS}}
是否为本章最后窗口：{{IS_FINAL}}

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
    { "kind": "observe", "label": "有限选择", "hint": "选择意图" }
  ]
}

约束：
- blocks 返回 2 至 8 项，只呈现当前窗口，不总结整章。
- location 仅在当前原文明示地点变化时更新，否则原样返回当前地点。
- speaker 必须逐字选自“已识别角色姓名”，不得用身份或性别代称。
- type 只能是 narration、dialogue、action；narration 的 speaker 必须为 null。
- choices 最多 3 项，kind 只能是 observe、focus、act、speak。
- 最后窗口 choices 必须为空数组；其他窗口返回 2 至 3 项。
- 选择应能自然衔接下一段原文，不得承诺改变原著主线。
