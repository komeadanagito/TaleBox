"use client";

import React, { useState, useEffect } from "react";
import { Message } from "../app/context/StoryContext";

interface ChatBubbleProps {
  message: Message;
  primaryCharacterAvatar?: string;
  protagonistName?: string | undefined;
  revealLimit?: number | undefined;
}

// Typewriter paragraph: animate=true runs the typing effect, animate=false renders text instantly
function TypewriterParagraph({
  text,
  className,
  animate,
}: {
  text: string;
  className: string;
  animate: boolean;
}) {
  const [displayed, setDisplayed] = useState(animate ? "" : text);

  useEffect(() => {
    if (!animate) {
      setDisplayed(text);
      return;
    }
    setDisplayed("");
    let currentLength = 0;
    const interval = setInterval(() => {
      currentLength++;
      setDisplayed(text.substring(0, currentLength));
      if (currentLength >= text.length) {
        clearInterval(interval);
      }
    }, 12);
    return () => clearInterval(interval);
  }, [text, animate]);

  return <p className={className}>{displayed}</p>;
}

// Typewriter dialogue: animate=true runs the typing effect, animate=false renders text instantly
function TypewriterDialogue({
  speaker,
  speech,
  animate,
}: {
  speaker: string;
  speech: string;
  animate: boolean;
}) {
  const [displayedSpeech, setDisplayedSpeech] = useState(animate ? "" : speech);

  useEffect(() => {
    if (!animate) {
      setDisplayedSpeech(speech);
      return;
    }
    setDisplayedSpeech("");
    let currentLength = 0;
    const interval = setInterval(() => {
      currentLength++;
      setDisplayedSpeech(speech.substring(0, currentLength));
      if (currentLength >= speech.length) {
        clearInterval(interval);
      }
    }, 12);
    return () => clearInterval(interval);
  }, [speech, animate]);

  return (
    <div className="w-full py-2 flex gap-3 items-start">
      <span className="h-6 w-6 rounded bg-neutral-900 text-white flex items-center justify-center text-[9px] font-bold mt-0.5 shadow-sm flex-shrink-0">
        {speaker[0] || "AI"}
      </span>
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-zinc-950 font-serif">{speaker}</span>
          <span className="text-[9px] text-zinc-400 font-sans px-1 border border-neutral-200 rounded scale-90 origin-left">
            对话
          </span>
        </div>
        <p className="text-zinc-900 font-serif text-sm font-medium leading-relaxed tracking-wide">
          "{displayedSpeech}"
        </p>
      </div>
    </div>
  );
}

export default function ChatBubble({
  message,
  primaryCharacterAvatar,
  protagonistName,
  revealLimit,
}: ChatBubbleProps) {
  const { role, content } = message;

  // 1. User Choice/Action Paragraph
  if (role === "user") {
    return (
      <div className="w-full py-3 border-l-2 border-neutral-400 pl-4 my-2 bg-neutral-50/50 rounded-r-lg">
        <div className="flex items-start gap-2">
          <span className="text-neutral-500 font-mono text-xs mt-0.5">✦</span>
          <p className="text-zinc-800 font-serif text-sm font-medium tracking-wide leading-relaxed">
            {content.startsWith("\u201c") || content.startsWith("\u300c")
              ? content
              : `你选择：${content}`}
          </p>
        </div>
      </div>
    );
  }

  // 2. AI Story Turn Paragraphs
  const paragraphs = content.split("\n\n").filter((p) => p.trim());

  // Apply revealLimit to only render unlocked paragraphs for the latest message
  const paragraphsToShow =
    revealLimit !== undefined ? paragraphs.slice(0, revealLimit) : paragraphs;

  const isLiveMessage = revealLimit !== undefined;

  return (
    <div className="w-full space-y-3">
      {paragraphsToShow.map((para, idx) => {
        const trimmed = para.trim();
        // Only the last revealed paragraph gets the typewriter animation
        const animate = isLiveMessage && idx === paragraphsToShow.length - 1;

        // Match character dialogue pattern: **Speaker**："dialogue"
        const dialogueMatch = trimmed.match(/^\*\*(.*?)\*\*[:：]?\s*[""「]?(.*?)[""\u300d]?$/s);

        if (dialogueMatch) {
          const speaker = dialogueMatch[1]?.trim() || "神秘人";
          const speech = dialogueMatch[2]?.trim() || "";
          return (
            <TypewriterDialogue
              key={`${idx}-${paragraphsToShow.length}`}
              speaker={speaker}
              speech={speech}
              animate={animate}
            />
          );
        }

        return (
          <div key={`${idx}-${paragraphsToShow.length}`} className="w-full py-2">
            <TypewriterParagraph
              text={trimmed}
              className="text-zinc-600 font-serif text-sm leading-relaxed text-justify indent-8 tracking-wide"
              animate={animate}
            />
          </div>
        );
      })}
    </div>
  );
}
