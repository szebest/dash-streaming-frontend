import { VideoCard } from "../../components";
import { useFetch } from "../../hooks";

import styles from './all-video-page.module.scss';

export function AllVideosPage() {
  const [data, loading, error] = useFetch<string[]>('/videos', 'GET');

  return (
    <div className={styles.container}>
      <h3>Wszystkie pliki video:</h3>
      {loading && <p>Loading...</p>}
      {!loading && error && <p>Error...</p>}
      {!loading && data &&
        <div className={styles.content}>
          {
            data?.map((video) => {
              return <VideoCard key={video} video={video} />
            })
          }
        </div>
      }
    </div>
  )
}

export default AllVideosPage;
