import { useParams } from "react-router-dom";
import { VideoPlayer } from "../../components";

import styles from './video-page.module.scss';

export function VideoPage() {
  const { videoId } = useParams();

  return (
    <div className={styles.container}>
      <div className={styles.container__wrapper}>
        <VideoPlayer video={videoId!} paused={false}></VideoPlayer>
      </div>
    </div>
  )
}

export default VideoPage;
