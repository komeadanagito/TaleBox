"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import NovelChapterPlay from "../../../../../../components/NovelChapterPlay";
function PlayPage() {
  const params = useParams<{ storyId: string; chapterNumber: string }>();
  return <NovelChapterPlay storyId={params.storyId} chapterNumber={Number(params.chapterNumber)} />;
}
export default function Page() { return <Suspense><PlayPage /></Suspense>; }

