import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Sparkles, 
  SlidersHorizontal, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Layers, 
  AlertCircle, 
  Trash2, 
  HelpCircle, 
  Compass, 
  Maximize2, 
  Check, 
  ChevronRight, 
  History, 
  FileImage,
  ExternalLink,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HistoryItem {
  id: string;
  prompt: string;
  imageUrl: string;
  changesDescription: string;
  detectedTags: string[];
  usedModel: string;
  finalPrompt: string;
  timestamp: string;
}

// Built-in templates for easy testing
const PRESET_TEMPLATES = [
  {
    name: "모던 외단독 주택",
    description: " suburban modern house",
    thumbnail: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "유리 외벽 오피스 빌딩",
    description: "glass facade office building",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "빈티지 벽돌 상가/카페",
    description: "cozy storefront brick facade cafe",
    thumbnail: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80"
  }
];

// Presets that append to the prompt
const STYLE_CHIPS = [
  { label: "고급스럽게 ✨", value: "고급스러운 외장재와 세련된 전경 조명을 추가하여 프리미엄 외관으로 고급스럽게 변경해줘" },
  { label: "모던하게 🏢", value: "단순하고 깔끔한 직선 매스, 노출 콘크리트와 유리를 활용해 미니멀하고 모던하게 변경해줘" },
  { label: "카페처럼 ☕", value: "아늑한 원목 데크, 따뜻한 웜톤 외부 조명, 식재와 야외 테라스를 배치하여 감성적인 카페처럼 꾸며줘" },
  { label: "상가 느낌 🛍️", value: "1층 전면 통유리 쇼윈도와 정돈된 간판 영역을 강조하여 유동인구가 접근하기 좋은 상가로 리모델링해줘" },
  { label: "야간 이미지 🌙", value: "실내에서 퍼져나오는 따스한 불빛과 건물 외벽을 은은하게 비추는 외부 야간 경관 조명을 자연스럽게 추가해줘" },
  { label: "조경 추가 🌿", value: "건물의 구조를 가리지 않으면서도 정돈된 조경 식재, 세련된 정원 화분, 화단과 보행로 유도등을 설치해줘" },
  { label: "간판 추가 🏷️", value: "입면에 자연스럽게 조화되는 영문 미니멀 로고형 조명 간판을 세련되게 배치해줘" },
  { label: "외장재 변경 🧱", value: "기존 건축 뼈대는 유지하되, 외장 마감재를 고급 대리석 석재 타일과 모던한 금속 패널 질감으로 변경해줘" }
];

const LOADING_STEPS = [
  "원본 건축물의 투시 구도 및 비례선 정밀 분석 중...",
  "건물 외벽 매싱 구조 및 창호 위치 데이터 보존망 매핑 중...",
  "사용자 요청과 스타일 레퍼런스 조화 지수 분석 중...",
  "프리미엄 영문 건축 렌더링 프롬프트 변환 완료...",
  "선택된 고급 마감자재(대리석, 콘크리트, 우드) 텍스처 합성 중...",
  "실시간 자연광 반사율 및 입체 조명 시뮬레이션 중...",
  "가로수, 식재, 도보 인프라 등 조경 환경 어우러짐 가공 중...",
  "디테일 가림막 제거 및 고해상도 최종 렌더링 출력 중..."
];

export default function App() {
  // Main states
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [useHighQuality, setUseHighQuality] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [restartFromOriginal, setRestartFromOriginal] = useState<boolean>(false);

  // Status states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // History states
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number>(-1); // -1 means original active, other is index in history

  // UI comparison slider
  const [sliderValue, setSliderValue] = useState<number>(50);
  const [isComparing, setIsComparing] = useState<boolean>(true);

  // Loading timer loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 3500);
    } else {
      setLoadingTextIndex(0);
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  // Load sample template image via CORS proxy
  const handleLoadTemplate = async (templateUrl: string, templateName: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(templateUrl)}`);
      if (!response.ok) throw new Error("템플릿 이미지를 가져오지 못했습니다.");
      const data = await response.json();
      if (data.base64) {
        setOriginalImage(data.base64);
        setHistory([]);
        setActiveHistoryIndex(-1);
        setIsComparing(true);
        setSliderValue(50);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "이미지 프록시 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and Drop for Original Image
  const handleOriginalDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setOriginalImage(reader.result as string);
        setHistory([]);
        setActiveHistoryIndex(-1);
        setSliderValue(50);
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and Drop for Reference Image
  const handleReferenceDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle manual file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "original" | "reference") => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        if (type === "original") {
          setOriginalImage(reader.result as string);
          setHistory([]);
          setActiveHistoryIndex(-1);
          setSliderValue(50);
        } else {
          setReferenceImage(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Run architectural redesign
  const handleRedesignSubmit = async () => {
    if (!originalImage) {
      setErrorMsg("리디자인할 원본 건축 이미지를 업로드해주세요.");
      return;
    }
    if (!prompt.trim()) {
      setErrorMsg("원하시는 리디자인 수정 사항을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Build active history for cumulative changes
      // If we restartFromOriginal, we don't pass previous history to enforce fresh edit
      const activeHistory = restartFromOriginal ? [] : history.slice(0, activeHistoryIndex + 1);

      const response = await fetch("/api/redesign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImage,
          prompt,
          referenceImage,
          useHighQuality,
          history: activeHistory,
          restartFromOriginal,
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "서버 통신 중 오류가 발생했습니다.");
      }

      const data = await response.json();

      if (data.success) {
        const newHistoryItem: HistoryItem = {
          id: `step-${Date.now()}`,
          prompt,
          imageUrl: data.resultImageUrl,
          changesDescription: data.changesDescription,
          detectedTags: data.detectedTags,
          usedModel: data.usedModel,
          finalPrompt: data.finalPrompt,
          timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        };

        // If we restarted from original, clear prior history and add new step
        const updatedHistory = restartFromOriginal 
          ? [newHistoryItem] 
          : [...history.slice(0, activeHistoryIndex + 1), newHistoryItem];

        setHistory(updatedHistory);
        setActiveHistoryIndex(updatedHistory.length - 1);
        setPrompt(""); // Clear input after successful run
        setRestartFromOriginal(false); // Reset the toggle
        setSliderValue(60); // Set slider value to show transition nicely
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "리디자인 과정에서 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Clear current active step
  const handleClearCurrentStep = (indexToRemove: number) => {
    const updated = history.filter((_, idx) => idx !== indexToRemove);
    setHistory(updated);
    if (updated.length === 0) {
      setActiveHistoryIndex(-1);
    } else {
      setActiveHistoryIndex(Math.max(0, indexToRemove - 1));
    }
  };

  // Fully reset application state
  const handleFullReset = () => {
    setOriginalImage(null);
    setReferenceImage(null);
    setPrompt("");
    setHistory([]);
    setActiveHistoryIndex(-1);
    setErrorMsg(null);
    setRestartFromOriginal(false);
  };

  // Append preset style modifiers to text input
  const handleApplyStylePreset = (value: string) => {
    setPrompt((prev) => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return value;
      // Prevent duplication
      if (cleanPrev.includes(value)) return prev;
      return `${cleanPrev}, ${value}`;
    });
  };

  // Determine active view image URL
  const activeImageUrl = activeHistoryIndex >= 0 ? history[activeHistoryIndex].imageUrl : originalImage;
  const showCompareSlider = isComparing && originalImage && activeHistoryIndex >= 0;

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-stone-900 selection:bg-stone-200">
      {/* Upper Brand Bar */}
      <header className="sticky top-0 z-40 bg-[#fcfbf9]/90 backdrop-blur-md border-b border-stone-200/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-stone-900 text-white rounded-lg">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900 font-sans">
                ARCHITECTURAL IMAGE REDESIGN AI
              </h1>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-mono">
                Premium Façade & Landscaping Remodeling Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 bg-stone-100 border border-stone-200 rounded-full font-mono text-stone-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Live Core Active
            </span>
            {originalImage && (
              <button 
                onClick={handleFullReset}
                className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg transition-all flex items-center gap-1"
                title="모든 데이터 초기화"
              >
                <Trash2 className="w-3.5 h-3.5" />
                전체 초기화
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Helper Guide Header Banner */}
        <div className="mb-8 p-5 bg-stone-100/50 border border-stone-200 rounded-xl flex items-start gap-4">
          <HelpCircle className="w-6 h-6 text-stone-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-stone-900">사용 안내 가이드</h2>
            <p className="text-sm text-stone-600 mt-1 leading-relaxed">
              원본 이미지를 업로드하고 원하는 수정 내용을 입력해주세요. 레퍼런스 이미지가 있으면 함께 업로드하면 스타일 반영이 더 정확해집니다.
              수행된 수정 사항들은 역사가 되어 차곡차곡 쌓이며, 다음 단계 수정 시 자동으로 기존 컨셉을 보존하며 변경됩니다.
            </p>
          </div>
        </div>

        {/* Outer Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Inputs, Controls (5 cols on lg) */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Step 1: Upload Original Image */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest font-mono font-bold text-stone-500">Step 01</span>
                <span className="text-sm font-bold text-stone-900">원본 건축 이미지 등록</span>
              </div>

              {!originalImage ? (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleOriginalDrop}
                  className="border-2 border-dashed border-stone-200 rounded-xl p-8 text-center hover:border-stone-400 transition-colors cursor-pointer relative group bg-stone-50/50"
                  onClick={() => document.getElementById("original-file")?.click()}
                >
                  <input 
                    type="file" 
                    id="original-file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "original")}
                  />
                  <Upload className="w-10 h-10 text-stone-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium text-stone-700">여기에 건축 이미지를 드래그하거나 클릭하여 업로드</p>
                  <p className="text-xs text-stone-400 mt-1">PNG, JPG, JPEG 지원 (최대 10MB)</p>
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-stone-200 aspect-video bg-stone-50">
                  <img 
                    src={originalImage} 
                    alt="Original Uploaded" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={() => document.getElementById("original-file-change")?.click()}
                      className="px-3 py-1.5 bg-white text-stone-900 text-xs font-semibold rounded-lg shadow-md hover:bg-stone-50 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      다른 이미지로 변경
                    </button>
                    <input 
                      type="file" 
                      id="original-file-change" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "original")}
                    />
                  </div>
                </div>
              )}

              {/* Template quick loader if no image loaded */}
              {!originalImage && (
                <div className="pt-2">
                  <p className="text-xs text-stone-500 font-medium mb-2.5 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" />
                    또는 아래의 고화질 샘플 템플릿으로 시작해보세요:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_TEMPLATES.map((tpl, i) => (
                      <button
                        key={i}
                        onClick={() => handleLoadTemplate(tpl.thumbnail, tpl.name)}
                        className="text-left border border-stone-200 rounded-lg overflow-hidden hover:border-stone-900 transition-colors bg-white group"
                      >
                        <div className="aspect-video relative bg-stone-100 overflow-hidden">
                          <img 
                            src={tpl.thumbnail} 
                            alt={tpl.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="p-1.5">
                          <p className="text-[10px] font-bold text-stone-900 truncate">{tpl.name}</p>
                          <p className="text-[9px] text-stone-400 font-mono truncate">{tpl.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Upload Optional Reference Image */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs uppercase tracking-widest font-mono font-bold text-stone-500">Step 02</span>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full font-mono uppercase font-bold">선택 사항</span>
                </div>
                <span className="text-sm font-bold text-stone-900">스타일 레퍼런스 이미지</span>
              </div>

              {!referenceImage ? (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleReferenceDrop}
                  className="border border-dashed border-stone-200 rounded-xl p-4 text-center hover:border-stone-400 transition-colors cursor-pointer bg-stone-50/30"
                  onClick={() => document.getElementById("reference-file")?.click()}
                >
                  <input 
                    type="file" 
                    id="reference-file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "reference")}
                  />
                  <FileImage className="w-7 h-7 text-stone-400 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-stone-600">참고할 디자인/색상 레퍼런스 이미지 추가</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">색상, 마감재 느낌, 조명 분위기 등을 자동 융합</p>
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-stone-200 aspect-[16/9] bg-stone-50">
                  <img 
                    src={referenceImage} 
                    alt="Reference Uploaded" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={() => setReferenceImage(null)}
                      className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-md hover:bg-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                    <button 
                      onClick={() => document.getElementById("reference-file-change")?.click()}
                      className="px-2.5 py-1.5 bg-white text-stone-900 text-xs font-semibold rounded-lg shadow-md hover:bg-stone-50 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      교체
                    </button>
                    <input 
                      type="file" 
                      id="reference-file-change" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "reference")}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Aspect Ratio & Quality Settings */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <span className="text-xs uppercase tracking-widest font-mono font-bold text-stone-500">Step 03</span>
              
              {/* Aspect Ratio Selector */}
              <div>
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wide block mb-2">
                  렌더링 이미지 종횡비 (Aspect Ratio)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { label: "1:1", desc: "정방형", value: "1:1" },
                    { label: "4:3", desc: "클래식", value: "4:3" },
                    { label: "16:9", desc: "시네마", value: "16:9" },
                    { label: "3:4", desc: "포트레이트", value: "3:4" },
                    { label: "9:16", desc: "모바일", value: "9:16" }
                  ].map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={`py-2 px-1 border rounded-lg transition-all text-center flex flex-col items-center justify-center ${
                        aspectRatio === ratio.value
                          ? "bg-stone-900 text-white border-stone-900 font-bold"
                          : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      <span className="text-xs">{ratio.label}</span>
                      <span className="text-[8px] font-medium opacity-85 scale-90">{ratio.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality & Paid Model Info */}
              <div className="pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-stone-800 block">초고화질 프리미엄 렌더링</label>
                    <p className="text-[10px] text-stone-400 mt-0.5">High-Quality 1K output (Gemini 3.1 Flash Image)</p>
                  </div>
                  <button
                    onClick={() => setUseHighQuality(!useHighQuality)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      useHighQuality ? "bg-stone-950" : "bg-stone-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        useHighQuality ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {useHighQuality && (
                  <div className="mt-2.5 p-3 bg-amber-50/50 border border-amber-200/60 rounded-lg text-[10px] text-amber-800 leading-relaxed flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      초고화질 모드는 <strong>gemini-3.1-flash-image</strong> 모델을 호출합니다. 사용 환경에 유료 API 과금이 필요할 수 있으니, 문제가 발생하는 경우 토글을 꺼주세요 (비활성화 시 실시간 512px Lite 속도 렌더링 모델을 사용합니다).
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Prompt and Action */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <span className="text-xs uppercase tracking-widest font-mono font-bold text-stone-500">Step 04</span>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 uppercase tracking-wide block">
                    디자인 리모델링 프롬프트 입력
                  </label>
                  {history.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="checkbox" 
                        id="restart-chk"
                        checked={restartFromOriginal}
                        onChange={(e) => setRestartFromOriginal(e.target.checked)}
                        className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 w-3.5 h-3.5"
                      />
                      <label htmlFor="restart-chk" className="text-xs font-bold text-red-600 cursor-pointer hover:underline">
                        처음 원본 기준으로 다시 리모델링
                      </label>
                    </div>
                  )}
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="예: 깔끔한 베이지색 대리석 외벽으로 자재를 바꾸고, 1층에 아늑한 카페 테라스와 따뜻한 전구색 야외 간접 조명을 화려하게 달아줘."
                  className="w-full min-h-[100px] p-3 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900 focus:bg-white transition-all text-stone-800 leading-relaxed"
                />
              </div>

              {/* Style Presets Chips list */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">스타일 단축 필터 프리셋</span>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_CHIPS.map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleApplyStylePreset(chip.value)}
                      className="text-xs px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-full hover:border-stone-900 text-stone-700 font-medium hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Run Remodel Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isLoading || !originalImage || !prompt.trim()}
                  onClick={handleRedesignSubmit}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all text-sm ${
                    isLoading || !originalImage || !prompt.trim()
                      ? "bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed"
                      : "bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.99] cursor-pointer"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>건축 인텔리전스 분석 및 렌더링 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>건축 리디자인 AI 엔진 실행</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error Box display if any */}
              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

          </section>

          {/* RIGHT PANEL: Visualizer & Diagnostics (7 cols on lg) */}
          <section className="lg:col-span-7 space-y-6">
            
            {/* Main Image Viewport Block */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest font-mono font-bold text-stone-500">Workspace Screen</span>
                  {activeHistoryIndex >= 0 && (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                      <Check className="w-3 h-3" /> Step {activeHistoryIndex + 1}
                    </span>
                  )}
                </div>
                
                {/* Mode Selector and Download */}
                {activeHistoryIndex >= 0 && (
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setIsComparing(!isComparing)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                        isComparing 
                          ? "bg-stone-900 text-white border-stone-900" 
                          : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      실시간 비포/애프터 비교 슬라이더
                    </button>
                    <a
                      href={activeImageUrl || ""}
                      download={`architect-redesign-step-${activeHistoryIndex + 1}.png`}
                      className="px-2.5 py-1 bg-stone-100 border border-stone-200 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      다운로드
                    </a>
                  </div>
                )}
              </div>

              {/* Viewport content area */}
              <div className="relative w-full aspect-square bg-stone-50 border border-stone-100 rounded-xl overflow-hidden flex items-center justify-center">
                
                <AnimatePresence mode="wait">
                  {/* Loader Overlay */}
                  {isLoading && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
                    >
                      <div className="relative mb-5">
                        <div className="w-14 h-14 rounded-full border-4 border-stone-100 border-t-stone-900 animate-spin"></div>
                        <Sparkles className="w-5 h-5 text-stone-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                      </div>
                      <span className="text-xs uppercase tracking-widest font-mono text-stone-400">AI Remodeling Process</span>
                      <h3 className="text-base font-bold text-stone-900 mt-1 mb-2">실시간 건축 렌더러 처리 중</h3>
                      
                      <div className="h-6 overflow-hidden max-w-sm">
                        <motion.p 
                          key={loadingTextIndex}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          className="text-xs text-stone-600 font-medium"
                        >
                          {LOADING_STEPS[loadingTextIndex]}
                        </motion.p>
                      </div>

                      <div className="w-48 bg-stone-100 h-1.5 rounded-full overflow-hidden mt-6">
                        <div 
                          className="bg-stone-950 h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${((loadingTextIndex + 1) / LOADING_STEPS.length) * 100}%` }}
                        ></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Empty Placeholder Viewport State */}
                {!originalImage ? (
                  <div className="text-center p-8 space-y-2">
                    <Compass className="w-12 h-12 text-stone-300 mx-auto animate-spin" style={{ animationDuration: "12s" }} />
                    <h3 className="text-sm font-bold text-stone-800">대기 중인 건축물이 없습니다</h3>
                    <p className="text-xs text-stone-500 max-w-xs mx-auto leading-normal">
                      왼쪽에서 원본 이미지를 업로드하거나 샘플 템플릿을 불러오면 작업실 화면이 활성화됩니다.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* View mode 1: Side-by-Side comparison slider (Before/After) */}
                    {showCompareSlider ? (
                      <div className="absolute inset-0 w-full h-full select-none overflow-hidden">
                        
                        {/* Under layer (BEFORE - Original Image) */}
                        <img 
                          src={originalImage} 
                          alt="Original Building" 
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 left-3 z-10 px-2 py-0.5 bg-stone-900/80 text-white text-[10px] font-bold font-mono tracking-wider rounded backdrop-blur-xs">
                          BEFORE (원본)
                        </div>

                        {/* Over layer mask (AFTER - Active Result) */}
                        <div 
                          className="absolute inset-0 overflow-hidden" 
                          style={{ width: `${sliderValue}%` }}
                        >
                          <img 
                            src={activeImageUrl || ""} 
                            alt="Redesigned Building" 
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                            style={{ width: '100%', maxWidth: 'none' }} // avoid squishing
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-3 right-3 z-10 px-2 py-0.5 bg-amber-600/90 text-white text-[10px] font-bold font-mono tracking-wider rounded backdrop-blur-xs whitespace-nowrap">
                            AFTER (리디자인)
                          </div>
                        </div>

                        {/* Visual Slider Bar Handle */}
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize flex items-center justify-center z-20"
                          style={{ left: `${sliderValue}%` }}
                        >
                          <div className="w-7 h-7 rounded-full bg-white shadow-xl border border-stone-300 flex items-center justify-center text-stone-800 hover:scale-110 active:scale-95 transition-transform">
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        {/* Invisible full-screen slider controller */}
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={sliderValue} 
                          onChange={(e) => setSliderValue(Number(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                        />
                      </div>
                    ) : (
                      /* View mode 2: Single full image viewer */
                      <div className="absolute inset-0 w-full h-full">
                        <img 
                          src={activeImageUrl || ""} 
                          alt="Architectural Render" 
                          className="w-full h-full object-cover transition-all duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 left-3 px-2 py-0.5 bg-stone-900/80 text-white text-[10px] font-bold font-mono tracking-wider rounded backdrop-blur-xs uppercase">
                          {activeHistoryIndex >= 0 ? `Step ${activeHistoryIndex + 1} 결과물` : "원본 이미지 상태"}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Slider instruction when comparison active */}
              {showCompareSlider && (
                <p className="text-[11px] text-stone-500 text-center font-medium">
                  💡 이미지 위를 드래그하여 비포(오른쪽)/애프터(왼쪽)의 마감 차이를 비교해 볼 수 있습니다.
                </p>
              )}
            </div>

            {/* History & Cumulative Steps Timeline */}
            {originalImage && (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-stone-500" />
                    <span className="text-xs uppercase tracking-widest font-mono font-bold text-stone-500">Edits Timeline</span>
                  </div>
                  <span className="text-xs text-stone-400 font-medium">가장 최근 단계까지 작업 연속성이 이어집니다</span>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-2.5 scrollbar-thin">
                  {/* Step 0: Original Image thumbnail */}
                  <button
                    onClick={() => setActiveHistoryIndex(-1)}
                    className={`flex-shrink-0 w-28 text-left border rounded-xl overflow-hidden transition-all ${
                      activeHistoryIndex === -1 
                        ? "ring-2 ring-stone-900 border-stone-900 font-bold" 
                        : "border-stone-200 hover:border-stone-400 opacity-75"
                    }`}
                  >
                    <div className="aspect-video bg-stone-100 overflow-hidden relative">
                      <img 
                        src={originalImage} 
                        className="w-full h-full object-cover" 
                        alt="Original thumbnail" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-1.5 bg-stone-50/50">
                      <p className="text-[10px] font-bold text-stone-800 uppercase tracking-wider">원본 상태</p>
                      <p className="text-[9px] text-stone-400 truncate">최초 업로드 이미지</p>
                    </div>
                  </button>

                  {/* Cumulative Steps */}
                  {history.map((item, index) => (
                    <div key={item.id} className="flex-shrink-0 flex items-center gap-1">
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <div className="relative group">
                        <button
                          onClick={() => setActiveHistoryIndex(index)}
                          className={`w-28 text-left border rounded-xl overflow-hidden transition-all ${
                            activeHistoryIndex === index 
                              ? "ring-2 ring-stone-900 border-stone-900 font-bold" 
                              : "border-stone-200 hover:border-stone-400 opacity-80"
                          }`}
                        >
                          <div className="aspect-video bg-stone-100 overflow-hidden relative">
                            <img 
                              src={item.imageUrl} 
                              className="w-full h-full object-cover" 
                              alt={`Step ${index + 1}`} 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="p-1.5 bg-stone-50/50">
                            <p className="text-[10px] font-bold text-stone-800">Step {index + 1}</p>
                            <p className="text-[9px] text-stone-500 truncate" title={item.prompt}>
                              {item.prompt}
                            </p>
                          </div>
                        </button>
                        
                        {/* Remove this specific step */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearCurrentStep(index);
                          }}
                          className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          title="이 단계 삭제"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Diagnostics: Detailed Output Panel */}
            {activeHistoryIndex >= 0 && history[activeHistoryIndex] && (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                <span className="text-xs uppercase tracking-widest font-mono font-bold text-stone-500">AI Diagnostics & Engine Report</span>
                
                {/* Changes summary description in Korean */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    수정 및 설계 변경사항 요약
                  </h4>
                  <p className="text-sm text-stone-700 bg-stone-50/70 p-3 border border-stone-200/50 rounded-xl leading-relaxed">
                    {history[activeHistoryIndex].changesDescription}
                  </p>
                </div>

                {/* Tags */}
                {history[activeHistoryIndex].detectedTags && history[activeHistoryIndex].detectedTags.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">인식된 디자인 태그</span>
                    <div className="flex flex-wrap gap-1.5">
                      {history[activeHistoryIndex].detectedTags.map((tag, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 bg-stone-100 text-stone-700 border border-stone-200 font-medium rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulated Generative Prompt */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">엔진 전송 영문 렌더링 프롬프트 (Core English Prompt)</span>
                  <div className="bg-stone-900 text-stone-300 p-4 rounded-xl border border-stone-800 font-mono text-xs overflow-x-auto leading-relaxed relative max-h-[160px] overflow-y-auto">
                    <div className="sticky top-0 right-0 float-right mb-2 bg-stone-800 text-[10px] text-stone-400 px-1.5 py-0.5 rounded uppercase">
                      Imagen 3 Input
                    </div>
                    <p className="whitespace-pre-wrap select-all">{history[activeHistoryIndex].finalPrompt}</p>
                  </div>
                </div>

                {/* Footprint Metadata */}
                <div className="grid grid-cols-2 gap-4 text-[10px] text-stone-400 border-t border-stone-100 pt-3">
                  <div>
                    <span className="font-bold">사용된 이미지 모델:</span>
                    <span className="font-mono ml-1 text-stone-600">{history[activeHistoryIndex].usedModel}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">렌더링 시각:</span>
                    <span className="font-mono ml-1 text-stone-600">{history[activeHistoryIndex].timestamp}</span>
                  </div>
                </div>
              </div>
            )}

          </section>

        </div>
      </main>

      {/* Footer Design Studio Credits */}
      <footer className="border-t border-stone-200 mt-20 py-8 px-6 text-center text-xs text-stone-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono uppercase tracking-widest">
          <p>© 2026 ARCHITECTURAL REDESIGN AI STUDIO</p>
          <p className="text-stone-300">| Powered by Google Gemini 3.5 & Imagen 3 |</p>
        </div>
      </footer>
    </div>
  );
}
