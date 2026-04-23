import Groq from "groq-sdk";

// Lazy singleton — deferred until first use so dotenv.config() has already run.
let _client: Groq | null = null;

export function getGroq(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}
