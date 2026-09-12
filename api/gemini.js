// ===================================================
// Gemini에게 물어보는 서버 코드 (Vercel 서버리스 함수)
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고, 브라우저는 이 주소로 부탁만 합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 함수로 처리합니다.
//
// 이 파일의 규칙
//   api 폴더 안의 파일은 Vercel에서 자동으로 서버 주소가 됩니다.
//   이 파일은 /api/gemini 주소가 됩니다.
//   API 키는 코드에 적지 말고 Vercel 환경변수에 넣습니다. (process.env 로 꺼내 씁니다)
// ===================================================

export default async function handler(req, res) {
  // POST 요청만 처리합니다
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 메서드만 지원합니다." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정(Environment Variables)에서 키를 추가해 주세요."
    });
  }

  // 본문에서 메모 내용 추출
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const text = (body.text || "").trim();

  if (!text) {
    return res.status(400).json({ error: "메모 내용(text)이 필요합니다." });
  }

  // 개인정보 보호: 학생 이름, UID 등은 전송하지 않고 오직 메모 내용만 보냅니다
  const prompt = `너는 초·중등학교 교실에서 학생들을 격려하고 배움을 확장해 주는 다정하고 친절한 AI 보조교사야.
학생이 교실 담벼락에 작성한 아래 메모를 읽고, 깊은 공감과 칭찬, 긍정적인 질문을 담아 따뜻하게 1~2문장(한국어, 존댓말, 알맞은 이모지 1~2개 포함)으로 코멘트를 작성해 줘.

[학생 메모]
${text}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API 호출 실패:", errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || "Gemini API 호출 중 오류가 발생했습니다."
      });
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "좋은 생각이에요! 멋진 메모 고마워요. 👏";

    return res.status(200).json({ comment });
  } catch (err) {
    console.error("서버 내부 오류:", err);
    return res.status(500).json({ error: "서버 처리 중 오류가 발생했습니다: " + err.message });
  }
}
