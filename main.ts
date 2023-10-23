import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, RequestUrlParam, request } from 'obsidian';

interface WikipediaDataSettings {
	template: string;
    thumbnailTemplate: string;
	shouldBoldSearchTerm: boolean;
	language: string;
}

interface WikiData {
	type: string;
	title: string;
	description: string;
	summary: string;
	url: string;
	thumbnailUrl: string;
}

interface WikiSearch {
	id: number;
	key: string;
	title: string;
	description: string;
	thumbnailUrl: string;
}

const wikimediaApiUrlBase = "wikipedia.org/api/rest_v1/";
const mediaWikiApiUrlBase = "wikipedia.org/w/rest.php/v1/";

const DEFAULT_SETTINGS: WikipediaDataSettings = {
    template: `| {{thumbnailTemplate}} | {{summary}} |\n|-|-|\n`,
    thumbnailTemplate: `![thumbnail \\| 100]({{thumbnailUrl}})`,
	shouldBoldSearchTerm: true,
	language: "en",
}

export default class WikipediaData extends Plugin {
	settings: WikipediaDataSettings;

	getLanguage(): string {
		return this.settings.language ? this.settings.language : "en";
	}

	getUrl(title: string): string {
        return `https://${this.getLanguage()}.wikipedia.org/wiki/${encodeURI(title)}`;
	}
	
	getWikimediaApiUrl(): string {
        return `https://${this.getLanguage()}.` + wikimediaApiUrlBase + `page/summary/`;
	}

	getMediaWikiApiUrl(): string {
		return `https://${this.getLanguage()}.` + mediaWikiApiUrlBase + `search/title?q=`
	}

	handleNotFound(searchTerm: string) {
		new Notice(`${searchTerm} not found on Wikipedia.`);
	}

	handleDisambiguation(searchTerm: string, disambiguationUrl: string) {
		// TODO: Use Obsidian DOM API instead of innerHTML?
		let linkElement = document.createElement("a");
		linkElement.innerHTML = `${searchTerm} Disambiguation Page\n`;
		linkElement.href = `${disambiguationUrl}`;
		let fragment = new DocumentFragment;
		fragment.appendChild(linkElement);
		new Notice(`${searchTerm} returned a disambiguation page.`, 10000)
		new Notice(fragment, 10000);
	}

    formatWikiDataSummary(wikiData: WikiData, searchTerm: string): string {
		const regex = /\n/g;
		let formattedSummary: string = wikiData.summary.trim().replace(regex, " ");
		if (this.settings.shouldBoldSearchTerm) {
			const pattern = new RegExp(searchTerm, "i");
			formattedSummary = formattedSummary.replace(pattern, `**${searchTerm}**`);
		}
		return formattedSummary;
	}

	formatTemplate(wikiSearch: WikiSearch, wikiData: WikiData, searchTerm: string): string {
		const formattedWikiDataSummary = this.formatWikiDataSummary(wikiData, searchTerm);
		const template = this.settings.template;
		let thumbnailTemplate = "";
		if (wikiData.thumbnailUrl === "" ) {
			thumbnailTemplate = "replaceThumbnail";
		}
		else {
			thumbnailTemplate = this.settings.thumbnailTemplate;
		}
		const formattedTemplate = template
			.replace("{{summary}}", formattedWikiDataSummary)
			.replace("{{title}}", wikiData.title)
			.replace("{{url}}", wikiData.url)
			.replace("{{thumbnailTemplate}}", thumbnailTemplate)
			.replace("{{thumbnailUrl}}", wikiData.thumbnailUrl)
			.replace("{{id}}", wikiSearch.id.toString())
			.replace("{{key}}", wikiSearch.key)
			.replace("replaceThumbnail", "");
		return formattedTemplate;
	}

	parseDataResponse(json: any): WikiData | undefined {
		const wikiData: WikiData = {
			type: json.type,
			title: json.title,
			summary: json.extract,
			description: json.description,
			url: json.content_urls.desktop.page,
			thumbnailUrl: (json.hasOwnProperty("thumbnail")) ? json.thumbnail.source : ""
        };
        return wikiData;
	}

	parseSearchResponse(json: any): WikiSearch | undefined {
		const wikiSearch: WikiSearch = {
			id: json.pages[0].id,
			key: json.pages[0].key,
			title: json.pages[0].title,
			description: json.pages[0].description,
			thumbnailUrl: json.pages[0].thumbnailUrl
        };
        return wikiSearch;
	}

	async getWikiData(title: string): Promise<WikiData | undefined> {
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
		const wikiData = this.parseDataResponse(resp);
		return wikiData;
	}

	async getWikiSearch(searchTerm: string): Promise<WikiSearch | undefined> {
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
		const wikiSearch = this.parseSearchResponse(resp);
		return wikiSearch;
	}

	async pasteIntoEditor(editor: Editor, searchTerm: string) {
		// TODO: Fix typing here that needs as WikiSearch and as WikiData
		let wikiSearch: WikiSearch = await this.getWikiSearch(searchTerm) as WikiSearch;
        let wikiData: WikiData = await this.getWikiData(wikiSearch.title) as WikiData;
		if (!wikiData) {
			this.handleNotFound(searchTerm);
			return;
		}
		else if (wikiData.type.contains("missingtitle")) {
			this.handleNotFound(searchTerm);
		}
		else if (wikiData.type == "disambiguation") {
			this.handleDisambiguation(searchTerm, wikiData.url);
			return;
		}
		else {
			editor.replaceSelection(this.formatTemplate(wikiSearch, wikiData, searchTerm));
		}
	}

	async getWikipediaDataForActiveFile(editor: Editor) {
		const activeFile = await this.app.workspace.getActiveFile();
		if (activeFile) {
			const searchTerm = activeFile.basename;
			if (searchTerm) {
				await this.pasteIntoEditor(editor, searchTerm);
			}
		}
	}

	async onload() {
		console.log("Loading Wikipedia Data Plugin");
		await this.loadSettings();
		
        this.addCommand({
            id: "get-data-for-active-note-title",
            name: "Get Wikipedia Data for Active Note Title",
            editorCallback: (editor: Editor) => this.getWikipediaDataForActiveFile(editor),
        });
		
		this.addSettingTab(new WikipediaDataSettingTab(this.app, this));
	}

	async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
    
	async saveSettings() {
        await this.saveData(this.settings);
	}

    onunload() {
    }

}

class WikipediaDataSettingTab extends PluginSettingTab {
	plugin: WikipediaData;

	constructor(app: App, plugin: WikipediaData) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Wikipedia language prefix")
			.setDesc(`Choose Wikipedia language prefix to use for API (ex. en for English)`)
			.addText((textField) => {
				textField
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Wikipedia template")
			// TODO: I should probably not bother with nesting templates and just have one template that handles the thumbnail part.
			.setDesc(
				`Set markdown template for data from the Wikipedia API to be inserted.\n
				Available template variables are {{title}}, {{url}} (of the Wikipedia page), {{summary}} (Short textual explanation of the article in 1 or a few sentences), {{description}} (shorter, simpler description of the article), {{id}}, {{key}}, and {{thumbnailTemplate}} (inserts the Wikipedia Thumbnail Template defined below).`
			)
			.addTextArea((textarea) =>
				textarea
				.setValue(this.plugin.settings.template)
				.onChange(async (value) => {
					this.plugin.settings.template = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Wikipedia thumbnail template")
			.setDesc(
				`Set markdown template for what will be inserted in the 'thumbnailTemplate' variable above. Use the {{thumbnailUrl}} here.`
			)
			.addTextArea((textarea) =>
				textarea
				.setValue(this.plugin.settings.thumbnailTemplate)
				.onChange(async (value) => {
					this.plugin.settings.thumbnailTemplate = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Bold search term?")
			.setDesc(
				"If set to true, the first instance of the search term will be **bolded**"
			)
			.addToggle((toggle) =>
				toggle
				.setValue(this.plugin.settings.shouldBoldSearchTerm)
				.onChange(async (value) => {
					this.plugin.settings.shouldBoldSearchTerm = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
