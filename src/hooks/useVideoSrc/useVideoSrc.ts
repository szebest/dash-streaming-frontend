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
    return () => {
      player?.changePlayingState(false);
    }
  }, [videoId, videoElement, paused])

  useEffect(() => {
    if (!paused) {
      player?.checkInit();
      player?.changePlayingState(true);
    }
  }, [videoId, videoElement, paused])

  return player;
}