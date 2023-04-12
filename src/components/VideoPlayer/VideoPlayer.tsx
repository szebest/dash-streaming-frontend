import { SyntheticEvent, useEffect, useMemo, useState, MouseEvent as ReactMouseEvent } from "react";
import { useVideoSrc } from "../../hooks";

import Dropdown from 'react-bootstrap/Dropdown';
import { DropdownButton } from "react-bootstrap";

import styles from './VideoPlayer.module.scss';

let uniqueId = 0;
let containerUniqueId = 0;
let timelineUniqueId = 0;

export enum ControlsTypes {
  DISABLED = 0,
  FULL = 1,
  SIMPLIFIED = 2
}

export type VideoPlayerProps = {
  video: string;
  paused: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  controls?: ControlsTypes;
  seekingHandler?: (seeking: boolean) => void
}

export function VideoPlayer({ video, paused, autoPlay = true, muted = false, controls = ControlsTypes.FULL, seekingHandler }: VideoPlayerProps) {
  const id = useMemo(() => `videoPlayer-${uniqueId++}`, []);
  const containerId = useMemo(() => `videoPlayer-container-${containerUniqueId++}`, []);
  const timelineId = useMemo(() => `videoPlayer-timeline-${timelineUniqueId++}`, []);

  const TOTAL_MARGIN = useMemo(() => {
    switch (controls) {
      case ControlsTypes.DISABLED: return 0;
      case ControlsTypes.FULL: return 24;
      case ControlsTypes.SIMPLIFIED: return 0;
      default: return 0;
    }
  }, [controls]);
  const CONTROLS_HEIGHT = useMemo(() => {
    switch (controls) {
      case ControlsTypes.DISABLED: return 7.5;
      case ControlsTypes.FULL: return 50;
      case ControlsTypes.SIMPLIFIED: return 7.5;
      default: return 7.5;
    }
  }, [controls]);

  const videoPlaybackSpeeds = useMemo(() => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], []);

  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [timelineEl, setTimelineEl] = useState<HTMLDivElement | null>(null);

  const [playerProgress, setPlayerProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(paused);
  const [volume, setVolume] = useState<number>(50);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [wasPaused, setWasPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(muted);

  const player = useVideoSrc(video, paused, videoEl);

  useEffect(() => {
    const video = document.getElementById(id) as HTMLVideoElement;
    const container = document.getElementById(containerId) as HTMLDivElement;
    const timeline = document.getElementById(timelineId) as HTMLDivElement;

    video.volume = volume / 100;

    setVideoEl(video);
    setContainerEl(container);
    setTimelineEl(timeline);
  }, [])

  useEffect(() => {
    if (volume === 0) {
      setIsMuted(true);
    }

    if (!videoEl) return;

    videoEl.volume = volume / 100;
  }, [volume])

  useEffect(() => {
    if (!videoEl) return;

    const intervalId = setInterval(() => {
      onTimeUpdate(videoEl.currentTime, videoEl.duration);
    }, 10);

    return () => {
      clearInterval(intervalId);
    }
  }, [videoEl])

  useEffect(() => {
    document.addEventListener("mousemove", handleTimelineUpdate);
    document.addEventListener('mouseup', seekEnd);

    if (seekingHandler) {
      seekingHandler(isScrubbing);
    }

    return () => {
      document.removeEventListener("mousemove", handleTimelineUpdate);
      document.removeEventListener('mouseup', seekEnd);
    }
  }, [isScrubbing])

  useEffect(() => {
    if (!videoEl) return;

    setIsPaused(videoEl.paused);
  }, [videoEl?.paused])

  useEffect(() => {
    const shouldBeFullscreen = !!document.fullscreenElement;

    setIsFullscreen(shouldBeFullscreen);
  }, [document.fullscreenElement])

  function onTimeUpdate(currentTime: number, duration: number): void {
    setPlayerProgress(currentTime / duration);
  }

  function togglePlay(): void {
    if (!videoEl) return;

    let newValue = !isPaused;

    if (videoEl.duration - videoEl.currentTime <= 0.2) {
      setPlayerProgress(0);
      videoEl.currentTime = 0;

      newValue = false;
    }

    if (newValue) {
      videoEl.pause();
    }
    else {
      videoEl.play();
    }
  }

  function toggleFullscreen(): void {
    if (!containerEl) return;

    setIsFullscreen(prev => {
      const newValue = !prev;

      if (newValue) {
        containerEl.requestFullscreen();
      }
      else {
        document.exitFullscreen();
      }

      return newValue;
    })
  }

  function toggleMute(e: ReactMouseEvent | Event): void {
    e.stopPropagation();
    e.preventDefault();

    setIsMuted(prev => {
      const newValue = !prev;

      if (!newValue && volume === 0) {
        if (controls === ControlsTypes.FULL) {
          setVolume(100);
        }
        else {
          setVolume(50);
        }
      }

      return newValue;
    });
  }

  function onVolumeChange(e: SyntheticEvent<HTMLInputElement>): void {
    if (!videoEl) return;

    const newVolume = +e.currentTarget.value;
    setIsMuted(false);
    setVolume(newVolume);
  }

  function seeking(e: MouseEvent): void {
    e.stopPropagation();
    e.preventDefault();

    if (!timelineEl || !videoEl) return;

    const rect = timelineEl.getBoundingClientRect();

    const percent = Math.min(Math.max(0, e.x ?? e.clientX - rect.x), rect.width) / rect.width;

    if (!isNaN(percent)) {
      videoEl.currentTime = percent * videoEl.duration;
      setPlayerProgress(percent);
    }

    setIsScrubbing(true);
    setWasPaused(videoEl.paused);

    videoEl.pause();
  }

  function seekEnd(e: MouseEvent): void {
    e.stopPropagation();
    e.preventDefault();

    if (!videoEl) return;

    setIsScrubbing(false);

    if (wasPaused) {
      videoEl.pause();
    }
    else {
      videoEl.play().catch(() => {})
    }
  }

  function handleTimelineUpdate(e: MouseEvent): void {
    e.stopPropagation();
    e.preventDefault();

    if (!isScrubbing || !timelineEl || !videoEl) return;

    const rect = timelineEl.getBoundingClientRect();
    const percent = Math.min(Math.max(0, e.x - rect.x), rect.width) / rect.width;

    if (!isNaN(percent)) {
      videoEl.currentTime = percent * videoEl.duration;
      setPlayerProgress(percent);
    }
  }

  function handleOnClick(): void {
    togglePlay();
  }

  function handleOnDoubleClick(): void {
    toggleFullscreen();
    togglePlay();
  }

  function handleChangeResolution(qualityId: number): void {
    if (!player) return;

    player.onResolutionChange(qualityId);
  }

  function handleChangePlaybackSpeed(speed: number): void {
    if (!videoEl) return;

    videoEl.playbackRate = speed;
  }

  function formatTime(time: number): string {
    const date = new Date(0);
    date.setSeconds(time);
    
    let startingCut = 15;

    if (time >= 3600) {
      startingCut = 11;
    }
    else if (time >= 600) {
      startingCut = 14;
    }

    return date.toISOString().substring(startingCut, 19);
  }

  return (
    <div className={styles.container} id={containerId} style={{["--side-margin" as any]: TOTAL_MARGIN / 2 + 'px'}}>
      <div className={`${styles.ui} ${isPaused ? styles.paused : ''}`} style={{["--controls-height" as any]: CONTROLS_HEIGHT + 'px'}}>
        <div className={styles.clickable} onClick={handleOnClick} onDoubleClick={handleOnDoubleClick}>

        </div>
        {controls !== ControlsTypes.DISABLED &&
          <div>
            {videoEl && !isNaN(videoEl.duration) && controls === ControlsTypes.SIMPLIFIED &&
              <div className={styles.time__simplified}>
                <span className={styles.text}>{formatTime(videoEl.currentTime)} / {formatTime(videoEl.duration)}</span>
              </div>
            }
            <div className={styles.timeline__wrapper}>
              <div className={`${styles.timeline} ${isScrubbing ? styles.scrubbing : ''}`} id={timelineId} style={{["--progress-position" as any]: playerProgress}} onMouseDown={seeking as any}>
                <div className={styles.thumb}></div>
              </div>
            </div>
          </div>
        }
        {controls === ControlsTypes.SIMPLIFIED &&
          <div className={styles['simplified-controls']}>
            <div className={styles.volume}>
              <button className={styles.mute} onClick={toggleMute}>
                <svg className={`${styles["volume-high-icon"]} ${!isMuted && volume >= 50 ? styles.visible : ''}`} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
                </svg>
                <svg className={`${styles["volume-low-icon"]} ${!isMuted && volume < 50 && volume > 0 ? styles.visible : ''}`} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16C17.5,15.29 18.5,13.76 18.5,12Z" />
                </svg>
                <svg className={`${styles["volume-muted-icon"]} ${isMuted || volume === 0 ? styles.visible : ''}`} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" />
                </svg>
              </button>
            </div>
          </div>
        }
        {controls === ControlsTypes.FULL && 
          <div className={styles.controls}>
            <div className={styles.left}>
              <button className={styles['play-pause-btn']} onClick={togglePlay}>
                <svg className={`${styles['play-icon']} ${isPaused ? styles.visible : ''}`} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
                </svg>
                <svg className={`${styles['pause-icon']} ${!isPaused ? styles.visible : ''}`} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M14,19H18V5H14M6,19H10V5H6V19Z" />
                </svg>
              </button>

              <div className={styles.volume}>
                <button className={styles.mute} onClick={toggleMute}>
                  <svg className={`${styles["volume-high-icon"]} ${!isMuted && volume >= 50 ? styles.visible : ''}`} viewBox="0 0 24 24">
                    <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
                  </svg>
                  <svg className={`${styles["volume-low-icon"]} ${!isMuted && volume < 50 && volume > 0 ? styles.visible : ''}`} viewBox="0 0 24 24">
                    <path fill="currentColor" d="M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16C17.5,15.29 18.5,13.76 18.5,12Z" />
                  </svg>
                  <svg className={`${styles["volume-muted-icon"]} ${isMuted || volume === 0 ? styles.visible : ''}`} viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" />
                  </svg>
                </button>
                <div className={styles.range}>
                  <input style={{['--progress' as any]: !isMuted ? volume / 100 : 0}} type="range" min="0" max="100" value={!isMuted ? volume : 0} onInput={onVolumeChange} className={styles.slider} />
                </div>
              </div>

              {videoEl && !isNaN(videoEl.duration) && 
                <div className={styles.time}>
                  <span className={styles.text}>{formatTime(videoEl.currentTime)} / {formatTime(videoEl.duration)}</span>
                </div>
              }
            </div>

            <div className={styles.right}>
              <div className={styles.speed}>
                <DropdownButton className={styles.toggle} drop='up' align='end' title={
                  <svg height="24" viewBox="0 0 24 24" width="24">
                    <path d="M10,8v8l6-4L10,8L10,8z M6.3,5L5.7,4.2C7.2,3,9,2.2,11,2l0.1,1C9.3,3.2,7.7,3.9,6.3,5z            M5,6.3L4.2,5.7C3,7.2,2.2,9,2,11 l1,.1C3.2,9.3,3.9,7.7,5,6.3z            M5,17.7c-1.1-1.4-1.8-3.1-2-4.8L2,13c0.2,2,1,3.8,2.2,5.4L5,17.7z            M11.1,21c-1.8-0.2-3.4-0.9-4.8-2 l-0.6,.8C7.2,21,9,21.8,11,22L11.1,21z            M22,12c0-5.2-3.9-9.4-9-10l-0.1,1c4.6,.5,8.1,4.3,8.1,9s-3.5,8.5-8.1,9l0.1,1 C18.2,21.5,22,17.2,22,12z" fill="white"></path>
                  </svg>
                }>
                  {
                    videoPlaybackSpeeds.map((item) => {
                      return <Dropdown.Item className={`${videoEl?.playbackRate === item ? styles.selected : ''}`} key={item} onClick={() => handleChangePlaybackSpeed(item)}>{item}</Dropdown.Item>
                    })
                  }
                </DropdownButton>
              </div>
              <div className={styles.resolution}>
                <DropdownButton className={styles.toggle} drop='up' align='end' title={
                  <svg fill="currentColor" viewBox="0 0 122.88 76.91">
                    <g><path d="M15.78,0h91.32c4.34,0,8.29,1.77,11.15,4.63c2.86,2.86,4.63,6.8,4.63,11.15v45.35c0,4.34-1.77,8.29-4.63,11.15 c-2.86,2.86-6.8,4.63-11.15,4.63H15.78c-4.34,0-8.29-1.78-11.15-4.63C1.77,69.42,0,65.47,0,61.13V15.78 c0-4.34,1.77-8.29,4.63-11.15C7.49,1.77,11.44,0,15.78,0L15.78,0z M25.33,20.75h10.93v12.36h11.97V20.75H59.2v35.4H48.22V41.82 H36.26v14.34H25.33V20.75L25.33,20.75z M64.97,20.75h16.26c3.2,0,5.79,0.44,7.76,1.3c1.97,0.87,3.6,2.12,4.9,3.74 c1.29,1.63,2.22,3.52,2.79,5.68c0.59,2.16,0.87,4.44,0.87,6.86c0,3.78-0.43,6.72-1.29,8.8c-0.86,2.09-2.05,3.83-3.58,5.24 c-1.53,1.41-3.17,2.35-4.93,2.82c-2.4,0.64-4.57,0.96-6.52,0.96H64.97V20.75L64.97,20.75z M75.89,28.76V48.1h2.69 c2.29,0,3.92-0.26,4.9-0.76c0.96-0.51,1.72-1.39,2.27-2.65c0.55-1.27,0.82-3.31,0.82-6.15c0-3.75-0.61-6.31-1.84-7.7 c-1.23-1.38-3.26-2.08-6.11-2.08H75.89L75.89,28.76z M107.1,6.49H15.78c-2.55,0-4.88,1.05-6.56,2.73 c-1.69,1.69-2.73,4.01-2.73,6.56v45.35c0,2.55,1.05,4.88,2.73,6.56c1.69,1.69,4.01,2.73,6.56,2.73h91.32 c2.55,0,4.88-1.05,6.56-2.73s2.73-4.01,2.73-6.56V15.78c0-2.55-1.05-4.88-2.73-6.56S109.65,6.49,107.1,6.49L107.1,6.49z"/></g>
                  </svg>
                }>
                  <Dropdown.Item className={`${player?.videoResolutionId === -1 ? styles.selected : ''}`} key={-1} onClick={() => handleChangeResolution(-1)}>Automatyczna</Dropdown.Item>
                  <Dropdown.Divider />
                  {
                    player?.videoResolutions?.map((item) => {
                      return <Dropdown.Item className={`${player?.videoResolutionId === item.qualityId ? styles.selected : ''}`} key={item.qualityId} onClick={() => handleChangeResolution(item.qualityId)}>{item.resolution}</Dropdown.Item>
                    })
                  }
                </DropdownButton>
              </div>
              <button className={styles["full-screen-btn"]} onClick={toggleFullscreen}>
                <svg className={`${styles.open} ${!isFullscreen ? styles.visible : ''}`} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
                <svg className={`${styles.close} ${isFullscreen ? styles.visible : ''}`} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              </button>
            </div>
          </div>
        }
      </div>
      <video id={id} autoPlay={autoPlay} muted={isMuted} controls={false}>
        
      </video>
    </div>
  );
}

export default VideoPlayer;
