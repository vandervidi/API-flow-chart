import Resolver from '@forge/resolver';
import { storage, route, asUser } from '@forge/api';

const resolver = new Resolver();

// Helper function to check license status
const isLicensed = (context) => {
  // license object is only present in production for paid apps
  return context.license ? context.license.isActive : true;
};

// Helper function to get unique storage key for each macro instance
const getStorageKey = (context, providedMacroId, providedLocalId) => {
  const pageId = context.extension.content.id;
  // Use provided macro ID, or context macro ID if available
  const macroId = providedMacroId || context.extension.macro?.id;

  // STRICT MODE: Only return a key if we have a macroId.
  // We change the prefix to 'api-flow-v2' to leave behind any corrupted/zombie data from v1/v2-fallback.
  if (macroId) {
    return `api-flow-v2-${pageId}-${macroId}`;
  }

  // DRAFT MODE: If no macroId, we fallback to localId.
  // This is unique PER macro instance on the draft page.
  // This solves the mirroring/collision issue.
  if (providedLocalId) {
    return `api-flow-v2-${pageId}-${providedLocalId}`;
  }

  // FALLBACK for unknown state (should not happen if localId is present)
  // If localId is missing for some reason, we return null to force clean slate.
  return null;
};

// Endpoint to check license status from frontend
resolver.define('checkLicense', ({ context }) => {
  return {
    isLicensed: isLicensed(context),
  };
});

resolver.define('getFlow', async (req) => {
  const { macroId, localId } = req.payload || {};
  const pageId = req.context.extension.content.id;

  // Determine text strict key (for Published components)
  const strictKey = macroId ? `api-flow-v2-${pageId}-${macroId}` : null;

  // Determine draft key (for Draft components OR migration source)
  const draftKey = localId ? `api-flow-v2-${pageId}-${localId}` : null;

  if (strictKey) {
    // 1. Try reading strict key (Primary)
    const strictData = await storage.get(strictKey);
    if (strictData) {
      return { data: strictData, isLicensed: isLicensed(req.context) };
    }

    // 2. MIGRATION: If strict data is missing, check the DRAFT key (localId).
    // This happens when a draft is published -> localId persists, but macroId is new.
    if (draftKey) {
      const draftData = await storage.get(draftKey);
      if (draftData) {
        console.log(`Migrating data from Draft (${draftKey}) to Published (${strictKey})`);
        await storage.set(strictKey, draftData);
        // Optionally clean up draft data, but it's keyed by localId so relatively safe.
        // However, cleaning it prevents future accidental reads? Not really.
        // Let's keep it clean.
        await storage.delete(draftKey);
        return { data: draftData, isLicensed: isLicensed(req.context) };
      }
    }

    // 3. LEGACY MIGRATION: Check the old 'fallback' key from v2.24-2.26
    // This ensures users who created data in "Mirror Mode" don't lose it entirely,
    // although all their charts might get the same data. Better than empty.
    const legacyFallbackKey = `api-flow-v2-${pageId}-fallback`;
    const fallbackData = await storage.get(legacyFallbackKey);
    if (fallbackData) {
      console.log(`Migrating data from Legacy Fallback to ${strictKey}`);
      await storage.set(strictKey, fallbackData);
      // Only delete if we are confident we claimed it?
      // No, multiple macros might need it. Let's NOT delete fallback immediately?
      // Actually, first macro wins. Subsequent macros start fresh.
      await storage.delete(legacyFallbackKey);
      return { data: fallbackData, isLicensed: isLicensed(req.context) };
    }

    return { data: null, isLicensed: isLicensed(req.context) };

  } else if (draftKey) {
    // DRAFT MODE (No macroId yet)
    // Read from localId key.
    const draftData = await storage.get(draftKey);

    // Note regarding Legacy Fallback in Draft:
    // If this is a NEW draft macro, it won't have localId data yet.
    // Should we look at legacy fallback?
    // If we do, multiple new drafts will mirror again.
    // Better to start fresh for new drafts to fix the "Mirroring" UX issue.
    // Existing users might have data in fallback, but they should publish to saving it.

    return { data: draftData || null, isLicensed: isLicensed(req.context) };
  }

  return { data: null, isLicensed: isLicensed(req.context) };
});

resolver.define('checkUserPermissions', async (req) => {
  const pageId = req.context.extension.content.id;
  try {
    // Check if user has permission to update the content
    // We use the 'operations' expansion to see what the user is allowed to do
    const response = await asUser().requestConfluence(route`/wiki/rest/api/content/${pageId}?expand=operations`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.status !== 200) {
      console.warn(`Permission check failed with status ${response.status}`);
      return { canEdit: false };
    }

    const data = await response.json();
    const canEdit = data.operations && data.operations.some(op => op.operation === 'update' && op.targetType === 'page');

    return { canEdit: !!canEdit };
  } catch (error) {
    console.error('Error checking permissions:', error);
    return { canEdit: false };
  }
});

resolver.define('setFlow', async (req) => {
  const { flowData, macroId, localId } = req.payload;

  // Determine best key for writing
  // If macroId exists (Published), use it.
  // If no macroId, use localId (Draft).
  const storageKey = getStorageKey(req.context, macroId, localId);

  // Check license before allowing save (write operations require license)
  if (!isLicensed(req.context)) {
    throw new Error('A valid license is required to save flow data.');
  }

  if (!storageKey) {
    throw new Error('Cannot save flow data: Missing ID.');
  }

  try {
    await storage.set(storageKey, flowData);
    return { success: true };
  } catch (error) {
    console.error('Failed to set flow', error);
    throw new Error('Could not save flow data.');
  }
});

// Endpoint to delete flow data (for cleanup when macro is removed)
resolver.define('deleteFlow', async (req) => {
  const { macroId } = req.payload || {};
  const storageKey = getStorageKey(req.context, macroId);

  if (!isLicensed(req.context)) {
    throw new Error('A valid license is required to delete flow data.');
  }

  if (!storageKey) return { success: false, reason: 'No macro ID' };

  try {
    await storage.delete(storageKey);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete flow', error);
    throw new Error('Could not delete flow data.');
  }
});

export const handler = resolver.getDefinitions();

// Event handler for when a macro is removed from a page
export const onMacroRemoved = async (event) => {
  try {
    const { macro, content } = event;
    const pageId = content?.id;
    const macroId = macro?.id;

    if (pageId && macroId) {
      // Must match the new v2 key format
      const storageKey = `api-flow-v2-${pageId}-${macroId}`;
      await storage.delete(storageKey);
      console.log(`Deleted flow data for macro: ${storageKey}`);
    }
  } catch (error) {
    console.error('Failed to delete flow data on macro removal', error);
  }
};
