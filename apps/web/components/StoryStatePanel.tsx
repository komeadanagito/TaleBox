"use client";

import React from "react";
import { Plus, Trash2, Box, MapPin, CheckCircle2, Play } from "lucide-react";
import { useStory, Character, Scene, Item } from "../app/context/StoryContext";

interface StoryStatePanelProps {
  onConfirm: () => void;
}

export default function StoryStatePanel({ onConfirm }: StoryStatePanelProps) {
  const {
    generatedFramework,
    setGeneratedFramework,
    frameworkTab,
    setFrameworkTab
  } = useStory();

  if (!generatedFramework) return null;

  // Framework Helpers: Add & Delete Character
  const addCharacter = () => {
    const newChar: Character = {
      id: `char_new_${Date.now()}`,
      name: "新配角",
      role: "故事中的关键NPC",
      persona: "性格特点与隐秘动机描述...",
      speechStyle: "对话风格说明..."
    };
    setGeneratedFramework({
      ...generatedFramework,
      characters: [...generatedFramework.characters, newChar]
    });
  };

  const deleteCharacter = (id: string) => {
    if (generatedFramework.characters.length <= 1) {
      alert("请至少保留一位核心角色！");
      return;
    }
    setGeneratedFramework({
      ...generatedFramework,
      characters: generatedFramework.characters.filter((c) => c.id !== id)
    });
  };

  // Framework Helpers: Add & Delete Scene
  const addScene = () => {
    const newScene: Scene = {
      id: `scene_new_${Date.now()}`,
      title: "新场景名称",
      location: "具体物理地点或坐标",
      summary: "对此场景的细致感官及氛围描写..."
    };
    setGeneratedFramework({
      ...generatedFramework,
      scenes: [...generatedFramework.scenes, newScene]
    });
  };

  const deleteScene = (id: string) => {
    if (generatedFramework.scenes.length <= 1) {
      alert("请至少保留一个场景！");
      return;
    }
    setGeneratedFramework({
      ...generatedFramework,
      scenes: generatedFramework.scenes.filter((s) => s.id !== id)
    });
  };

  // Framework Helpers: Add & Delete Item
  const addItem = () => {
    const newItem: Item = {
      id: `item_new_${Date.now()}`,
      name: "随身新物品",
      description: "对道具的外观与神秘功用叙述..."
    };
    setGeneratedFramework({
      ...generatedFramework,
      items: [...generatedFramework.items, newItem]
    });
  };

  const deleteItem = (id: string) => {
    if (generatedFramework.items.length <= 1) {
      alert("请至少保留一件初始物品！");
      return;
    }
    setGeneratedFramework({
      ...generatedFramework,
      items: generatedFramework.items.filter((i) => i.id !== id)
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Switched Navigation */}
      <div className="flex border-b border-neutral-100 -mx-8 px-8">
        {[
          { id: "character", label: "👥 核心角色群" },
          { id: "scene", label: "📍 故事场景库" },
          { id: "item", label: "📦 初始随身道具" },
          { id: "world", label: "🌍 世界观设定" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFrameworkTab(tab.id as any)}
            className={`pb-3 text-xs font-semibold border-b-2 px-4 transition-all duration-200 -mb-px ${
              frameworkTab === tab.id
                ? "border-neutral-900 text-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editable Content Panel */}
      <div className="py-2 min-h-[300px]">
        
        {/* Tab: Character List cards */}
        {frameworkTab === "character" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">配置故事主要角色 (卡片内可直接编辑修改)</h3>
              <button
                type="button"
                onClick={addCharacter}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>添加核心角色</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedFramework.characters.map((char, index) => (
                <div key={char.id} className="p-5 border border-neutral-200 rounded-2xl bg-zinc-50/10 space-y-4 relative group">
                  
                  {/* Delete btn */}
                  {char.id !== "char_1" && (
                    <button
                      type="button"
                      onClick={() => deleteCharacter(char.id)}
                      className="absolute top-4 right-4 p-1.5 bg-white hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-lg border border-neutral-200 hover:border-red-100 transition-colors shadow-sm"
                      title="删除角色"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold">
                      {char.name[0] || "?"}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {char.id === "char_1" ? (
                        <span className="px-2 py-0.5 bg-neutral-900 text-white rounded-md text-[9px] font-sans font-medium">✨ 主角 (你扮演的角色)</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-zinc-200/60 text-zinc-600 rounded-md text-[9px] font-sans font-medium">👥 故事配角 (NPC)</span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-semibold block">名字</label>
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => {
                          const newChars = [...generatedFramework.characters];
                          newChars[index]!.name = e.target.value;
                          setGeneratedFramework({ ...generatedFramework, characters: newChars });
                        }}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs outline-none focus:border-neutral-900 bg-white transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-semibold block">身份背景标签</label>
                      <input
                        type="text"
                        value={char.role}
                        onChange={(e) => {
                          const newChars = [...generatedFramework.characters];
                          newChars[index]!.role = e.target.value;
                          setGeneratedFramework({ ...generatedFramework, characters: newChars });
                        }}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs outline-none focus:border-neutral-900 bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">性格特点与内心秘密</label>
                    <textarea
                      value={char.persona}
                      onChange={(e) => {
                        const newChars = [...generatedFramework.characters];
                        newChars[index]!.persona = e.target.value;
                        setGeneratedFramework({ ...generatedFramework, characters: newChars });
                      }}
                      rows={3}
                      className="w-full p-3 border border-neutral-200 rounded-xl text-xs leading-relaxed outline-none focus:border-neutral-900 bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">对话口吻风格说明</label>
                    <input
                      type="text"
                      value={char.speechStyle}
                      onChange={(e) => {
                        const newChars = [...generatedFramework.characters];
                        newChars[index]!.speechStyle = e.target.value;
                        setGeneratedFramework({ ...generatedFramework, characters: newChars });
                      }}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs outline-none focus:border-neutral-900 bg-white transition-colors"
                    />
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Scene List cards */}
        {frameworkTab === "scene" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">配置重要剧情场景 (卡片内可直接编辑修改)</h3>
              <button
                type="button"
                onClick={addScene}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>添加核心场景</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedFramework.scenes.map((scene, index) => (
                <div key={scene.id} className="p-5 border border-neutral-200 rounded-2xl bg-zinc-50/10 space-y-4 relative group">
                  
                  {/* Delete btn */}
                  <button
                    type="button"
                    onClick={() => deleteScene(scene.id)}
                    className="absolute top-4 right-4 p-1.5 bg-white hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-lg border border-neutral-200 hover:border-red-100 transition-colors shadow-sm"
                    title="删除场景"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex items-center gap-2">
                    <MapPin className="h-4.5 w-4.5 text-neutral-800" />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      场景 {index + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-semibold block">场景名称</label>
                      <input
                        type="text"
                        value={scene.title}
                        onChange={(e) => {
                          const newScenes = [...generatedFramework.scenes];
                          newScenes[index]!.title = e.target.value;
                          setGeneratedFramework({ ...generatedFramework, scenes: newScenes });
                        }}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs outline-none focus:border-neutral-900 bg-white transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-semibold block">具体位置/坐标</label>
                      <input
                        type="text"
                        value={scene.location}
                        onChange={(e) => {
                          const newScenes = [...generatedFramework.scenes];
                          newScenes[index]!.location = e.target.value;
                          setGeneratedFramework({ ...generatedFramework, scenes: newScenes });
                        }}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs outline-none focus:border-neutral-900 bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">场景细节与氛围环境描写</label>
                    <textarea
                      value={scene.summary}
                      onChange={(e) => {
                        const newScenes = [...generatedFramework.scenes];
                        newScenes[index]!.summary = e.target.value;
                        setGeneratedFramework({ ...generatedFramework, scenes: newScenes });
                      }}
                      rows={4}
                      className="w-full p-3 border border-neutral-200 rounded-xl text-xs leading-relaxed outline-none focus:border-neutral-900 bg-white transition-colors"
                    />
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Item List cards */}
        {frameworkTab === "item" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">配置主要道具物品 (卡片内可直接编辑修改)</h3>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>添加随身道具</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedFramework.items.map((item, index) => (
                <div key={item.id} className="p-5 border border-neutral-200 rounded-2xl bg-zinc-50/10 flex gap-4 relative group">
                  
                  {/* Delete btn */}
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="absolute top-4 right-4 p-1.5 bg-white hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-lg border border-neutral-200 hover:border-red-100 transition-colors shadow-sm"
                    title="删除道具"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-sm h-fit mt-3">
                    <Box className="h-6 w-6 text-neutral-800" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">
                      道具 {index + 1}
                    </span>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-semibold block">道具全名</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...generatedFramework.items];
                          newItems[index]!.name = e.target.value;
                          setGeneratedFramework({ ...generatedFramework, items: newItems });
                        }}
                        className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl text-xs outline-none focus:border-neutral-900 bg-white transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-semibold block">外观功能与神秘描述</label>
                      <textarea
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...generatedFramework.items];
                          newItems[index]!.description = e.target.value;
                          setGeneratedFramework({ ...generatedFramework, items: newItems });
                        }}
                        rows={2}
                        className="w-full p-3 border border-neutral-200 rounded-xl text-xs leading-relaxed outline-none focus:border-neutral-900 bg-white transition-colors"
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: World View */}
        {frameworkTab === "world" && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">编辑故事世界设定 (可直接修改)</h3>
            <textarea
              value={generatedFramework.worldView}
              onChange={(e) => setGeneratedFramework({
                ...generatedFramework,
                worldView: e.target.value
              })}
              rows={8}
              className="w-full p-4 border border-neutral-200 rounded-xl text-xs leading-relaxed outline-none focus:border-neutral-900 bg-zinc-50/20 focus:bg-white transition-colors"
            />
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
        <span className="text-xs text-zinc-400 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>框架设定可随时修改，确认后自动同步至首章</span>
        </span>
        <button
          type="button"
          onClick={onConfirm}
          className="px-6 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl font-medium text-xs flex items-center gap-2 shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all"
        >
          <span>确认并生成开篇</span>
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
