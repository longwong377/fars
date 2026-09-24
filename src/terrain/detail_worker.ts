// The hills' landform maps (terrainDetail.ts) off the main thread: both rings, returned with their buffers transferred.
import { bakeDetail, DETAIL_RING, type RingLike } from './terrainDetail';

self.onmessage = (e: MessageEvent) => {
  const { near, mid } = e.data as { near: RingLike; mid: RingLike };
  const a = bakeDetail(near, DETAIL_RING.near), b = bakeDetail(mid, DETAIL_RING.mid);
  (self as any).postMessage({ near: a, mid: b }, [a.data.buffer, b.data.buffer]);
};
