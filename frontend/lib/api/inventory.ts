import { apiRequest } from './client';
import type {
  BackendAuction,
  BackendAuctionListResponse,
  BackendCabinetCommandsResponse,
  BackendCardStatusResponse,
  BackendCollectionListResponse,
  BackendDiagnosticResponse,
  BackendGenerateCardResponse,
  BackendMarketplaceListingListResponse,
  BackendNFT,
  BackendNFTListResponse,
  BackendPrepareMintResponse,
  BackendUploadCollectionResponse,
} from '../../types/inventory';

export async function getCollections(token: string) {
  return apiRequest<BackendCollectionListResponse>('/api/v1/collections', { method: 'GET' }, { token });
}

export async function uploadCollectionImage(token: string, file: File) {
  const formData = new FormData();
  formData.append('image', file);

  return apiRequest<BackendUploadCollectionResponse>(
    '/api/v1/collections/upload',
    {
      method: 'POST',
      body: formData,
    },
    { token },
  );
}

export async function updateCollection(
  token: string,
  collectionId: number,
  payload: {
    attributes?: {
      ip_name: string;
      series: string;
      material: string;
      dominant_colors: string[];
      condition: string;
      style_tags: string[];
    };
    physical_location?: string;
  },
) {
  return apiRequest(`/api/v1/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, { token });
}

export async function generateCollectionCard(
  token: string,
  collectionId: number,
  stylePrompt: string,
) {
  return apiRequest<BackendGenerateCardResponse>(
    `/api/v1/collections/${collectionId}/generate-card`,
    {
      method: 'POST',
      body: JSON.stringify({ style_prompt: stylePrompt }),
    },
    { token },
  );
}

export async function getCollectionCardStatus(token: string, collectionId: number) {
  return apiRequest<BackendCardStatusResponse>(
    `/api/v1/collections/${collectionId}/card-status`,
    { method: 'GET' },
    { token },
  );
}

export async function prepareCollectionMint(token: string, collectionId: number) {
  return apiRequest<BackendPrepareMintResponse>(
    `/api/v1/collections/${collectionId}/prepare-mint`,
    { method: 'POST' },
    { token },
  );
}

export async function getCabinetCommands(cabinetCode: string) {
  return apiRequest<BackendCabinetCommandsResponse>(
    `/api/v1/hw/commands/${encodeURIComponent(cabinetCode)}`,
    { method: 'GET' },
  );
}

export async function diagnoseCabinet(token: string, cabinetId: number) {
  return apiRequest<BackendDiagnosticResponse>(
    `/api/v1/storage/cabinets/${cabinetId}/diagnose`,
    { method: 'POST' },
    { token },
  );
}

export async function applyCabinetSettings(
  token: string,
  cabinetId: number,
  payload: {
    diagnostic_record_id?: number;
    target_temp?: number;
    target_humidity?: number;
  },
) {
  return apiRequest<{ cabinet: unknown; message: string }>(
    `/api/v1/storage/cabinets/${cabinetId}/apply-settings`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { token },
  );
}

export async function getNFT(token: string, nftId: number) {
  return apiRequest<BackendNFT>(`/api/v1/nfts/${nftId}`, { method: 'GET' }, { token });
}

export async function getMyOwnedNFTs(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 20),
  });

  return apiRequest<BackendNFTListResponse>(
    `/api/v1/nfts/my/owned?${searchParams.toString()}`,
    { method: 'GET' },
    { token },
  );
}

export async function getMyCreatedNFTs(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 20),
  });

  return apiRequest<BackendNFTListResponse>(
    `/api/v1/nfts/my/created?${searchParams.toString()}`,
    { method: 'GET' },
    { token },
  );
}

export async function getMarketplaceListings(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 20),
  });

  return apiRequest<BackendMarketplaceListingListResponse>(
    `/api/v1/marketplace/listings?${searchParams.toString()}`,
    { method: 'GET' },
    { token },
  );
}

export async function getAuctions(
  token: string,
  params: { page?: number; pageSize?: number; status?: string } = {},
) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 20),
  });

  if (params.status) {
    searchParams.set('status', params.status);
  }

  return apiRequest<BackendAuctionListResponse>(
    `/api/v1/auctions?${searchParams.toString()}`,
    { method: 'GET' },
    { token },
  );
}
