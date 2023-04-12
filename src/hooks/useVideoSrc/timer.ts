export class Timer {
	private startTime?: number;
	private endTime?: number;
	private videoDuration?: number;

	start() {
		this.startTime = Date.now();
	}

	end() {
		this.endTime = Date.now();
	}

	setVideoDuration(videoDuration: number) {
		this.videoDuration = videoDuration;
	}

	get timeElapsed() {
		return (this.endTime! - this.startTime!) / 1000;
	}

	get lagRatio() {
		return (this.timeElapsed - this.videoDuration!) / this.videoDuration!;
	}
}