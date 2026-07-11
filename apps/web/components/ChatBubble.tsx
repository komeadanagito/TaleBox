"use client";

import React, { useState, useEffect } from "react";
import { Square, Volume2 } from "lucide-react";
import { Character, Message } from "../app/context/StoryContext";

interface ChatBubbleProps {
  message: Message;
  primaryCharacterAvatar?: string;
  protagonistName?: string | undefined;
  revealLimit?: number | undefined;
  isStreaming?: boolean;
  characters?: Character[];
}

type VoiceProfile = Pick<Character, "age" | "gender" | "personality" | "persona" | "speechStyle">;

function getVoiceSettings(profile?: VoiceProfile) {
  const age = Number.parseInt(profile?.age || "", 10);
  const personality = [profile?.personality, profile?.persona, profile?.speechStyle].filter(Boolean).join(" ");
  let rate = 0.98;
  let pitch = 1;

  if (!Number.isNaN(age)) {
    if (age <= 18) pitch = profile?.gender === "female" ? 1.12 : 1.05;
    if (age >= 50) {
      rate = 0.88;
      pitch = 0.88;
    }
  }
  if (/冷静|克制|沉稳|安静|内向|敏感|低沉|舒缓/.test(personality)) {
    rate -= 0.12;
    pitch -= 0.06;
  }
  if (/活泼|开朗|急躁|热情|俏皮/.test(personality)) {
    rate += 0.12;
    pitch += 0.08;
  }
  if (/强硬|傲慢|严厉|冷酷|威严/.test(personality)) {
    rate -= 0.04;
    pitch -= 0.14;
  }
  if (/温柔|亲切|柔和|甜美/.test(personality)) {
    rate -= 0.04;
    pitch += 0.1;
  }

  return { rate: Math.max(0.75, Math.min(1.2, rate)), pitch: Math.max(0.75, Math.min(1.25, pitch)) };
}

function selectChineseVoice(voices: SpeechSynthesisVoice[], profile?: VoiceProfile) {
  const chineseVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("zh"));
  const candidates = chineseVoices.length > 0 ? chineseVoices : voices;
  const femaleTokens = ["xiaoxiao", "xiaoyi", "xiaorou", "xiaomeng", "xiaoyu", "xiaozhen", "tingting", "meijia", "晓晓", "晓伊", "晓柔", "小萌", "小宇", "晓真", "婷婷", "美佳", "female", "女"];
  const maleTokens = ["yunxi", "yunyang", "yunfeng", "yunjian", "yunxia", "yunhao", "sinji", "limu", "云希", "云扬", "云峰", "云健", "云夏", "云皓", "男性", "male", "男"];
  const preferredTokens = profile?.gender === "female" ? femaleTokens : profile?.gender === "male" ? maleTokens : [];
  const oppositeTokens = profile?.gender === "female" ? maleTokens : profile?.gender === "male" ? femaleTokens : [];

  return [...candidates].sort((a, b) => {
    const score = (voice: SpeechSynthesisVoice) => {
      const name = voice.name.toLowerCase().replace(/[\s_-]+/g, "");
      return (preferredTokens.some((token) => name.includes(token)) ? 2 : 0)
        - (oppositeTokens.some((token) => name.includes(token)) ? 1 : 0)
        + (voice.lang.toLowerCase().startsWith("zh-cn") ? 0.5 : 0);
    };
    return score(b) - score(a);
  })[0];
}

function SpeechButton({ text, profile, disabled = false }: { text: string; profile?: VoiceProfile | undefined; disabled?: boolean | undefined }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const reset = () => setIsSpeaking(false);
    window.addEventListener("talebox-tts-stop", reset);
    return () => window.removeEventListener("talebox-tts-stop", reset);
  }, []);

  useEffect(() => {
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      window.dispatchEvent(new Event("talebox-tts-stop"));
      return;
    }

    window.dispatchEvent(new Event("talebox-tts-stop"));
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const { rate, pitch } = getVoiceSettings(profile);
    utterance.lang = "zh-CN";
    utterance.rate = rate;
    utterance.pitch = pitch;
    const voice = selectChineseVoice(voices.length > 0 ? voices : window.speechSynthesis.getVoices(), profile);
    if (voice) utterance.voice = voice;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={isSpeaking ? "停止朗读" : "朗读此段"}
      title={isSpeaking ? "停止朗读" : "朗读此段"}
      className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-zinc-400 transition-colors hover:border-neutral-900 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isSpeaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
    </button>
  );
}

// Typewriter paragraph: animate=true runs the typing effect, animate=false renders text instantly
function TypewriterParagraph({
  text,
  className,
  animate,
  voiceProfile,
  ttsDisabled,
}: {
  text: string;
  className: string;
  animate: boolean;
  voiceProfile?: VoiceProfile | undefined;
  ttsDisabled?: boolean | undefined;
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

  return (
    <div className="flex items-start gap-2">
      <p className={`flex-1 ${className}`}>{displayed}</p>
      <SpeechButton text={text} profile={voiceProfile} disabled={ttsDisabled} />
    </div>
  );
}

// Typewriter dialogue: animate=true runs the typing effect, animate=false renders text instantly
function TypewriterDialogue({
  speaker,
  speech,
  animate,
  voiceProfile,
  ttsDisabled,
}: {
  speaker: string;
  speech: string;
  animate: boolean;
  voiceProfile?: VoiceProfile | undefined;
  ttsDisabled?: boolean | undefined;
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
          <SpeechButton text={speech} profile={voiceProfile} disabled={ttsDisabled} />
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
  isStreaming = false,
  characters,
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
  const narratorProfile: VoiceProfile = {
    age: "35 岁",
    gender: "male",
    personality: "沉稳克制，叙述感强",
    speechStyle: "语速舒缓，声音低沉"
  };
  const fallbackCharacterProfile = characters?.find((character) => character.id === "char_1") || characters?.[0];

  return (
    <div className="w-full space-y-3">
      {paragraphsToShow.map((para, idx) => {
        let trimmed = para.trim();
        // Robustness: strip accidental Markdown list prefixes like "- " or "* "
        trimmed = trimmed.replace(/^[-*]\s+/, "");

        // The server already streams text token-by-token. Replaying a typewriter
        // animation for every incoming chunk resets the paragraph and causes flicker.
        const animate = !isStreaming && isLiveMessage && idx === paragraphsToShow.length - 1;

        // Match character dialogue pattern: **Speaker**："dialogue"
        const dialogueMatch = trimmed.match(/^\*\*(.*?)\*\*[:：]?\s*[""「]?(.*?)[""\u300d]?$/s);

        if (dialogueMatch) {
          const speaker = dialogueMatch[1]?.trim() || "神秘人";
          const speech = dialogueMatch[2]?.trim() || "";
          const speakerProfile = characters?.find((character) => character.name === speaker) || fallbackCharacterProfile || narratorProfile;
          return (
            <TypewriterDialogue
              key={`${idx}-${paragraphsToShow.length}`}
              speaker={speaker}
              speech={speech}
              animate={animate}
              voiceProfile={speakerProfile}
              ttsDisabled={isStreaming}
            />
          );
        }

        return (
          <div key={`${idx}-${paragraphsToShow.length}`} className="w-full py-2">
            <TypewriterParagraph
              text={trimmed}
              className="text-zinc-600 font-serif text-sm leading-relaxed text-justify indent-8 tracking-wide"
              animate={animate}
              voiceProfile={narratorProfile}
              ttsDisabled={isStreaming}
            />
          </div>
        );
      })}
    </div>
  );
}
