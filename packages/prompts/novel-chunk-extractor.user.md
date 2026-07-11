章节：{{CHAPTER_TITLE}}

返回且只返回以下字段：
- characters：最多 6 项。每项只能包含 id、name、role、playable、evidenceParagraphId。
- beats：1 至 6 项。每项只能包含 startParagraphId、endParagraphId、characterIds、choiceTemplates。
- choiceTemplates：每个 beat 最多 2 项。每项只能包含 kind、anchorParagraphId、targetCharacterId、roleIds。
- isNonNarrative：布尔值。如果当前文本是前言、简介、版权页、目录、作者简介、致谢、出版说明等非故事性（即不包含具体剧情小说正文叙事）的段落，返回 true，否则返回 false。

严格规则：
1. characters 只收录当前原文块明确出现的人物；没有则返回空数组。
2. id 使用由姓名生成的简短小写英文或拼音短横线 ID。name 必须逐字出现在 evidenceParagraphId 对应原文中。
3. role 只有在同一证据段落中存在明确身份短语时才填写，否则为空字符串。
4. 人物在当前原文块中有直接行动、决定、对话或持续视角时，playable 必须为 true；只被提及、没有参与当前事件时才为 false。
5. beats 必须按输入顺序完整划分所有段落。每个段落必须且只能属于一个 beat，区间连续、无遗漏、无重叠。
6. characterIds 只能引用当前 characters 的 id。
7. choiceTemplates 可为空；没有充分依据时不要生成。kind 只能是 observe_character 或 focus_source。
8. anchorParagraphId 必须位于所属 beat。observe_character 的 targetCharacterId 必须是该 beat 中的人物；focus_source 的 targetCharacterId 必须为 null。
9. roleIds 只能引用 playable=true 的人物；空数组表示适用于所有可扮演人物。
10. 所有段落 ID 必须逐字来自输入。不得为了满足数量要求虚构人物、节点或模板。

原文：
<source>
{{CHAPTER_CONTENT}}
</source>
