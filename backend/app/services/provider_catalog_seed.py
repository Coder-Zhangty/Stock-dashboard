from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SeedProvider:
    id: str
    name: str
    type: str
    base_url: str
    description: str


@dataclass(frozen=True)
class SeedModel:
    provider_id: str
    id: str
    display_name: str
    internal_name: str | None = None
    type: str = "chat"
    context_window: int | None = None
    tags: tuple[str, ...] = ()


SEED_PROVIDERS: tuple[SeedProvider, ...] = (
    SeedProvider("deepseek", "DeepSeek", "deepseek", "https://api.deepseek.com", "DeepSeek official OpenAI-compatible API."),
    SeedProvider("openai", "OpenAI", "openai", "https://api.openai.com/v1", "OpenAI API provider."),
    SeedProvider("anthropic", "Anthropic", "anthropic", "https://api.anthropic.com/v1", "Anthropic Claude API provider."),
    SeedProvider("google-gemini", "Google Gemini", "gemini", "https://generativelanguage.googleapis.com/v1beta", "Google Gemini API provider."),
    SeedProvider("moonshot", "Moonshot AI", "moonshot", "https://api.moonshot.cn/v1", "Moonshot Kimi OpenAI-compatible API."),
    SeedProvider("zhipu", "Zhipu GLM", "zhipu", "https://open.bigmodel.cn/api/paas/v4", "Zhipu GLM OpenAI-compatible API."),
    SeedProvider("minimax", "MiniMax", "minimax", "https://api.minimax.chat/v1", "MiniMax OpenAI-compatible API."),
    SeedProvider("baichuan", "Baichuan", "baichuan", "https://api.baichuan-ai.com/v1", "Baichuan OpenAI-compatible API."),
    SeedProvider("stepfun", "StepFun", "stepfun", "https://api.stepfun.com/v1", "StepFun OpenAI-compatible API."),
    SeedProvider("tencent-hunyuan", "Tencent Hunyuan", "hunyuan", "https://api.hunyuan.cloud.tencent.com/v1", "Tencent Hunyuan OpenAI-compatible API."),
    SeedProvider("volcengine-doubao", "Volcengine Doubao", "doubao", "https://ark.cn-beijing.volces.com/api/v3", "Volcengine Ark / Doubao OpenAI-compatible API."),
    SeedProvider("siliconflow", "SiliconFlow", "siliconflow", "https://api.siliconflow.cn/v1", "SiliconFlow OpenAI-compatible model gateway."),
    SeedProvider("openrouter", "OpenRouter", "openrouter", "https://openrouter.ai/api/v1", "OpenRouter model gateway."),
    SeedProvider("groq", "Groq", "groq", "https://api.groq.com/openai/v1", "Groq OpenAI-compatible API."),
    SeedProvider("xai", "xAI", "xai", "https://api.x.ai/v1", "xAI OpenAI-compatible API."),
    SeedProvider("mistral", "Mistral AI", "mistral", "https://api.mistral.ai/v1", "Mistral API provider."),
    SeedProvider("cohere", "Cohere", "cohere", "https://api.cohere.com/v2", "Cohere API provider."),
)


SEED_MODELS: tuple[SeedModel, ...] = (
    SeedModel("deepseek", "deepseek-chat", "DeepSeek Chat", tags=("official_docs_seed", "chat")),
    SeedModel("deepseek", "deepseek-reasoner", "DeepSeek Reasoner", tags=("official_docs_seed", "reasoning")),
    SeedModel("deepseek", "deepseek-v4-flash", "DeepSeek V4 Flash", tags=("official_api", "fast")),
    SeedModel("deepseek", "deepseek-v4-pro", "DeepSeek V4 Pro", tags=("official_api", "quality")),
    SeedModel("openai", "gpt-5.5", "GPT-5.5", tags=("official_docs_seed", "quality", "reasoning")),
    SeedModel("openai", "gpt-5.4", "GPT-5.4", tags=("official_docs_seed", "quality")),
    SeedModel("openai", "gpt-5.4-mini", "GPT-5.4 Mini", tags=("official_docs_seed", "fast")),
    SeedModel("openai", "gpt-5.3-codex", "GPT-5.3 Codex", tags=("official_docs_seed", "code")),
    SeedModel("openai", "gpt-4.1", "GPT-4.1", tags=("official_docs_seed", "quality")),
    SeedModel("openai", "gpt-4.1-mini", "GPT-4.1 Mini", tags=("official_docs_seed", "fast")),
    SeedModel("openai", "gpt-4o", "GPT-4o", type="vision", tags=("official_docs_seed", "vision")),
    SeedModel("openai", "gpt-4o-mini", "GPT-4o Mini", type="vision", tags=("official_docs_seed", "vision", "fast")),
    SeedModel("openai", "o4-mini", "o4 Mini", tags=("official_docs_seed", "reasoning")),
    SeedModel("openai", "gpt-image-1", "GPT Image 1", type="image", tags=("official_docs_seed", "image")),
    SeedModel("openai", "text-embedding-3-large", "Text Embedding 3 Large", type="embedding", tags=("official_docs_seed", "embedding")),
    SeedModel("openai", "text-embedding-3-small", "Text Embedding 3 Small", type="embedding", tags=("official_docs_seed", "embedding", "fast")),
    SeedModel("anthropic", "claude-opus-4-20250514", "Claude Opus 4", tags=("official_docs_seed", "quality")),
    SeedModel("anthropic", "claude-sonnet-4-20250514", "Claude Sonnet 4", tags=("official_docs_seed", "quality")),
    SeedModel("anthropic", "claude-3-7-sonnet-20250219", "Claude 3.7 Sonnet", tags=("official_docs_seed", "reasoning")),
    SeedModel("anthropic", "claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet", tags=("official_docs_seed", "quality")),
    SeedModel("anthropic", "claude-3-5-haiku-20241022", "Claude 3.5 Haiku", tags=("official_docs_seed", "fast")),
    SeedModel("google-gemini", "gemini-3-pro", "Gemini 3 Pro", type="vision", tags=("curated_seed", "quality", "vision")),
    SeedModel("google-gemini", "gemini-3-flash", "Gemini 3 Flash", type="vision", tags=("curated_seed", "fast", "vision")),
    SeedModel("google-gemini", "gemini-2.5-pro", "Gemini 2.5 Pro", type="vision", tags=("official_docs_seed", "quality", "vision")),
    SeedModel("google-gemini", "gemini-2.5-flash", "Gemini 2.5 Flash", type="vision", tags=("official_docs_seed", "fast", "vision")),
    SeedModel("google-gemini", "gemini-2.5-flash-lite", "Gemini 2.5 Flash Lite", type="vision", tags=("official_docs_seed", "fast")),
    SeedModel("moonshot", "kimi-k2-0711-preview", "Kimi K2 Preview", tags=("curated_seed", "quality")),
    SeedModel("moonshot", "moonshot-v1-8k", "Moonshot v1 8K", tags=("curated_seed", "chat")),
    SeedModel("moonshot", "moonshot-v1-32k", "Moonshot v1 32K", tags=("curated_seed", "long-context")),
    SeedModel("moonshot", "moonshot-v1-128k", "Moonshot v1 128K", tags=("curated_seed", "long-context")),
    SeedModel("zhipu", "glm-4.5", "GLM-4.5", tags=("curated_seed", "quality")),
    SeedModel("zhipu", "glm-4.5-air", "GLM-4.5 Air", tags=("curated_seed", "fast")),
    SeedModel("zhipu", "glm-4-plus", "GLM-4 Plus", tags=("curated_seed", "quality")),
    SeedModel("zhipu", "glm-4v-plus", "GLM-4V Plus", type="vision", tags=("curated_seed", "vision")),
    SeedModel("minimax", "abab6.5s-chat", "MiniMax abab6.5s Chat", tags=("curated_seed", "chat")),
    SeedModel("minimax", "abab6.5g-chat", "MiniMax abab6.5g Chat", tags=("curated_seed", "quality")),
    SeedModel("baichuan", "Baichuan4", "Baichuan 4", tags=("curated_seed", "quality")),
    SeedModel("baichuan", "Baichuan3-Turbo", "Baichuan 3 Turbo", tags=("curated_seed", "fast")),
    SeedModel("stepfun", "step-2-16k", "Step 2 16K", tags=("curated_seed", "quality")),
    SeedModel("stepfun", "step-1-8k", "Step 1 8K", tags=("curated_seed", "chat")),
    SeedModel("tencent-hunyuan", "hunyuan-turbos-latest", "Hunyuan Turbos Latest", tags=("curated_seed", "fast")),
    SeedModel("tencent-hunyuan", "hunyuan-large", "Hunyuan Large", tags=("curated_seed", "quality")),
    SeedModel("volcengine-doubao", "doubao-seed-1-6", "Doubao Seed 1.6", tags=("curated_seed", "quality")),
    SeedModel("volcengine-doubao", "doubao-seed-1-6-thinking", "Doubao Seed 1.6 Thinking", tags=("curated_seed", "reasoning")),
    SeedModel("volcengine-doubao", "doubao-1-5-pro-32k", "Doubao 1.5 Pro 32K", tags=("curated_seed", "quality")),
    SeedModel("siliconflow", "qwen-qwen3-235b-a22b", "Qwen3 235B A22B", internal_name="Qwen/Qwen3-235B-A22B", tags=("curated_seed", "quality")),
    SeedModel("siliconflow", "deepseek-r1", "DeepSeek R1", internal_name="deepseek-ai/DeepSeek-R1", tags=("curated_seed", "reasoning")),
    SeedModel("siliconflow", "deepseek-v3", "DeepSeek V3", internal_name="deepseek-ai/DeepSeek-V3", tags=("curated_seed", "quality")),
    SeedModel("openrouter", "openrouter-openai-gpt-5.5", "OpenRouter GPT-5.5", internal_name="openai/gpt-5.5", tags=("curated_seed", "quality")),
    SeedModel("openrouter", "openrouter-claude-sonnet-4", "OpenRouter Claude Sonnet 4", internal_name="anthropic/claude-sonnet-4", tags=("curated_seed", "quality")),
    SeedModel("openrouter", "openrouter-gemini-3-pro", "OpenRouter Gemini 3 Pro", internal_name="google/gemini-3-pro", type="vision", tags=("curated_seed", "vision")),
    SeedModel("openrouter", "openrouter-deepseek-chat", "OpenRouter DeepSeek Chat", internal_name="deepseek/deepseek-chat", tags=("curated_seed", "chat")),
    SeedModel("groq", "llama-3.3-70b-versatile", "Llama 3.3 70B Versatile", tags=("curated_seed", "fast")),
    SeedModel("groq", "llama-3.1-8b-instant", "Llama 3.1 8B Instant", tags=("curated_seed", "fast")),
    SeedModel("groq", "mixtral-8x7b-32768", "Mixtral 8x7B 32K", tags=("curated_seed", "fast")),
    SeedModel("xai", "grok-4", "Grok 4", tags=("curated_seed", "quality")),
    SeedModel("xai", "grok-3", "Grok 3", tags=("curated_seed", "quality")),
    SeedModel("xai", "grok-3-mini", "Grok 3 Mini", tags=("curated_seed", "fast")),
    SeedModel("mistral", "mistral-large-latest", "Mistral Large Latest", tags=("curated_seed", "quality")),
    SeedModel("mistral", "mistral-small-latest", "Mistral Small Latest", tags=("curated_seed", "fast")),
    SeedModel("mistral", "codestral-latest", "Codestral Latest", tags=("curated_seed", "code")),
    SeedModel("mistral", "pixtral-large-latest", "Pixtral Large Latest", type="vision", tags=("curated_seed", "vision")),
    SeedModel("cohere", "command-a-03-2025", "Command A", tags=("curated_seed", "quality")),
    SeedModel("cohere", "command-r-plus", "Command R Plus", tags=("curated_seed", "quality", "rag")),
    SeedModel("cohere", "command-r", "Command R", tags=("curated_seed", "rag")),
    SeedModel("cohere", "embed-v4.0", "Embed v4.0", type="embedding", tags=("curated_seed", "embedding")),
)


def provider_seeds() -> tuple[SeedProvider, ...]:
    return SEED_PROVIDERS


def model_seeds(provider_id: str, provider_type: str | None = None) -> list[SeedModel]:
    provider_type = provider_type or ""
    return [
        model
        for model in SEED_MODELS
        if model.provider_id == provider_id or model.provider_id == provider_type
    ]
