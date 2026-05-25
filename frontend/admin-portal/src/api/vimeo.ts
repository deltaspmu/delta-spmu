import api from './client';
import * as tus from 'tus-js-client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIMEO_API_BASE = 'https://api.vimeo.com';
const VIMEO_TAG = 'deltaspmu-lms';

const DEFAULT_EMBED_DOMAINS = [
  'deltaspmu.com',
  'admin.deltaspmu.com',
  'api.deltaspmu.com',
  'localhost',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VimeoVideo {
  uri: string;
  name: string;
  description: string | null;
  duration: number;
  link: string;
  pictures?: { sizes: { link: string; width: number }[] };
  status: string;
  upload?: { approach: string; upload_link: string };
  privacy?: { view: string; embed: string };
}

export interface VimeoListResponse {
  total: number;
  page: number;
  per_page: number;
  data: VimeoVideo[];
}

export interface VimeoUploadCreate {
  name: string;
  description?: string;
  size: number;
}

export interface VimeoUpdatePayload {
  name?: string;
  description?: string;
  privacy?: { view?: string; embed?: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function videoIdFromUri(uri: string): string {
  // "/videos/123456" -> "123456"
  return uri.replace(/^\/videos\//, '');
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// VimeoDirectService (dev -- uses personal access token)
// ---------------------------------------------------------------------------

class VimeoDirectService {
  private token: string;

  constructor() {
    this.token = import.meta.env.VITE_VIMEO_ACCESS_TOKEN || '';
    if (!this.token) {
      console.warn('[VimeoDirectService] VITE_VIMEO_ACCESS_TOKEN is not set.');
    }
  }

  private headers() {
    return {
      ...authHeaders(this.token),
      'Content-Type': 'application/json',
      Accept: 'application/vnd.vimeo.*+json;version=3.4',
    };
  }

  async listVideos(
    page = 1,
    perPage = 25,
    query?: string,
  ): Promise<VimeoListResponse> {
    const params: Record<string, any> = {
      page,
      per_page: perPage,
      fields: 'uri,name,description,duration,link,pictures,status,upload,privacy',
    };
    if (query) params.query = query;

    const res = await fetch(
      `${VIMEO_API_BASE}/me/videos?${new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      )}`,
      { headers: this.headers() },
    );
    const json = await res.json();

    // Client-side tag filter
    const filtered = json.data?.filter((v: any) =>
      v.tags?.some((t: any) => t.tag === VIMEO_TAG),
    );

    return {
      total: filtered?.length ?? json.total,
      page: json.page,
      per_page: json.per_page,
      data: filtered ?? json.data ?? [],
    };
  }

  async getVideo(videoId: string): Promise<VimeoVideo> {
    const res = await fetch(`${VIMEO_API_BASE}/videos/${videoId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Vimeo getVideo failed: ${res.status}`);
    return res.json();
  }

  async createUpload(
    name: string,
    description: string,
    size: number,
  ): Promise<{ videoId: string; uploadLink: string }> {
    const res = await fetch(`${VIMEO_API_BASE}/me/videos`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        upload: { approach: 'tus', size },
        name,
        description,
        privacy: { view: 'disable', embed: 'whitelist' },
      }),
    });
    if (!res.ok) throw new Error(`Vimeo createUpload failed: ${res.status}`);
    const json = await res.json();
    const videoId = videoIdFromUri(json.uri);
    return { videoId, uploadLink: json.upload.upload_link };
  }

  async completeUpload(videoId: string): Promise<void> {
    // Add tag
    await fetch(`${VIMEO_API_BASE}/videos/${videoId}/tags/${VIMEO_TAG}`, {
      method: 'PUT',
      headers: this.headers(),
    });
    // Set embed domains
    await this.setEmbedDomains(videoId, DEFAULT_EMBED_DOMAINS);
  }

  async updateVideo(
    videoId: string,
    payload: VimeoUpdatePayload,
  ): Promise<VimeoVideo> {
    const res = await fetch(`${VIMEO_API_BASE}/videos/${videoId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Vimeo updateVideo failed: ${res.status}`);
    return res.json();
  }

  async deleteVideo(videoId: string): Promise<void> {
    const res = await fetch(`${VIMEO_API_BASE}/videos/${videoId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Vimeo deleteVideo failed: ${res.status}`);
  }

  async setEmbedDomains(videoId: string, domains: string[]): Promise<void> {
    for (const domain of domains) {
      await fetch(
        `${VIMEO_API_BASE}/videos/${videoId}/privacy/domains/${domain}`,
        { method: 'PUT', headers: this.headers() },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// VimeoProxyService (prod -- proxies through Frappe backend)
// ---------------------------------------------------------------------------

class VimeoProxyService {
  private proxy(method: string, params?: Record<string, any>) {
    return api
      .post(`/api/method/lms.lms.vimeo_api.${method}`, params)
      .then((res) => res.data?.message ?? res.data);
  }

  async listVideos(
    page = 1,
    perPage = 25,
    query?: string,
  ): Promise<VimeoListResponse> {
    return this.proxy('vimeo_list_videos', { page, per_page: perPage, query });
  }

  async getVideo(videoId: string): Promise<VimeoVideo> {
    return this.proxy('vimeo_get_video', { video_id: videoId });
  }

  async createUpload(
    name: string,
    description: string,
    size: number,
  ): Promise<{ videoId: string; uploadLink: string }> {
    const res = await this.proxy('vimeo_create_upload', {
      name,
      description,
      size,
    });
    return { videoId: res.video_id, uploadLink: res.upload_link };
  }

  async completeUpload(videoId: string): Promise<void> {
    await this.proxy('vimeo_complete_upload', { video_id: videoId });
  }

  async updateVideo(
    videoId: string,
    payload: VimeoUpdatePayload,
  ): Promise<VimeoVideo> {
    return this.proxy('vimeo_update_video', {
      video_id: videoId,
      ...payload,
    });
  }

  async deleteVideo(videoId: string): Promise<void> {
    await this.proxy('vimeo_delete_video', { video_id: videoId });
  }

  async setEmbedDomains(videoId: string, domains: string[]): Promise<void> {
    await this.proxy('vimeo_set_embed_domains', {
      video_id: videoId,
      domains,
    });
  }
}

// ---------------------------------------------------------------------------
// Exported service (picks mode based on env)
// ---------------------------------------------------------------------------

const useProxy = import.meta.env.VITE_USE_VIMEO_PROXY === 'true';

export const vimeoService = useProxy
  ? new VimeoProxyService()
  : new VimeoDirectService();

// ---------------------------------------------------------------------------
// TUS upload helper
// ---------------------------------------------------------------------------

/**
 * Uploads a video file to Vimeo using the TUS protocol.
 *
 * @param uploadUrl - The TUS upload URL returned by createUpload.
 * @param file      - The File object to upload.
 * @param onProgress - Callback receiving upload percentage (0-100).
 * @returns Promise that resolves when the upload completes.
 */
export function uploadVideoFile(
  uploadUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl,
      endpoint: uploadUrl,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 128 * 1024 * 1024, // 128 MB chunks
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      onError(error) {
        console.error('[TUS] Upload error:', error);
        reject(error);
      },
      onProgress(bytesUploaded, bytesTotal) {
        const pct = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress(pct);
      },
      onSuccess() {
        onProgress(100);
        resolve();
      },
    });

    // Check for previous uploads and resume if possible
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  });
}
