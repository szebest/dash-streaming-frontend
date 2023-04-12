import { API_BASE_URL } from "../../config";

export class ManifestParser {
	private video_id: string;
	private base_video_url: string;

	constructor(video_id: string) {
		this.video_id = video_id;
		this.base_video_url = "/watch";
	}

	adaptationSetToJSON(adaptationSet: any) {
		const adaptSetObj: any = {};

		adaptSetObj.mimeType = adaptationSet.getAttribute("mimeType");
		adaptSetObj.codecs = adaptationSet.getAttribute("codecs");

		adaptSetObj.representations = [];

		const representations = adaptationSet.children;

		const timestampPromises = [];

		for (let i = 0; i < representations.length; i++) {
			const representationObj: any = {};
			adaptSetObj.representations[i] = representationObj;
			representationObj.url = `${this.base_video_url}/${this.video_id}/${this.getUrl(representations[i])}`;

			const timestampPromise = new Promise((res: any, rej) => {
				fetch(`${API_BASE_URL}${this.base_video_url}/${this.video_id}/timestamps/${this.getUrl(representations[i])}.json`)
				.then((response) => response.json())
				.then((timestamp_info) => {
					representationObj["timestamp_info"] = timestamp_info;
					res();
				});
			});
			
			timestampPromises.push(timestampPromise);
		}

		return Promise.all(timestampPromises)
		.then(() => adaptSetObj);
	}

	getUrl(representation: any) {
		const { children } = representation;
		for (let i = 0; children.length; i++) {
			if (children[i].tagName == "BaseURL") {
				return children[i].textContent;
			}
		}
	}

	getJSONManifest() {
		return new Promise((resolve, reject) => {
			fetch(`${API_BASE_URL}${this.base_video_url}/${this.video_id}/manifest.mpd`)
			.then((response) => response.text())
			.then((manifest_str) => (new window.DOMParser()).parseFromString(manifest_str, "text/xml"))
			.then((manifest) => {
				const first_period = manifest.getElementsByTagName("Period")[0];
				const adaptationSets = first_period.children;

				const adaptationConversionPromises = [];

				const adaptSetsObj: any = {};
				for (let i = 0; i < adaptationSets.length; i++) {
					const adaptationPromise = new Promise((resAdapt: any, rejAdapt) => {
						this.adaptationSetToJSON(adaptationSets[i])
						.then((adaptation_json) => {
							adaptSetsObj[adaptationSets[i].getAttribute("mimeType")!] = adaptation_json;
							resAdapt();
						});
					})
					adaptationConversionPromises.push(adaptationPromise);
				}

				Promise.all(adaptationConversionPromises)
				.then(() => resolve(adaptSetsObj));
			});
		});
	}
};