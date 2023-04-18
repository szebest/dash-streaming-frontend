import { useEffect, useMemo } from 'react';
import { Player } from './player';

export function useVideoSrc(videoId: string, paused: boolean, videoElement: HTMLVideoElement | null) {
  const player = useMemo(() => {
    if (!videoElement || videoId.length === 0) {
      return null;
    }
    return new Player(videoId, paused, videoElement)
  }, [videoId, videoElement]);

  useEffect(() => {
    if (!paused) {
      player?.checkInit();
    }
  }, [videoId, videoElement, paused])

  return player;
}