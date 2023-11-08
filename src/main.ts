import { Editor, Notice, Plugin, RequestUrlParam, request, addIcon } from "obsidian";
import { WikipediaDataSettings, DEFAULT_SETTINGS, WikipediaDataSettingTab } from "./settings";
import { wikipediaIcon } from "./wikipediaIcon";

interface WikimediaApiResponse {
	type: string;
	title: string;
	description: string;
	summary: string;
	url: string;
	thumbnailUrl: string;
}

interface MediaWikiApiResponse {
	resultCount: number;
	id: number;
	key: string;
	title: string;
	description: string;
	thumbnailUrl: string;
}

interface MediaWikiActionApiResponse {
	fullText: string;
}

const wikimediaApiUrlBase = "wikipedia.org/api/rest_v1/";
const mediaWikiApiUrlBase = "wikipedia.org/w/rest.php/v1/";
const mediaWikiActionApiUrlBase = "wikipedia.org/w/api.php";

export default class WikipediaData extends Plugin {
	settings: WikipediaDataSettings;

	async onload() {
		console.log("Loading Wikipedia Data Plugin");
		await this.loadSettings();

		this.addCommand({
			id: "apply-template-one-for-active-note",
			name: "Apply Template #1 for Active Note Title",
			editorCallback: (editor: Editor) => this.applyTemplateForActiveNote(editor, 1),
		});

		this.addCommand({
			id: "apply-template-two-for-active-note",
			name: "Apply Template #2 for Active Note Title",
			editorCallback: (editor: Editor) => this.applyTemplateForActiveNote(editor, 2),
		});

		this.addCommand({
			id: "apply-template-three-for-active-note",
			name: "Apply Template #3 for Active Note Title",
			editorCallback: (editor: Editor) => this.applyTemplateForActiveNote(editor, 3),
		});

		addIcon("wikipedia", wikipediaIcon);

		this.addRibbonIcon(
			'wikipedia', 'Wikipedia Data: Apply Template #1 for Active Note Title', (evt: MouseEvent) => {
			const editor = this.app.workspace.activeEditor?.editor;
			this.applyTemplateForActiveNote(editor as Editor, 1)
		});

		this.addRibbonIcon(
			'heading-2', 'Wikipedia Data: Apply Template #2 for Active Note Title', (evt: MouseEvent) => {
			const editor = this.app.workspace.activeEditor?.editor;
			this.applyTemplateForActiveNote(editor as Editor, 2)
		});

		this.addRibbonIcon(
			'heading-3', 'Wikipedia Data: Apply Template #3 for Active Note Title', (evt: MouseEvent) => {
			const editor = this.app.workspace.activeEditor?.editor;
			this.applyTemplateForActiveNote(editor as Editor, 3)
		});


		this.addSettingTab(new WikipediaDataSettingTab(this.app, this));
	}
	
	onunload() {}

	getLanguage(): string {
		return this.settings.language ? this.settings.language : "en";
	}

	getWikimediaApiUrl(): string {
		return `https://${this.getLanguage()}.` + wikimediaApiUrlBase + `page/summary/`;
	}

	getMediaWikiApiUrl(): string {
		return `https://${this.getLanguage()}.` + mediaWikiApiUrlBase + `search/title?q=`;
	}

	getMediaWikiActionApiUrl(): string {
		return (
			`https://${this.getLanguage()}.` +
			mediaWikiActionApiUrlBase +
			`?format=json&action=query&prop=extracts&explaintext=1&redirects&origin=*&pageids=`
		);
	}

	handleNotFound(searchTerm: string) {
		new Notice(`${searchTerm} not found on Wikipedia.`);
	}

	handleDisambiguation(searchTerm: string, disambiguationUrl: string) {
		// TODO: Use Obsidian DOM API instead of innerHTML?
		// Create DOM element to put a URL in the Obisidan Notice for the user to be able to open that Wikipedia disambiguation page.
		const linkElement = document.createElement("a");
		linkElement.innerHTML = `${searchTerm} Disambiguation Page\n`;
		linkElement.href = `${disambiguationUrl}`;
		const fragment = new DocumentFragment();
		fragment.appendChild(linkElement);
		new Notice(`${searchTerm} returned a disambiguation page.`, 10000);
		new Notice(fragment, 10000);
	}

	// Remove the occassional \n chars to make WikimediaData.summary always be one line.
	formatWikimediaApiSummary(wikimediaApiResponse: WikimediaApiResponse, searchTerm: string): string {
		const regex = /\n/g;
		let formattedSummary: string = wikimediaApiResponse.summary.trim().replace(regex, " ");
		if (this.settings.shouldBoldSearchTerm) {
			const pattern = new RegExp(searchTerm, "i");
			formattedSummary = formattedSummary.replace(pattern, `**${searchTerm}**`);
		}
		return formattedSummary;
	}

	// Split WikiText.fullText into paragraphs, extract just the intro section, and apply paragraphTemplate to each paragraph.
	formatMediaWikiActionApiIntroText(
		mediaWikiActionApiResponse: MediaWikiActionApiResponse,
		searchTerm: string
	): string {
		const text = mediaWikiActionApiResponse.fullText;
		let formattedText = "";
		if (this.settings.useParagraphTemplate) {
			const split = text.split("==")[0].trim().split("\n");
			formattedText = split
				.map((paragraph) => this.settings.paragraphTemplate.replace("{{paragraphText}}", paragraph))
				.join("")
				.trim();
		} else {
			formattedText = text.split("==")[0].trim();
		}
		if (this.settings.shouldBoldSearchTerm) {
			const pattern = new RegExp(searchTerm, "i");
			formattedText = formattedText.replace(pattern, `**${searchTerm}**`);
		}
		// Handle paragraphTemplate edge case where there is an unwanted trailing '>'
		if (formattedText.charAt(formattedText.length - 1) === ">") {
			formattedText = formattedText.slice(0, formattedText.length - 2);
		}
		return formattedText;
	}

	// Build final template to be inserted into note and apply template variables.
	formatTemplate(
		mediaWikiApiResponse: MediaWikiApiResponse,
		wikimediaApiResponse: WikimediaApiResponse,
		mediaWikiActionApiResponse: MediaWikiActionApiResponse,
		searchTerm: string,
		wikipediaTemplateNum: number
	): string {
		const formattedSummary = this.formatWikimediaApiSummary(wikimediaApiResponse, searchTerm);
		const formattedIntroText = this.formatMediaWikiActionApiIntroText(
			mediaWikiActionApiResponse,
			searchTerm
		);
		const template = this.settings.wikipediaTemplates[wikipediaTemplateNum - 1].value;
		let thumbnailTemplate = "";
		// If no thumbnailUrl, don't insert thumbnailTemplate
		if (wikimediaApiResponse.thumbnailUrl !== "") {
			thumbnailTemplate = this.settings.thumbnailTemplate;
		}
		const formattedTemplate = template
			.replace("{{title}}", wikimediaApiResponse.title)
			.replace("{{url}}", wikimediaApiResponse.url)
			.replace("{{thumbnailTemplate}}", thumbnailTemplate)
			.replace("{{thumbnailUrl}}", wikimediaApiResponse.thumbnailUrl)
			.replace("{{description}}", wikimediaApiResponse.description)
			.replace("{{summary}}", formattedSummary)
			.replace("{{introText}}", formattedIntroText)
			.replace("{{id}}", mediaWikiApiResponse.id.toString())
			.replace("{{key}}", mediaWikiApiResponse.key);
		return formattedTemplate;
	}

	parseWikimediaApiResponse(json: any): WikimediaApiResponse | undefined {
		const parsedWikimediaApiResponse: WikimediaApiResponse = {
			type: json.type,
			title: json.title,
			summary: json.extract,
			description: json.description,
			url: json.content_urls.desktop.page,
			thumbnailUrl: json.hasOwnProperty("thumbnail") ? json.thumbnail.source : "",
		};
		return parsedWikimediaApiResponse;
	}

	parseMediaWikiApiResponse(json: any): MediaWikiApiResponse | undefined {
		const parsedMediaWikiApiResponse: MediaWikiApiResponse = {
			resultCount: json.pages.length,
			id: json.pages[0].id,
			key: json.pages[0].key,
			title: json.pages[0].title,
			description: json.pages[0].description,
			thumbnailUrl: json.pages[0].thumbnailUrl,
		};
		return parsedMediaWikiApiResponse;
	}

	parseMediaWikiActionApiResponse(json: any, id: number): MediaWikiActionApiResponse | undefined {
		const parsedMediaWikiActionApiResponse: MediaWikiActionApiResponse = {
			fullText: json.query.pages[id.toString()].extract,
		};
		return parsedMediaWikiActionApiResponse;
	}

	async getWikimediaApiResponse(title: string): Promise<WikimediaApiResponse | undefined> {
		const url = this.getWikimediaApiUrl() + encodeURIComponent(title);
		const requestParam: RequestUrlParam = {
			url: url,
		};
		const resp = await request(requestParam)
			.then((r) => JSON.parse(r))
			.catch(
				() =>
					new Notice(
						"Failed to reach Wikimedia API for article data. Check your search term, internet connection, or language prefix."
					)
			);
		const wikimediaApiResponse = this.parseWikimediaApiResponse(resp);
		return wikimediaApiResponse;
	}

	async getMediaWikiApiResponse(searchTerm: string): Promise<MediaWikiApiResponse | undefined> {
		const url = this.getMediaWikiApiUrl() + encodeURIComponent(searchTerm) + "&limit=5";
		const requestParam: RequestUrlParam = {
			url: url,
		};
		const resp = await request(requestParam)
			.then((r) => JSON.parse(r))
			.catch(
				() =>
					new Notice(
						"Failed to reach MediaWiki API for article title. Check your search term, internet connection, or language prefix."
					)
			);
		const mediaWikiApiResponse = this.parseMediaWikiApiResponse(resp);
		return mediaWikiApiResponse;
	}

	async getMediaWikiActionApiResponse(id: number): Promise<MediaWikiActionApiResponse | undefined> {
		const url = this.getMediaWikiActionApiUrl() + encodeURIComponent(id.toString());
		const requestParam: RequestUrlParam = {
			url: url,
		};
		const resp = await request(requestParam)
			.then((r) => JSON.parse(r))
			.catch(
				() =>
					new Notice(
						"Failed to reach MediaWiki Action API for article text. Check your search term, internet connection, or language prefix."
					)
			);
		const mediaWikiActionApiResponse = this.parseMediaWikiActionApiResponse(resp, id);
		return mediaWikiActionApiResponse;
	}

	async pasteIntoEditor(editor: Editor, searchTerm: string, wikipediaTemplateNum: number) {
		// TODO: Fix typing here that needs as WikiSearch and as WikimediaData?
		const mediaWikiApiResponse: MediaWikiApiResponse = (await this.getMediaWikiApiResponse(
			searchTerm
		)) as MediaWikiApiResponse;
		const wikimediaApiResponse: WikimediaApiResponse = (await this.getWikimediaApiResponse(
			mediaWikiApiResponse.title
		)) as WikimediaApiResponse;
		const mediaWikiActionApiResponse: MediaWikiActionApiResponse =
			(await this.getMediaWikiActionApiResponse(mediaWikiApiResponse.id)) as MediaWikiActionApiResponse;
		if (!mediaWikiApiResponse) {
			this.handleNotFound(searchTerm);
			return;
		} else if (
			wikimediaApiResponse.type.contains("missingtitle") ||
			mediaWikiApiResponse.resultCount == 0
		) {
			this.handleNotFound(searchTerm);
			return;
		} else if (
			wikimediaApiResponse.type == "disambiguation" ||
			mediaWikiApiResponse.description == "Topics referred to by the same term"
		) {
			this.handleDisambiguation(searchTerm, wikimediaApiResponse.url);
			return;
		} else {
			editor.replaceSelection(
				this.formatTemplate(
					mediaWikiApiResponse,
					wikimediaApiResponse,
					mediaWikiActionApiResponse,
					searchTerm,
					wikipediaTemplateNum
				)
			);
		}
	}

	async applyTemplateForActiveNote(editor: Editor, wikipediaTemplateNum: number) {
		const activeFile = await this.app.workspace.getActiveFile();
		if (activeFile) {
			const searchTerm = activeFile.basename;
			if (searchTerm) {
				await this.pasteIntoEditor(editor, searchTerm, wikipediaTemplateNum);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}
