import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

// Helper function to check license status
const isLicensed = (context) => {
  // license object is only present in production for paid apps
  return context.license ? context.license.isActive : true;
};

// Endpoint to check license status from frontend
resolver.define('checkLicense', ({ context }) => {
  return {
    isLicensed: isLicensed(context),
  };
});

resolver.define('getFlow', async (req) => {
  const pageId = req.context.extension.content.id;
  try {
    const data = await storage.get(`api-flow-${pageId}`);
    return {
      data: data || null,
      isLicensed: isLicensed(req.context),
    };
  } catch (error) {
    console.error('Failed to get flow', error);
    return { data: null, isLicensed: isLicensed(req.context) };
  }
});

resolver.define('setFlow', async (req) => {
  const pageId = req.context.extension.content.id;
  const { flowData } = req.payload;

  // Check license before allowing save (write operations require license)
  if (!isLicensed(req.context)) {
    throw new Error('A valid license is required to save flow data.');
  }

  try {
    await storage.set(`api-flow-${pageId}`, flowData);
    return { success: true };
  } catch (error) {
    console.error('Failed to set flow', error);
    throw new Error('Could not save flow data.');
  }
});

export const handler = resolver.getDefinitions();
