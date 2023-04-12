import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import VideoPlayer, { ControlsTypes } from "../VideoPlayer/VideoPlayer";

import styles from './VideoCard.module.scss';
import { API_BASE_URL } from "../../config";

export type VideoCardProps = {
  video: string;
}

export function VideoCard({ video }: VideoCardProps) {
  const [visible, setVisible] = useState<boolean>(false);
  const [seeking, setSeeking] = useState<boolean>(false);

  const timerIDRef = useRef<NodeJS.Timeout | null>(null);

  const mouseEntered = () => {
    timerIDRef.current = setTimeout(() => {
      setVisible(true);
    }, 1000);
  }

  const mouseOut = () => {
    setVisible(false);

    if (timerIDRef.current) {
      clearTimeout(timerIDRef.current);
      timerIDRef.current = null;
    }
  }

  const seekingHandler = (isSeeking: boolean) => {
    setSeeking(isSeeking);
  }

  return (
    <Link to={visible && seeking ? '' : `/videos/${video}`} className={styles.link}>
      <div className={styles.container} onMouseEnter={() => mouseEntered()} onMouseLeave={() => mouseOut()}>
        <img className={styles.container__thumb} width='200' height='112.5' src={`${API_BASE_URL}/watch/${video}/thumbnail`}></img>
        <div className={styles.container__title}>
          <p className={styles.text}>{video}</p>
        </div>
        <div className={`${styles.container__videoPlayer} ${visible ? styles.visible : ''}`}>
          <VideoPlayer seekingHandler={seekingHandler} video={video} paused={!visible} autoPlay={true} muted={true} controls={ControlsTypes.SIMPLIFIED} />
        </div>
      </div>
    </Link>
  );
}

export default VideoCard;
