/**
 * HarudAI backend — Netlify Function
 *
 * This function is the ONLY place your Anthropic API key ever lives.
 * The frontend (public/index.html) never sees it.
 *
 * Set the key with the Netlify CLI (never write it into any file here):
 *   netlify env:set ANTHROPIC_API_KEY "your-key-from-platform.claude.com"
 */

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { image, mediaType, crop } = JSON.parse(event.body || "{}");
    if (!image || !crop) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing image or crop" }) };
    }

    const prompt =
      `You are an agricultural plant-pathologist assistant for farmers in Kashmir, India. ` +
      `First check: does this photo actually show a real leaf, fruit, plant, crop field or something you can meaningfully diagnose? ` +
      `If it does NOT (for example it's a screenshot, a person, a document, a random object, or the image is unclear), respond with ONLY this JSON and nothing else: ` +
      `{"is_valid_crop_photo":false,"message_en":"This doesn't look like a photo of a crop, leaf or fruit. Please upload a clear photo of the affected plant.","message_ur":"یہ فصل، پتے یا پھل کی تصویر نظر نہیں آتی۔ براہ کرم متاثرہ پودے کی واضح تصویر اپلوڈ کریں۔"}\n` +
      `If it DOES show a real ${crop} leaf, fruit or plant, identify the most likely disease or disorder visible (or state it looks healthy if you see no disease), and respond with ONLY a raw JSON object, no markdown fences, no extra text, in exactly this shape:\n` +
      `{"is_valid_crop_photo":true,"crop":"...","disease_en":"...","severity":"low|medium|high","confidence":0-100,` +
      `"cause_en":"...","cause_ur":"...","treatment_en":"...","treatment_ur":"...",` +
      `"prevention_en":"...","prevention_ur":"...","weather_risk_en":"...","weather_risk_ur":"..."}\n` +
      `Keep each field to one short, practical sentence a farmer can act on. Write the *_ur fields in natural, simple Urdu.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: "AI service error" }) };
    }

    const data = await response.json();
    const textBlock = (data.content || []).map((b) => b.text || "").join("\n");
    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    console.error("HarudAI function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Analysis failed" }) };
  }
};
