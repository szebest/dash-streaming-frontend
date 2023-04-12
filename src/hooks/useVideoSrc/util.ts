// Hosts general functions that don't necessarily have ties to a bigger class or entity

export type BytesReadParams = {
	offset: number;
	size: number;
}

export const calculateByteRangeEnd = ({ offset, size }: BytesReadParams) => {
	return size + offset - 1;
}

export const createByteRangeString = (numBytesWrittenInSegment: number, { offset, size }: BytesReadParams) => {
	return `${numBytesWrittenInSegment + offset}-${calculateByteRangeEnd({ offset, size })}`;
}

export class RetryTimer {
	private limit: number;
	public time: number;

	constructor() {
		this.time = 250;
		this.limit = 10000;
	}

	increase() {
		this.time = Math.min(2 * this.time, this.limit);
	}

	reset() {
		this.time = 250;
	}
}