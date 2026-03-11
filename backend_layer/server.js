import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const NODE_PORT = Number(process.env.NODE_PORT || 3000);
const AI_BASE_URL = process.env.AI_BASE_URL || "http://localhost:9000";
// Swagger setup
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Chatbot Backend (Node.js)",
      version: "1.0.0",
      description:
        "Simple backend that exposes /chat and forwards to the Python AI layer (/llm/chat).",
    },
    servers: [{ url: `http://localhost:${NODE_PORT}` }],
  },
  apis: ["./server.js"],
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "backend-node", ai_base_url: AI_BASE_URL });
});
app.post("/chat", async (req, res) => {
  try {
    const { message, history, system_prompt, temperature, max_tokens } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required and must be a string" });
    }
    const payload = {
      message,
      history: Array.isArray(history) ? history : [],
      system_prompt: typeof system_prompt === "string" ? system_prompt : undefined,
      temperature: typeof temperature === "number" ? temperature : undefined,
      max_tokens: Number.isInteger(max_tokens) ? max_tokens : undefined,
    };
    // Remove undefined keys
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const aiResp = await fetch(`${AI_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!aiResp.ok) {
      const details = await aiResp.text();
      return res.status(500).json({
        error: "AI layer error",
        details,
      });
    }
    const data = await aiResp.json();
    return res.json({ reply: data.reply });
  } catch (e) {
    return res.status(500).json({ error: "Backend failed", details: e.message });
  }
});
app.listen(NODE_PORT, () => {
  console.log(`✅ Backend running: http://localhost:${NODE_PORT}`);
  console.log(`📚 Swagger UI:      http://localhost:${NODE_PORT}/docs`);
});