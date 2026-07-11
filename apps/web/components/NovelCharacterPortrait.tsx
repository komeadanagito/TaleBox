import type { SelectableCharacter } from "../lib/import-novel/roles";

export default function NovelCharacterPortrait({ character, small = false }: { character?: Pick<SelectableCharacter, "name"> | undefined; small?: boolean }) {
  const palettes = [
    "from-stone-300 via-stone-100 to-zinc-300",
    "from-slate-300 via-zinc-100 to-stone-300",
    "from-amber-200 via-stone-100 to-zinc-300",
  ];
  const palette = palettes[(character?.name.codePointAt(0) || 0) % palettes.length];
  return (
    <span className={`${small ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-xs"} relative grid flex-none place-items-center overflow-hidden rounded-full border border-white/80 bg-gradient-to-br ${palette} font-serif font-semibold text-stone-700 shadow-sm`}>
      <span className="absolute inset-x-1 top-1 h-1/2 rounded-[50%] bg-black/10" />
      <span className="relative mt-2">{character ? [...character.name][0] : "?"}</span>
    </span>
  );
}
