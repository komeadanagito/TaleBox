# TaleBox Immersive Chat UI Design

## Goal

Optimize `docs/pen_file/talebox.pen` into an immersive AI chat novel mobile UI. The product should feel like a natural chat app for entering and continuing stories, without social-network features.

## Product Direction

Use the approved direction: **immersive chat continuation**.

Keep the four existing tabs:

- Dialogue
- Bookshelf
- AI Creation
- Me

Do not add publishing, likes, follows, rankings, feeds, comments, or public profile behavior.

## Visual System

- Mood: quiet, rounded, immersive, story-first, chat-native.
- Background: milky white surface with very soft contrast.
- Accent: deep violet for selected states and primary actions.
- Text: dark ink for primary text, muted gray-brown for secondary text.
- Shape: more rounded than the current design. Use pill search fields, rounded story cards, circular avatars, pill buttons, and a floating capsule tab bar.
- Typography: readable mobile UI type, with stronger title hierarchy and natural dialogue previews.
- Icons: replace emoji-like structural icons with consistent simple vector/icon-like marks.

## Screen Behavior

### Dialogue

Make the first screen feel closest to a chat app. Do not use a large hero/current-story card. All stories should be presented as small chat cards.

Support a pinned conversation card at the top, followed by normal private conversation threads with character lines and progress metadata.

### Bookshelf

Treat the bookshelf as private story conversation management. Keep world settings and update reminders, but present them as quiet utility rows. Story rows show reading state, chapter, progress, and last interaction time.

### AI Creation

Reframe as private story creation. Keep two main actions: generate a story from inspiration and import a local novel. Text should be shorter and not clipped. Recent drafts behave like a private draft box.

### Me

Use the page for private reading records and settings. Keep it light: reading profile, reading statistics, reading records, model preferences, and privacy/data controls. Creation and draft management belong on the AI Creation page. Avoid achievement or social profile framing.

## Quality Requirements

- Keep all four frames at mobile size `375 x 812`.
- Respect top and bottom safe areas.
- Do not let content sit behind the bottom tab bar.
- Fix current clipped text in the AI Creation screen.
- Fix zero-width dividers.
- Use a consistent spacing rhythm: 8, 12, 16, 20, 24.
- Use rounded surfaces consistently.
- Remove top-right action buttons when the same destination already exists in bottom navigation or page content.
- Verify the resulting layout with Pencil layout checks and screenshots.
