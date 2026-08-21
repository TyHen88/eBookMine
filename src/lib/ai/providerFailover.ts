import { BookContext } from "./aiProvider";
import { logger } from "@/lib/logger";

export type SupportedProvider =
  | "google"
  | "anthropic"
  | "openai"
  | "deepseek"
  | "openrouter"
  | "ollama"
  | "local";

export type ProviderCaller = (
  provider: SupportedProvider,
  prompt: string,
  context?: BookContext
) => Promise<string>;

export interface CircuitState {
  provider: SupportedProvider;
  status: "HEALTHY" | "DEGRADED" | "CIRCUIT_OPEN";
  consecutiveFailures: number;
  lastFailureTime?: number;
  lastError?: string;
  successCount: number;
  totalCalls: number;
}

export interface FailoverResult {
  text: string;
  usedProvider: SupportedProvider;
  failoverOccurred: boolean;
  attemptedProviders: SupportedProvider[];
}

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000; // 1 minute cooldown

// In-memory circuit breaker registry
const circuitRegistry = new Map<SupportedProvider, CircuitState>();

const ALL_PROVIDERS: SupportedProvider[] = [
  "google",
  "anthropic",
  "openai",
  "deepseek",
  "openrouter",
  "ollama",
  "local",
];

function getOrCreateCircuit(provider: SupportedProvider): CircuitState {
  if (!circuitRegistry.has(provider)) {
    circuitRegistry.set(provider, {
      provider,
      status: "HEALTHY",
      consecutiveFailures: 0,
      successCount: 0,
      totalCalls: 0,
    });
  }
  return circuitRegistry.get(provider)!;
}

/**
 * Checks if the circuit is currently open (blocking calls due to recent consecutive errors).
 */
export function isCircuitOpen(provider: SupportedProvider): boolean {
  if (provider === "local") return false; // Local engine never opens circuit

  const circuit = getOrCreateCircuit(provider);
  if (circuit.status === "CIRCUIT_OPEN") {
    const elapsed = Date.now() - (circuit.lastFailureTime || 0);
    if (elapsed > CIRCUIT_COOLDOWN_MS) {
      // Cooldown expired, switch to DEGRADED (half-open test state)
      circuit.status = "DEGRADED";
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Record successful provider execution.
 */
export function recordSuccess(provider: SupportedProvider): void {
  const circuit = getOrCreateCircuit(provider);
  circuit.consecutiveFailures = 0;
  circuit.status = "HEALTHY";
  circuit.successCount += 1;
  circuit.totalCalls += 1;
}

/**
 * Record provider failure and update circuit state.
 */
export function recordFailure(provider: SupportedProvider, error: any): void {
  const circuit = getOrCreateCircuit(provider);
  circuit.consecutiveFailures += 1;
  circuit.lastFailureTime = Date.now();
  circuit.lastError = error instanceof Error ? error.message : String(error);
  circuit.totalCalls += 1;

  if (circuit.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD && provider !== "local") {
    circuit.status = "CIRCUIT_OPEN";
    logger.warn(
      `[AI ProviderFailover] Circuit OPEN for "${provider}" after ${circuit.consecutiveFailures} consecutive errors. Cooldown: ${CIRCUIT_COOLDOWN_MS / 1000}s. Last error: ${circuit.lastError}`
    );
  } else {
    circuit.status = "DEGRADED";
  }
}

/**
 * Returns current health status of all providers.
 */
export function getCircuitStatus(): Record<string, CircuitState> {
  const status: Record<string, CircuitState> = {};
  ALL_PROVIDERS.forEach((p) => {
    status[p] = { ...getOrCreateCircuit(p) };
  });
  return status;
}

/**
 * Reset circuit state (useful for admin test buttons or manual reconnection).
 */
export function resetCircuit(provider?: SupportedProvider): void {
  if (provider) {
    circuitRegistry.delete(provider);
  } else {
    circuitRegistry.clear();
  }
}

/**
 * Builds the ordered fallback chain for a given primary provider.
 */
export function buildProviderChain(primaryProvider: SupportedProvider): SupportedProvider[] {
  const normalizedPrimary = primaryProvider || "local";
  const fallbacks = ALL_PROVIDERS.filter((p) => p !== normalizedPrimary);
  return [normalizedPrimary, ...fallbacks];
}

/**
 * Executes an AI generation request through a prioritized failover chain.
 */
export async function generateWithFailover(
  prompt: string,
  context: BookContext | undefined,
  caller: ProviderCaller,
  primaryProvider: SupportedProvider = "local"
): Promise<FailoverResult> {
  const chain = buildProviderChain(primaryProvider);
  const attemptedProviders: SupportedProvider[] = [];
  let lastError: any = null;

  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i];

    // Skip if circuit is currently open, unless it's the last local fallback
    if (isCircuitOpen(candidate) && candidate !== "local") {
      logger.info(`[AI ProviderFailover] Skipping "${candidate}" (circuit is OPEN).`);
      continue;
    }

    attemptedProviders.push(candidate);

    try {
      if (i > 0) {
        logger.info(`[AI ProviderFailover] Attempting failover provider "${candidate}" (attempt ${i + 1}/${chain.length})...`);
      }

      const text = await caller(candidate, prompt, context);
      recordSuccess(candidate);

      const failoverOccurred = candidate !== primaryProvider;
      if (failoverOccurred) {
        logger.info(`[AI ProviderFailover] Successfully failed over from "${primaryProvider}" to "${candidate}".`);
      }

      return {
        text,
        usedProvider: candidate,
        failoverOccurred,
        attemptedProviders,
      };
    } catch (err: any) {
      lastError = err;
      recordFailure(candidate, err);
      logger.warn(
        `[AI ProviderFailover] Provider "${candidate}" failed: ${err?.message || err}. Evaluating next fallback...`
      );
    }
  }

  // If even the fallback loop exhausted, throw the last accumulated error
  throw (
    lastError ||
    new Error(`All AI providers in failover chain failed: [${attemptedProviders.join(", ")}]`)
  );
}
