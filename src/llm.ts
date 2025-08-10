import 'dotenv/config';
import { logger } from './logger.js';

const OLLAMA = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL = process.env.MODEL || 'qwen2:7b-instruct';

export type Decision = {
  category: string;
  action: "move" | "mark_read" | "archive" | "ignore";
  folder?: string;
  confidence: number; // 0..1
};

export async function classifyEmail(input: {from:string; subject:string; content:string}): Promise<Decision> {
  const prompt = `You are a French email classifier. Return ONLY strict JSON:

{
  "category": "ONE_VALUE_AMONG: Orders|Hotels and Travel|Advertisement|Bills|Personal|Tech",
  "action": "move",
  "folder": "SAME_VALUE_AS_CATEGORY",
  "confidence": 0.85
}

Strict rules - return EXACTLY ONE category:
- "Orders" = Amazon, e-commerce, purchase confirmations, deliveries
- "Hotels and Travel" = Booking, SNCF, airlines, Airbnb, travel
- "Advertisement" = Commercial newsletters, promotions, marketing, offers
- "Bills" = Bank, EDF, taxes, insurance, invoices, payments
- "Personal" = Friends, family, non-commercial personal emails
- "Tech" = GitHub, Stack Overflow, tech training, IT news, Azure, development

Reply ONLY the JSON, NO text before/after.

Email:
From: ${input.from}
Subject: ${input.subject}
Content: ${input.content}`;

  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.1 } })
  });
  const data = await res.json() as any;
  const text: string = data.response || "{}";
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  const parsed = JSON.parse(json);
  
  // Stricter validation
  const validCategories = ["Orders", "Hotels and Travel", "Advertisement", "Bills", "Personal", "Tech"];
  if (!parsed.category || !validCategories.includes(parsed.category)) {
    logger.warn(`Invalid category: ${parsed.category}, defaulting to Advertisement`);
    parsed.category = "Advertisement";
    parsed.folder = "Advertisement";
  }
  
  // Ensure folder matches category (some LLMs add underscores)
  parsed.folder = parsed.category;
  
  if (!parsed.action) throw new Error("Invalid LLM output: missing action");
  return parsed as Decision;
}
