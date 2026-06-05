import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { clearStoredInventoryToken, getStoredInventoryToken, storeInventoryToken } from '../api/auth';
import {
  generateCollectionCard,
  getCabinetCommands,
  getCollectionCardStatus,
  getCollections,
  prepareCollectionMint,
  updateCollection,
  uploadCollectionImage,
} from '../api/inventory';
import {
  adaptCabinetCommandsToCabinet,
  adaptCardStatusIntoItem,
  adaptCollectionDetailPatch,
  adaptCollectionToInventoryItem,
  buildInventoryDashboardData,
  deriveCabinetCodeFromLocation,
  toInventoryCardStatus,
} from './adapters';
import { inventoryDemoData } from '../../data/inventoryDemoData';
import type {
  BackendCardStatusResponse,
  InventoryActionKind,
  InventoryActionNotice,
  InventoryConversionState,
  InventoryDashboardData,
  InventoryDataSource,
  InventoryItemViewModel,
} from '../../types/inventory';

const DEFAULT_STYLE_PROMPT =
  'Holographic frosted neon sci-fi collectible card, cyan and blue glow, dark glassmorphism vault interface, premium cyberpunk display.';
const CARD_POLL_INTERVAL_MS = 2500;
const CARD_POLL_TIMEOUT_MS = 120000;
const COLLECTION_POLL_INTERVAL_MS = 2500;
const COLLECTION_POLL_TIMEOUT_MS = 90000;

interface InventoryActionState {
  kind: InventoryActionKind;
  collectionId?: number;
}

export interface UseInventoryDataResult {
  data: InventoryDashboardData;
  loading: boolean;
  error: string | null;
  token: string;
  dataSource: InventoryDataSource;
  notice: InventoryActionNotice | null;
  actionState: InventoryActionState | null;
  conversionState: InventoryConversionState;
  guidedStage: 'upload' | 'review' | 'card' | 'mint';
  guidedCollectionId?: number;
  setGuidedStage: (stage: 'upload' | 'review' | 'card' | 'mint') => void;
  setToken: (token: string) => void;
  clearToken: () => void;
  refresh: () => Promise<void>;
  generateCardForItem: (collectionId: number) => Promise<void>;
  prepareMintForItem: (collectionId: number) => Promise<void>;
  viewTokenUriForItem: (tokenUri?: string) => Promise<void>;
  uploadCollection: (file: File) => Promise<void>;
  oneClickConvert: (collectionId: number) => Promise<void>;
  saveCollectionMetadata: (
    collectionId: number,
    payload: {
      attributes: {
        ip_name: string;
        series: string;
        material: string;
        dominant_colors: string[];
        condition: string;
        style_tags: string[];
      };
      physical_location: string;
    },
  ) => Promise<void>;
}

const INITIAL_CONVERSION_STATE: InventoryConversionState = {
  uploadStatus: 'idle',
  aiStatus: 'idle',
  cardStatus: 'idle',
  mintStatus: 'idle',
};

export function useInventoryData(): UseInventoryDataResult {
  const [token, setTokenState] = useState('');
  const [data, setData] = useState<InventoryDashboardData>(inventoryDemoData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<InventoryDataSource>('demo');
  const [notice, setNotice] = useState<InventoryActionNotice | null>(null);
  const [actionState, setActionState] = useState<InventoryActionState | null>(null);
  const [conversionState, setConversionState] = useState<InventoryConversionState>(INITIAL_CONVERSION_STATE);
  const [guidedStage, setGuidedStage] = useState<'upload' | 'review' | 'card' | 'mint'>('upload');
  const [guidedCollectionId, setGuidedCollectionId] = useState<number | undefined>(undefined);

  useEffect(() => {
    setTokenState(getStoredInventoryToken());
  }, []);

  const loadInventory = useCallback(async (authToken: string) => {
    if (!authToken) {
      setData(inventoryDemoData);
      setDataSource('demo');
      setError('Paste a test JWT to load your real collections. Showing demo inventory for now.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getCollections(authToken);
      const items = response.collections.map(adaptCollectionToInventoryItem);

      const uniqueCabinetCodes = Array.from(
        new Set(
          items
            .map((item) => deriveCabinetCodeFromLocation(item.physicalLocation))
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const cabinetResponses = await Promise.all(
        uniqueCabinetCodes.map(async (cabinetCode) => {
          try {
            return await getCabinetCommands(cabinetCode);
          } catch {
            return null;
          }
        }),
      );

      const cabinets = cabinetResponses
        .map((commands, index) => {
          if (!commands) {
            return null;
          }
          return adaptCabinetCommandsToCabinet(commands, items, index + 1);
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      const nextData: InventoryDashboardData = {
        ...buildInventoryDashboardData(items),
        cabinets,
        telemetry: [],
        diagnostics: [],
      };

      setData(nextData);
      setDataSource(cabinets.length ? 'mixed' : 'backend');
    } catch (requestError) {
      setData(inventoryDemoData);
      setDataSource('demo');
      setError(toReadableError(requestError, 'Failed to load live inventory data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory(token);
  }, [loadInventory, token]);

  const refresh = useCallback(async () => {
    setActionState({ kind: 'refresh' });
    try {
      await loadInventory(token);
      if (token) {
        setNotice({ tone: 'success', message: 'Inventory refreshed from the backend.' });
      }
    } finally {
      setActionState(null);
    }
  }, [loadInventory, token]);

  const setToken = useCallback((nextToken: string) => {
    storeInventoryToken(nextToken);
    setTokenState(nextToken.trim());
    setNotice({ tone: 'success', message: 'JWT saved. Reloading live inventory stream…' });
  }, []);

  const clearToken = useCallback(() => {
    clearStoredInventoryToken();
    setTokenState('');
    setNotice({ tone: 'info', message: 'Live token cleared. Falling back to demo mode.' });
  }, []);

  const updateItem = useCallback(
    (collectionId: number, transform: (item: InventoryItemViewModel) => InventoryItemViewModel) => {
      setData((current) => {
        const nextItems = current.items.map((item) =>
          item.collectionId === collectionId ? transform(item) : item,
        );
        return {
          ...current,
          ...buildInventoryDashboardData(nextItems),
          cabinets: current.cabinets,
          telemetry: current.telemetry,
          diagnostics: current.diagnostics,
        };
      });
    },
    [],
  );

  const generateCardForItem = useCallback(
    async (collectionId: number) => {
      if (!token) {
        setNotice({ tone: 'error', message: 'Paste a test JWT before triggering Generate Card.' });
        return;
      }

      setActionState({ kind: 'generate_card', collectionId });
      setNotice({ tone: 'info', message: 'Card generation triggered. Polling render status…' });

      try {
        await generateCollectionCard(token, collectionId, DEFAULT_STYLE_PROMPT);
        const status = await pollCardStatus(token, collectionId);
        updateItem(collectionId, (item) => adaptCardStatusIntoItem(item, status));
        setConversionState((current) => ({
          ...current,
          collectionId,
          cardStatus: toInventoryCardStatus(status.card_generation_status),
        }));
        setGuidedCollectionId(collectionId);
        setGuidedStage('mint');
        await loadInventory(token);
        setNotice({ tone: 'success', message: 'Virtual card render completed and inventory refreshed.' });
      } catch (requestError) {
        setNotice({ tone: 'error', message: toReadableError(requestError, 'Generate Card failed.') });
      } finally {
        setActionState(null);
      }
    },
    [loadInventory, token, updateItem],
  );

  const prepareMintForItem = useCallback(
    async (collectionId: number) => {
      if (!token) {
        setNotice({ tone: 'error', message: 'Paste a test JWT before triggering Prepare Mint.' });
        return;
      }

      setActionState({ kind: 'prepare_mint', collectionId });
      setNotice({ tone: 'info', message: 'Preparing metadata and mint payload…' });

      try {
        const result = await prepareCollectionMint(token, collectionId);
        updateItem(collectionId, (item) =>
          adaptCollectionDetailPatch(item, {
            token_uri: result.tokenURI,
            status: result.status,
            royalty_fee: result.royaltyFee,
          }),
        );
        setConversionState((current) => ({
          ...current,
          collectionId,
          mintStatus: 'prepared',
          tokenUri: result.tokenURI,
        }));
        setGuidedCollectionId(collectionId);
        setGuidedStage('mint');
        await loadInventory(token);
        setNotice({ tone: 'success', message: 'Mint preparation completed and token URI attached.' });
      } catch (requestError) {
        setConversionState((current) => ({
          ...current,
          mintStatus: 'failed',
        }));
        setNotice({ tone: 'error', message: toReadableError(requestError, 'Prepare Mint failed.') });
      } finally {
        setActionState(null);
      }
    },
    [loadInventory, token, updateItem],
  );

  const viewTokenUriForItem = useCallback(async (tokenUri?: string) => {
    if (!tokenUri) {
      setNotice({ tone: 'error', message: 'No token URI is available for this collectible yet.' });
      return;
    }

    if (/^https?:\/\//i.test(tokenUri)) {
      window.open(tokenUri, '_blank', 'noopener,noreferrer');
      setNotice({ tone: 'success', message: 'Token URI opened in a new tab.' });
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tokenUri);
        setNotice({ tone: 'success', message: 'Token URI copied to clipboard.' });
        return;
      }
    } catch {
      // fall through to inline notice below
    }

    setNotice({ tone: 'info', message: `Token URI: ${tokenUri}` });
  }, []);

  const uploadCollection = useCallback(
    async (file: File) => {
      if (!token) {
        setNotice({ tone: 'error', message: 'Paste a test JWT before uploading a collectible image.' });
        return;
      }

      setActionState({ kind: 'upload_collection' });
      setGuidedStage('upload');
      setConversionState({
        uploadedFileName: file.name,
        uploadStatus: 'uploading',
        aiStatus: 'pending',
        cardStatus: 'idle',
        mintStatus: 'idle',
      });
      setNotice({ tone: 'info', message: 'Uploading collectible image and starting AI identification…' });

      try {
        const response = await uploadCollectionImage(token, file);
        setConversionState((current) => ({
          ...current,
          collectionId: response.collection_id,
          uploadStatus: 'uploaded',
          aiStatus: 'pending',
        }));
        setGuidedCollectionId(response.collection_id);

        const createdItem = await pollCollectionUntilStored(token, response.collection_id);
        setConversionState((current) => ({
          ...current,
          aiStatus: createdItem.status === 'failed' ? 'failed' : 'stored',
          cardStatus: createdItem.cardGenerationStatus,
          tokenUri: createdItem.tokenUri,
        }));

        await loadInventory(token);
        setGuidedStage(createdItem.status === 'failed' ? 'upload' : 'review');
        setNotice({ tone: 'success', message: 'Collection uploaded and AI identification completed.' });
      } catch (requestError) {
        setConversionState((current) => ({
          ...current,
          uploadStatus: 'failed',
          aiStatus: 'failed',
        }));
        setNotice({ tone: 'error', message: toReadableError(requestError, 'Upload failed.') });
      } finally {
        setActionState(null);
      }
    },
    [loadInventory, token],
  );

  const oneClickConvert = useCallback(
    async (collectionId: number) => {
      if (!token) {
        setNotice({ tone: 'error', message: 'Paste a test JWT before running one-click convert.' });
        return;
      }

      setActionState({ kind: 'one_click_convert', collectionId });
      setNotice({ tone: 'info', message: 'Running one-click convert through card generation and mint prep…' });
      setConversionState((current) => ({
        ...current,
        collectionId,
        aiStatus: current.aiStatus === 'idle' ? 'stored' : current.aiStatus,
      }));
      setGuidedCollectionId(collectionId);

      try {
        await generateCollectionCard(token, collectionId, DEFAULT_STYLE_PROMPT);
        const cardStatus = await pollCardStatus(token, collectionId);
        setConversionState((current) => ({
          ...current,
          cardStatus: toInventoryCardStatus(cardStatus.card_generation_status),
          mintStatus: 'preparing',
        }));

        const mintResult = await prepareCollectionMint(token, collectionId);
        setConversionState((current) => ({
          ...current,
          mintStatus: 'prepared',
          tokenUri: mintResult.tokenURI,
        }));
        setGuidedStage('mint');
        await loadInventory(token);
        setNotice({ tone: 'success', message: 'One-click conversion completed through mint preparation.' });
      } catch (requestError) {
        setConversionState((current) => ({
          ...current,
          mintStatus: 'failed',
        }));
        setNotice({ tone: 'error', message: toReadableError(requestError, 'One-click conversion failed.') });
      } finally {
        setActionState(null);
      }
    },
    [loadInventory, token],
  );

  const saveCollectionMetadata = useCallback(
    async (
      collectionId: number,
      payload: {
        attributes: {
          ip_name: string;
          series: string;
          material: string;
          dominant_colors: string[];
          condition: string;
          style_tags: string[];
        };
        physical_location: string;
      },
    ) => {
      if (!token) {
        setNotice({ tone: 'error', message: 'Paste a test JWT before saving collection metadata.' });
        return;
      }

      setActionState({ kind: 'refresh', collectionId });
      setNotice({ tone: 'info', message: 'Saving reviewed metadata to the collection…' });

      try {
        const updated = await updateCollection(token, collectionId, payload);
        const updatedItem = adaptCollectionToInventoryItem(updated as never);
        updateItem(collectionId, () => updatedItem);
        setConversionState((current) => ({
          ...current,
          collectionId,
          aiStatus: 'stored',
        }));
        setGuidedCollectionId(collectionId);
        setGuidedStage('card');
        await loadInventory(token);
        setNotice({ tone: 'success', message: 'Metadata saved. You can now continue to card generation.' });
      } catch (requestError) {
        setNotice({ tone: 'error', message: toReadableError(requestError, 'Saving metadata failed.') });
      } finally {
        setActionState(null);
      }
    },
    [loadInventory, token, updateItem],
  );

  return useMemo(
    () => ({
      data,
      loading,
      error,
      token,
      dataSource,
      notice,
      actionState,
      conversionState,
      guidedStage,
      guidedCollectionId,
      setGuidedStage,
      setToken,
      clearToken,
      refresh,
      generateCardForItem,
      prepareMintForItem,
      viewTokenUriForItem,
      uploadCollection,
      oneClickConvert,
      saveCollectionMetadata,
    }),
    [
      actionState,
      clearToken,
      conversionState,
      data,
      dataSource,
      error,
      generateCardForItem,
      guidedCollectionId,
      guidedStage,
      loading,
      notice,
      oneClickConvert,
      prepareMintForItem,
      refresh,
      saveCollectionMetadata,
      setGuidedStage,
      setToken,
      token,
      uploadCollection,
      viewTokenUriForItem,
    ],
  );
}

async function pollCardStatus(token: string, collectionId: number): Promise<BackendCardStatusResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < CARD_POLL_TIMEOUT_MS) {
    const status = await getCollectionCardStatus(token, collectionId);
    if (status.card_generation_status !== 'GENERATING' && status.card_generation_status !== 'PENDING') {
      return status;
    }

    await new Promise((resolve) => window.setTimeout(resolve, CARD_POLL_INTERVAL_MS));
  }

  throw new Error('Timed out while waiting for card generation to finish.');
}

async function pollCollectionUntilStored(token: string, collectionId: number): Promise<InventoryItemViewModel> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < COLLECTION_POLL_TIMEOUT_MS) {
    const response = await getCollections(token);
    const match = response.collections.find((collection) => collection.id === collectionId);
    if (match) {
      const item = adaptCollectionToInventoryItem(match);
      if (item.status !== 'pending_ai') {
        return item;
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, COLLECTION_POLL_INTERVAL_MS));
  }

  throw new Error('Timed out while waiting for AI identification to finish.');
}

function toReadableError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
