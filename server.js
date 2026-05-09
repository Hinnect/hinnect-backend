import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// 🔥 JSON EXTRACTOR
function extractJSON(text) {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ JSON parse error:", err);
    console.log("RAW AI RESPONSE:\n", text);
    return null;
  }
}

//
// 🚀 1. ANALYZE ROUTE
//
app.post("/analyze", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 50) {
      return res.status(400).json({ error: "Invalid resume text" });
    }

    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization":
`Bearer ${process.env.SARVAM_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sarvam-m",
        messages: [
          {
            role: "system",
            content: "Return ONLY valid JSON."
          },
          {
            role: "user",
            content: `
{
  "dsaScore": number,
  "devScore": number,
  "commScore": number,
  "summary": "",
  "suggestions": [],
  "roadmap": [],
  "jobs": [],
  "improvements": []
}

Resume:
${text}
`
          }
        ]
      })
    });

    const data = await response.json();
    console.log("Sarvam raw:", data);

    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(raw);

    if (!parsed) {
      return res.status(500).json({ error: "AI parsing failed" });
    }

    res.json(parsed);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

//
// 🚀 2. CHAT ROUTE (SEPARATE)
//
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization":
`Bearer ${process.env.SARVAM_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sarvam-m",
        messages: [
          {
            role: "system",
            content: "You are a helpful career mentor."
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();
    console.log("Chat raw:", data);

    const reply = data?.choices?.[0]?.message?.content || "No response";

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat failed" });
  }
});

//
// 💼 JOB MATCH AI
//
app.post("/job-match", async (req, res) => {

  try {

    let { resumeText, jobDescription } = req.body;

    // LIMIT SIZE
    resumeText = resumeText.slice(0, 4000);
    jobDescription = jobDescription.slice(0, 2000);

    if (!resumeText || !jobDescription) {
      return res.status(400).json({
        error: "Missing data"
      });
    }

    const response = await fetch(
      "https://api.sarvam.ai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization":
`Bearer ${process.env.SARVAM_API_KEY}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          model: "sarvam-m",

          messages: [

            {
              role: "system",
              content:
                "Return ONLY valid JSON."
            },

            {
              role: "user",

              content: `
Return ONLY valid JSON.

Do NOT write explanations.
Do NOT write markdown.
Do NOT write text outside JSON.
matchScore must always be a number between 0 and 100.

Format:

{
  "matchScore": 0,
  "matchingSkills": [],
  "missingSkills": [],
  "atsKeywords": [],
  "suggestions": []
}

Resume:
${resumeText}

Job Description:
${jobDescription}
`
            }
          ]
        })
      }
    );

    const data = await response.json();
    console.log(
      "FULL SARVAM RESPONSE:",
      JSON.stringify(data, null, 2)
    );

    let raw = "";

    // TRY DIFFERENT RESPONSE FORMATS
    if (data.choices &&
      data.choices[0] &&
      data.choices[0].message) {

      raw = data.choices[0].message.content;

    } else if (data.output) {

      raw = data.output;

    } else if (data.message) {

      raw = data.message;

    } else {

      console.log("UNKNOWN RESPONSE:", data);

      return res.status(500).json({
        error: "Unknown AI response format"
      });
    }

    // const raw =
    //   data.choices[0].message.content;

    const parsed = extractJSON(raw);
    parsed.matchScore =
      parseInt(parsed.matchScore) || 0;
    res.json(parsed);
    if (!parsed.matchScore) {

      parsed.matchScore = 0;
    }

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Job match failed"
    });
  }

});

//
// 🚀 START SERVER
//
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});