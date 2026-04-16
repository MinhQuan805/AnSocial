import type { IProvider, ProviderRegistry } from "@/lib/core/auth.types";
import { AuthError } from "@/lib/core/errors";

/**
 * ProviderRegistry - Factory Pattern Implementation
 * 
 * Manages provider instances and allows extensions
 * Example usage:
 *   - registry.register('tiktok', new TikTokProvider(...))
 *   - registry.getProvider('facebook').connect(userId, code, state)
 *   - registry.listProviders() // ['facebook', 'tiktok']
 */
export class ProviderRegistryImpl implements ProviderRegistry {
  private providers = new Map<string, IProvider>();

  /**
   * Register a provider implementation
   */
  public register(type: string, provider: IProvider): void {
    if (this.providers.has(type)) {
      throw new Error(`Provider '${type}' already registered`);
    }
    this.providers.set(type, provider);
  }

  /**
   * Get a registered provider by type
   */
  public getProvider(type: string): IProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new AuthError(`Provider '${type}' not found. Available: ${Array.from(this.providers.keys()).join(", ")}`);
    }
    return provider;
  }

  /**
   * List all registered provider types
   */
  public listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  public hasProvider(type: string): boolean {
    return this.providers.has(type);
  }

  /**
   * Unregister a provider (for testing or dynamic removal)
   */
  public unregister(type: string): void {
    this.providers.delete(type);
  }

  /**
   * Get all providers (useful for listing connected ones)
   */
  public getAllProviders(): [string, IProvider][] {
    return Array.from(this.providers.entries());
  }
}

/**
 * Usage Example (in factory.ts):
 * 
 * const registry = new ProviderRegistryImpl();
 * registry.register('facebook', new FacebookProvider(...));
 * registry.register('tiktok', new TikTokProvider(...));
 * 
 * // Extensible - add new providers without changing existing code:
 * registry.register('instagram', new InstagramProvider(...));
 * registry.register('youtube', new YouTubeProvider(...));
 * 
 * // Usage in API routes:
 * const facebookProvider = registry.getProvider('facebook');
 * const state = facebookProvider.issueState({ response });
 * const url = facebookProvider.buildAuthorizeUrl(state);
 */
