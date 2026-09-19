import {del, get, put} from "@vercel/blob";
import type {PrivateBlobStore} from "@memora/domain";

/**
 * The only adapter allowed to talk to Vercel Blob. The access token is read by
 * the provider SDK on the server and is never part of a return value.
 */
export function createPrivateBlobStore(): PrivateBlobStore {
  return {
    async put(pathname, bytes, contentType) {
      await put(pathname, bytes, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 0,
        contentType
      });
    },

    async get(pathname) {
      const result = await get(pathname, {access: "private", useCache: false});
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return {body: result.stream};
    },

    async delete(pathname) {
      await del(pathname);
    }
  };
}
