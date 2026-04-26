import Groq from "groq-sdk";
// Lazy singleton — deferred until first use so dotenv.config() has already run.
let _client = null;
export function getGroq() {
    if (!_client) {
        _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return _client;
}
//# sourceMappingURL=groqClient.js.map