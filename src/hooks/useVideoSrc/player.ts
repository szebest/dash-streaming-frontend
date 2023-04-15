import { Queue } from './queue';
import { RetryTimer, calculateByteRangeEnd, createByteRangeString } from './util';
import { ManifestParser } from './manifest-parser';
import { API_BASE_URL } from '../../config';

export class Player {
  private mse: MediaSource;
  private video_id: string;
  private audioQueue: Queue;
  private videoQueue: Queue;
  private videoMediaIndex: number;
  private videoQualityIndex: number;
  private retryTimer: RetryTimer;
  private videoSourceBuffer?: SourceBuffer;
  private audioSourceBuffer?: SourceBuffer;
  private videoSets: any;
  private audioSets: any;

  private FETCH_TIME = 5;

  private controller: AbortController;
  private signal: AbortSignal;
  
  private videoElement: HTMLVideoElement;

  private fetchIntervalId: NodeJS.Timeout | null;
  private fetching: boolean;
  private reading: boolean;

  private initialized = false;
  private automaticQuality: boolean;
  private tempQualityId: number;

  constructor(video_id: string, paused: boolean, videoElement: HTMLVideoElement) {
    this.fetching = false;
    this.reading = false;
    this.fetchIntervalId = null;
    this.mse = new window.MediaSource;
    videoElement.src = this.objectUrl;

    this.video_id = video_id;
    this.videoElement = videoElement;
    this.audioQueue = new Queue();
    this.videoQueue = new Queue();

    this.videoMediaIndex = 0;
    this.videoQualityIndex = 0;
    this.tempQualityId = 0;
    this.automaticQuality = true;

    this.controller = new AbortController();
    this.signal = this.controller.signal;

    this.retryTimer = new RetryTimer();

    this.videoElement.addEventListener("timeupdate", (e) => this.onTimeChange(e));

    this.videoElement.addEventListener("play", () => this.checkPlayerStatus());
    this.videoElement.addEventListener("seeking", (e) => this.onTimeChange(e));

    this.mse.addEventListener("sourceopen", () => {
      if (!paused && !this.initialized) {
        this.init.bind(this)();
      }
    });
  }
  
  changePlayingState(play: boolean): void {
    if (play) {
      this.videoElement.play().catch(() => {});
    }
    else {
      this.videoElement.pause();
    }
  }

  get objectUrl() {
    return URL.createObjectURL(this.mse);
  }

  get videoResolutions(): {resolution: string, qualityId: number}[] {
    return this.videoSets?.representations?.map((representation: any, index: number) => {
      const resolution: string = representation.url.split('/').at(-1).split('_')[0];

      return {
        resolution,
        qualityId: index
      };
    });
  }

  get videoResolutionId(): number {
    if (this.automaticQuality) return -1;

    return this.videoQualityIndex;
  }

  getBufferedFromCurrentTime(currentTime: number): number {
    const buffered = this.videoSourceBuffer?.buffered;

    if (!buffered) return 0;

    for (let i = 0; i < buffered.length; i++) {
      if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
        return buffered.end(i);
      }
    }

    return 0;
  }

  onResolutionChange(qualityId: number): void {
    if (qualityId === this.videoQualityIndex) return;

    if (qualityId < 0) {
      this.automaticQuality = true;
      this.videoQualityIndex = this.tempQualityId;
    }
    else {
      this.tempQualityId = this.videoQualityIndex;

      this.automaticQuality = false;
      this.videoQualityIndex = qualityId;
    }

    const intervalId = setInterval(() => {
      this.videoSourceBuffer!.abort();
      if (this.fetching && this.mse.readyState === 'open') return;

      this.videoQueue.reinitialize();

      this.controller.abort();

      this.videoSourceBuffer!.remove(0, this.videoElement.duration);

      this.fetchVideoNextTimeSlice();

      clearInterval(intervalId);
    }, 10)
  }

  onTimeChange(e: Event): void {
    this.checkPlayerStatus();

    if (this.fetchIntervalId) {
      clearInterval(this.fetchIntervalId);
      this.fetchIntervalId = null;
    }

    if (this.reading || !this.videoSourceBuffer) {
      this.fetchIntervalId = setInterval(() => this.onTimeChange(e), 10);

      return;
    }

    const target = e.target! as HTMLVideoElement;
    const currentTime = target.currentTime;

    this.checkAndDoFetchRequest(currentTime, true);
  }

  checkPlayerStatus() {
    if (Math.trunc(this.videoElement.currentTime) >= Math.trunc(this.videoElement.duration) && this.videoElement.readyState == 2) {
      this.videoElement.pause();
    }
  }

  checkAndDoFetchRequest(time: number, next: boolean): void {
    const buffered = this.videoSourceBuffer!.buffered;

    let hasToDoNextFetch = true;
    let savedIndex = 0;
    let found = false;

    const videoRepresentation = this.videoSets["representations"][this.videoQualityIndex];
    const { timestamp_info } = videoRepresentation;

    for (let i = 0; i < buffered.length; i++) {
      if (time >= buffered.start(i) && time <= buffered.end(i)) {
        const index = timestamp_info.media.findIndex((media: any) => media.timecode >= buffered.end(i)) - 1;
        savedIndex = index >= 0 ? index : timestamp_info.media.length - 1;

        if (buffered.end(i) - this.FETCH_TIME * this.videoElement.playbackRate >= time || buffered.end(i) === this.videoElement.duration) {
          hasToDoNextFetch = false;
        }

        found = true;
      }
    }

    if (!found && next) {
      const index = timestamp_info.media.findIndex((media: any) => media.timecode >= time) - 1;
      savedIndex = index >= 0 ? index : timestamp_info.media.length - 1;
    }

    if (hasToDoNextFetch) {
      this.reading = true;

      const intervalId = setInterval(() => {
        this.videoSourceBuffer!.abort();
        if (this.fetching && this.mse.readyState === 'open') return;

        this.videoQueue.reinitialize();
        this.videoMediaIndex = savedIndex + (next && found ? 1 : 0);

        this.controller.abort();

        this.fetchVideoNextTimeSlice();

        clearInterval(intervalId);
      }, 10)
    }
  }

  appendBufFromQueue(srcBuffer: any, queue: any) {
    queue.pipingToSourceBuffer = true;

    return !queue.empty() && (srcBuffer.appendBuffer(queue.popFirst()) || true);
  }

  readData(reader: any, bufferQueue: any, sourceBuffer: any, callback = (err?: any) => { }) {
    reader.read()
      .then((buffer: any) => {
        if (buffer.value) {
          bufferQueue.push(buffer.value);
          if (!bufferQueue.pipingToSourceBuffer) {
            this.appendBufFromQueue(sourceBuffer, bufferQueue);
          }
        }

        if (!buffer.done) {
          this.readData(reader, bufferQueue, sourceBuffer, callback);
        } else {
          callback();
        }
      })
      .catch((err: any) => callback(err));
  }

  checkInit(): void {
    if (!this.initialized) {
      this.init.bind(this)();
    }
  }

  init() {
    this.initialized = true;

    (new ManifestParser(this.video_id)).getJSONManifest()
      .then((adaptSetsObj: any) => {  
        this.videoSets = adaptSetsObj["video/webm"];
        this.audioSets = adaptSetsObj["audio/webm"];

        this.videoQualityIndex = this.videoSets.representations.length - 1;

        this.videoSourceBuffer = this.mse.addSourceBuffer(`video/webm; codecs="${this.videoSets["codecs"]}"`);
        this.audioSourceBuffer = this.mse.addSourceBuffer(`audio/webm; codecs="${this.audioSets["codecs"]}"`);

        this.videoSourceBuffer.addEventListener("updateend", () => {
          if (!this.appendBufFromQueue(this.videoSourceBuffer, this.videoQueue)) this.videoQueue.pipingToSourceBuffer = false;
        });

        this.audioSourceBuffer.addEventListener("updateend", () => {
          if (!this.appendBufFromQueue(this.audioSourceBuffer, this.audioQueue)) this.audioQueue.pipingToSourceBuffer = false;
        });

        this.fetchAudio();

        this.checkAndDoFetchRequest(0, false);
      });
  }

  fetchVideoNextTimeSlice() {
    const videoRepresentation = this.videoSets["representations"][this.videoQualityIndex];
    const { timestamp_info } = videoRepresentation;
    
    this.controller = new AbortController();
    this.signal = this.controller.signal;

    this.fetching = true;
    this.reading = true;

    if (this.videoMediaIndex < timestamp_info["media"].length) {
      this._throttleQualityOnFeedback((finish: any) => {
        fetch(`${API_BASE_URL}${videoRepresentation["url"]}`, {
          headers: {
            range: this.videoMediaIndex === 0 ? `bytes=${this.videoQueue.numBytesWrittenInSegment}-${calculateByteRangeEnd(timestamp_info["media"][this.videoMediaIndex])}` : `bytes=${createByteRangeString(this.videoQueue.numBytesWrittenInSegment, timestamp_info["media"][this.videoMediaIndex])}`
          },
          signal: this.signal
        })
          .then((response: any) => {
            this.fetching = false;
            this.retryTimer.reset();
            const reader = response.body.getReader();
            const handleReadData = this.handleReadDataFinish(finish);

            this.readData(reader, this.videoQueue, this.videoSourceBuffer, handleReadData);
          })
          .catch((err) => {
            this.retryRequest(this.fetchVideoNextTimeSlice.bind(this));
          });
      });
    }
  }

  fetchAudio() {
    fetch(`${API_BASE_URL}${this.audioSets["representations"][0]["url"]}`, {
      headers: {
        range: `bytes=${this.audioQueue.numBytesWrittenInSegment}-`
      }
    })
      .then((response: any) => {
        this.retryTimer.reset();
        var reader = response.body.getReader();
        this.readData(reader, this.audioQueue, this.audioSourceBuffer, (err: any) => {
          if (err) return this.fetchAudio();
        });
      })
      .catch((err) => {
        this.retryRequest(this.fetchAudio.bind(this));
      });
  }

  handleReadDataFinish(finishForThrottle: any) {
    return (err: any) => {
      this.videoQueue.resetByteCounter();
      this.reading = false;

      if (err) {
        return;
      }

      finishForThrottle();
    }
  }

  retryRequest(requestCall: any) {
    setTimeout(requestCall, this.retryTimer.time);
    this.retryTimer.increase();
  }

  _throttleQualityOnFeedback(fetchCall: any) {
    let bufferDuration = this._calcDuration();
    let startTime = Date.now();
    fetchCall(() => {
      if (!this.automaticQuality) return;

      let endTime = Date.now();

      let fetchDuration = (endTime - startTime) * this.videoElement.playbackRate;
      let maxQualityIndex = this.videoSets["representations"].length - 1;
      let lowestQualityIndex = 0;

      if (fetchDuration < 0.5 * bufferDuration && this.videoQualityIndex !== maxQualityIndex) {
        this.videoQualityIndex++;
      }

      if (fetchDuration > 0.75 * bufferDuration && this.videoQualityIndex !== lowestQualityIndex) {
        this.videoQualityIndex--;
      }
    });
  }

  _calcDuration() {
    const videoRepresentation = this.videoSets["representations"][this.videoQualityIndex];
    const { timestamp_info } = videoRepresentation;
    const startTimeCode = timestamp_info["media"][this.videoMediaIndex]["timecode"];

    if (this.videoMediaIndex === timestamp_info["media"].length - 1) {
      return timestamp_info["duration"] - (1000 * startTimeCode);
    } else {
      const nextTimeCode = timestamp_info["media"][this.videoMediaIndex + 1]["timecode"];
      return 1000 * (nextTimeCode - startTimeCode);
    }
  }
};