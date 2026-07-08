import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser with 50mb limit for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Proxy route to bypass CORS issues for template images
app.get("/api/proxy-image", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "URL이 필요합니다." });
    }
    const fetchRes = await fetch(url as string);
    const contentType = fetchRes.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    return res.json({ base64: `data:${contentType};base64,${base64}` });
  } catch (error: any) {
    console.error("Proxy image error:", error);
    return res.status(500).json({ error: "이미지 다운로드 중 오류가 발생했습니다." });
  }
});

// Initializer for Google GenAI client (can take a dynamic key or fallback to environment variables)
function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API Key가 설정되지 않았습니다. 화면 상단의 'API 설정' 버튼을 눌러 본인의 Gemini API Key를 입력해주시거나, 서버 환경변수(GEMINI_API_KEY)를 설정해주세요."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// REST API endpoint for architectural redesign
app.post("/api/redesign", async (req, res) => {
  try {
    const {
      originalImage,
      prompt,
      referenceImage,
      useHighQuality = false,
      history = [],
      restartFromOriginal = false,
      aspectRatio = "1:1",
    } = req.body;

    if (!originalImage) {
      return res.status(400).json({ error: "원본 이미지가 필요합니다." });
    }
    if (!prompt) {
      return res.status(400).json({ error: "수정 요청 사항을 입력해주세요." });
    }

    const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
    const ai = getGeminiClient(customApiKey);

    // 1. Determine which image is the "base" for this edit step.
    // If we have history and are NOT restarting from original, the base is the last result image.
    // Otherwise, the base is the original image.
    const hasHistory = Array.isArray(history) && history.length > 0;
    const baseImageToUse = (hasHistory && !restartFromOriginal) 
      ? history[history.length - 1].imageUrl 
      : originalImage;

    // Helper to parse base64
    const parseBase64 = (imgStr: string) => {
      const matches = imgStr.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) {
        return { mimeType: matches[1], data: matches[2] };
      }
      return { mimeType: "image/jpeg", data: imgStr };
    };

    const parsedBase = parseBase64(baseImageToUse);
    const parsedOriginal = parseBase64(originalImage);

    // Prepare multimodal contents for the analyzer (Gemini 3.5 Flash)
    // We send:
    // - The original image
    // - The active base image (if it's different, e.g. from history)
    // - The reference image (if provided)
    // - The instruction and history list
    const analyzerParts: any[] = [
      {
        text: `당신은 대한민국 최고 수준의 건축 이미지 리디자인 전문 AI 어시스턴트입니다.
사용자는 기존 건축 이미지의 구도, 형태, 시점, 층수, 창호 위치 등 기본 골조를 그대로 보존한 상태에서 외장재, 색감, 조명, 스타일, 조경 등을 리디자인하고자 합니다.

[미션]
원본 이미지와 현재 작업 기준 이미지(Base), 그리고 참고용 레퍼런스 이미지(제공된 경우)를 면밀히 분석하십시오.
그 후, 사용자의 새 요청사항을 반영한 완성도 높은 영문 이미지 생성 프롬프트를 작성하여 출력하십시오.

[작동 방식 및 연속성 유지 규칙]
1. 연속성 유지: 사용자의 이번 요청은 직전까지의 작업 결과물(Base 이미지)에 누적되어 적용됩니다.
   - 지금까지 수행된 수정 역사(History): ${JSON.stringify(history.map((h: any) => h.prompt))}
   - 이전 작업 이력을 바탕으로, 기존의 리디자인 컨셉(예: 고급 대리석 외벽, 조경 추가 등)을 깨뜨리지 않고 유지하면서 새로운 요청사항만 자연스럽게 추가/교체하십시오.
   - 단, 새로운 요청사항이 이전 이력과 완전히 대치되거나 충돌하는 경우에는 새로운 요청을 덮어쓰기 형태로 적용하십시오.
2. 원본 구조의 엄격한 보존: 원본 건물의 골조, 비례, 대지 구조, 시점(투시 구도), 주요 창호 및 문 위치는 절대로 허물지 말고 그대로 보존해야 합니다. 프롬프트 내에 이러한 형태적 보존을 강조하는 영문 지침을 강력하게 삽입하십시오.
3. 레퍼런스 이미지 반영: 만약 레퍼런스 이미지가 제공되었다면, 해당 이미지에서 나타나는 주요 '외장 마감재 질감', '조명 조도 및 분위기(야간/석양/주간)', '색조(Palettes)', '조경 스타일' 등을 자세히 추출하여 최종 프롬프트에 조화롭게 녹여내십시오.
4. 사실적인 고품질 지향: 과장된 SF/판타지나 비현실적 구조를 지양하고, 실제 프리미엄 건축 포토그래피 또는 정밀한 건축 CG 렌더링 스타일(photorealistic architectural rendering, highly detailed, high-end facade, commercial rendering)로 묘사하십시오.

최종 출력은 반드시 지정된 JSON 형식으로만 제출해야 합니다.`,
      },
    ];

    // Add images to analyzer
    analyzerParts.push({
      inlineData: {
        mimeType: parsedOriginal.mimeType,
        data: parsedOriginal.data,
      },
    });
    analyzerParts.push({
      text: "위 이미지는 변경 전 최초의 원본 건축 이미지입니다. 이 이미지의 구조, 시점, 층수, 볼륨감, 창호의 기본 위치를 절대 훼손하지 않고 뼈대로 사용해야 합니다.",
    });

    if (baseImageToUse !== originalImage) {
      analyzerParts.push({
        inlineData: {
          mimeType: parsedBase.mimeType,
          data: parsedBase.data,
        },
      });
      analyzerParts.push({
        text: "위 이미지는 직전 단계까지 리디자인이 적용된 상태의 기준 이미지(Base)입니다. 이 컨셉을 유지하면서 다음 요청을 적용하십시오.",
      });
    }

    if (referenceImage) {
      const parsedRef = parseBase64(referenceImage);
      analyzerParts.push({
        inlineData: {
          mimeType: parsedRef.mimeType,
          data: parsedRef.data,
        },
      });
      analyzerParts.push({
        text: "위 이미지는 사용자가 원하는 스타일, 색감, 자재, 조명, 조경 느낌을 반영하기 위해 제공한 레퍼런스 이미지입니다. 이 스타일의 분위기와 톤앤매너를 핵심적으로 프롬프트에 녹여주세요.",
      });
    }

    // Add user's new prompt
    analyzerParts.push({
      text: `사용자의 새로운 디자인 수정 요청: "${prompt}"

이상의 정보들을 모두 융합하여, 영문 이미지 리디자인 프롬프트(finalPrompt) 및 한국어 작업 요약 설명(changesDescription)을 생성해주십시오.`,
    });

    // Run Gemini 3.5 Flash analyzer to get structured JSON
    const analyzerResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: analyzerParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            finalPrompt: {
              type: Type.STRING,
              description: "A highly detailed architectural design generation prompt in English, describing the desired output image in detail while instructing the model to keep the exact building outline, windows, structure, and perspective of the input image.",
            },
            changesDescription: {
              type: Type.STRING,
              description: "한국어 설명. 어떤 점들이 변경되고 어떤 뼈대가 보존되는지 자연스럽게 설명해주는 한두 문장의 요약.",
            },
            detectedTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "주요 특징 키워드 목록 (예: ['모던', '외장재 변경', '야간 조명'])",
            },
          },
          required: ["finalPrompt", "changesDescription"],
        },
      },
    });

    const analysisResultText = analyzerResponse.text || "{}";
    const analysis = JSON.parse(analysisResultText.trim());

    // 2. Perform Image Editing with the specialized image model
    // Default model is gemini-3.1-flash-lite-image
    // Upgrade to gemini-3.1-flash-image if useHighQuality is true.
    const imageModelName = useHighQuality 
      ? "gemini-3.1-flash-image" 
      : "gemini-3.1-flash-lite-image";

    console.log(`Generating image using ${imageModelName} with prompt: ${analysis.finalPrompt}`);

    // Call the image generation model
    // We pass the parsed base image (so it edits on top of it) and the English text prompt
    const imageResponse = await ai.models.generateContent({
      model: imageModelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: parsedBase.mimeType,
              data: parsedBase.data,
            },
          },
          {
            text: `${analysis.finalPrompt} -- Ensure absolute structure, structural outline, windows, perspective, and core building mass are retained exactly from the input image. realistic photography style.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          ...(useHighQuality ? { imageSize: "1K" } : {}),
        },
      },
    });

    // Extract the generated image from response parts
    let resultImageUrl: string | null = null;
    if (imageResponse.candidates && imageResponse.candidates[0]?.content?.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          resultImageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!resultImageUrl) {
      throw new Error("이미지 모델이 결과 이미지를 생성하지 못했습니다. 응답 형식을 확인하십시오.");
    }

    // Return the result
    return res.json({
      success: true,
      resultImageUrl,
      finalPrompt: analysis.finalPrompt,
      changesDescription: analysis.changesDescription,
      detectedTags: analysis.detectedTags || [],
      usedModel: imageModelName,
    });

  } catch (error: any) {
    console.error("Redesign process error:", error);
    
    let isQuotaError = false;
    let userFriendlyError = error.message || "이미지 리디자인 중 오류가 발생했습니다.";

    // Convert error object or message to string to check for quota/billing indicators
    const errStr = String(error.message || "") + " " + String(error.status || "") + " " + JSON.stringify(error || {});
    if (
      errStr.includes("429") ||
      errStr.includes("quota") ||
      errStr.includes("Quota") ||
      errStr.includes("exceeded") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("billing")
    ) {
      isQuotaError = true;
      userFriendlyError = "Gemini API 무료 전용 키의 이미지 생성 한도(Quota)가 초과되었거나, 해당 모델 사용을 위해 유료 API 키 또는 결제 프로필 설정이 필요합니다. AI Studio 화면 우측 상단의 'Settings > Secrets'에서 결제가 등록된 유료 API 키를 설정하거나, 워크스페이스 내 유료 모델 플로우(Paid Model Flow)를 활성화해주세요.";
    }

    return res.status(500).json({
      error: userFriendlyError,
      isQuotaError: isQuotaError
    });
  }
});

// Serve frontend assets and start server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Architectural Image Redesign AI Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
