"use client";
import { useParams } from "next/navigation";
import NovelChapterSetup from "../../../../../../components/NovelChapterSetup";
export default function Page() {
  const params = useParams<{ storyId: string; chapterNumber: string }>();
  return <NovelChapterSetup storyId={params.storyId} chapterNumber={Number(params.chapterNumber)} />;
}

