import { NextRequest, NextResponse } from 'next/server';
import { getServices } from '@/lib/services/factory';
import { withAuth } from '@/lib/services/auth-middleware';

/**
 * GET /api/providers
 * List all available providers and their connection status for current user
 *
 * Returns:
 * {
 *   available: ['facebook', 'notion', 'tiktok'],
 *   connected: {
 *     facebook: { connected: true, expiresAt: '2025-01-01', ... },
 *     notion: { connected: true, metadata: {...} }
 *   }
 * }
 */
async function handleGet(request: NextRequest, userId: string): Promise<NextResponse> {
  try {
    const services = getServices();
    // Get all available providers
    const availableProviders = services.providerRegistry.listProviders();

    // Get connection status for each provider
    const connected: Record<string, any> = {};

    for (const providerType of availableProviders) {
      const provider = services.providerRegistry.getProvider(providerType);
      const status = await provider.getStatus(userId);
      if (status) {
        connected[providerType] = status;
      }
    }

    return NextResponse.json({
      userId,
      available: availableProviders,
      connected,
      connectedCount: Object.keys(connected).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch provider status', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/providers/:type
 * Disconnect a provider from user account
 */
async function handleDelete(request: NextRequest, userId: string): Promise<NextResponse> {
  try {
    // Extract provider type from URL
    const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean);
    const providerType = pathSegments[2];

    if (!providerType) {
      return NextResponse.json({ error: 'Provider type missing' }, { status: 400 });
    }

    // Get provider and disconnect
    const provider = services.providerRegistry.getProvider(providerType);
    await provider.disconnect(userId);

    return NextResponse.json({
      success: true,
      message: `${providerType} disconnected successfully`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to disconnect provider',
        details: String(error),
      },
      { status: 500 }
    );
  }
}

const services = getServices();
export const GET = withAuth(handleGet, services.authMiddleware);
export const DELETE = withAuth(handleDelete, services.authMiddleware);
