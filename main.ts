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
	text: string;
	url: string;
	thumbnailUrl: string;
}

const extractApiUrl = "wikipedia.org/api/rest_v1/page/summary/";

const DEFAULT_SETTINGS: WikipediaDataSettings = {
    template: `| {{thumbnailTemplate}} | {{text}} |\n|-|-|\n`,
    thumbnailTemplate: `![thumbnail \| 100]({{thumbnailUrl}})`,
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
	
	getApiUrl(): string {
        return `https://${this.getLanguage()}.` + extractApiUrl;
	}

	handleNotFound(searchTerm: string) {
		new Notice(`${searchTerm} not found on Wikipedia.`);
	}

	handleDisambiguation(searchTerm: string, disambiguationUrl: string) {
		let linkElement = document.createElement("a");
		linkElement.innerHTML = `${searchTerm} Disambiguation Page\n`;
		linkElement.href = `${disambiguationUrl}`;
		let fragment = new DocumentFragment;
		fragment.appendChild(linkElement);
		new Notice(`${searchTerm} returned a disambiguation page.`, 10000)
		new Notice(fragment, 10000);
	}

    formatWikiDataText(wikiData: WikiData, searchTerm: string): string {
		let formattedText: string = wikiData.text;
		if (this.settings.shouldBoldSearchTerm) {
			const pattern = new RegExp(searchTerm, "i");
			formattedText = formattedText.replace(pattern, `**${searchTerm}**`);
		}
		return formattedText;
	}
		
	formatExtractInsert(wikiData: WikiData, searchTerm: string): string {
		const formattedText = this.formatWikiDataText(wikiData, searchTerm);
		const template = this.settings.template;
		let thumbnailTemplate = "";
		if (wikiData.thumbnailUrl === "" ) {
			thumbnailTemplate = "replaceThumbnail";
		}
		else {
			thumbnailTemplate = this.settings.thumbnailTemplate;
		}
		const formattedTemplate = template
			.replace("{{text}}", formattedText)
			.replace("{{title}}", wikiData.title)
			.replace("{{url}}", wikiData.url)
			.replace("{{thumbnailTemplate}}", thumbnailTemplate)
			.replace("{{thumbnailUrl}}", wikiData.thumbnailUrl)
			.replace("replaceThumbnail", "");
		return formattedTemplate;
	}

	parseResponse(json: any): WikiData | undefined {
		const wikiData: WikiData = {
			type: json.type,
			title: json.title,
			text: json.extract,
			description: json.description,
			url: json.content_urls.desktop.page,
			thumbnailUrl: (json.hasOwnProperty("thumbnail")) ? json.thumbnail.source : ""
        };
        return wikiData;
	}

	async getWikiData(title: string): Promise<WikiData | undefined> {
		const url = this.getApiUrl() + encodeURIComponent(title);
		const requestParam: RequestUrlParam = {
			url: url,
		};
		const resp = await request(requestParam)
			.then((r) => JSON.parse(r))
			.catch(
				() =>
					new Notice(
					"Failed to get Wikipedia. Check your internet connection or language prefix."
					)
			);
		const wikiData = this.parseResponse(resp);
		return wikiData;
	}

	async pasteIntoEditor(editor: Editor, searchTerm: string) {
        let apiResponse: WikiData = await this.getWikiData(searchTerm) as WikiData;
		console.log("API Response");
		console.log(apiResponse);
		if (!apiResponse) {
			this.handleNotFound(searchTerm);
			return;
		}
		else if (apiResponse.type.contains("missingtitle")) {
			this.handleNotFound(searchTerm);
		}
		else if (apiResponse.type == "disambiguation") {
			this.handleDisambiguation(searchTerm, apiResponse.url);
			return;
		}
		else {
			editor.replaceSelection(this.formatExtractInsert(apiResponse, searchTerm));
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
			.setName("Wikipedia Language Prefix")
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
			.setName("Wikipedia Data Template")
			.setDesc(
				`Set markdown template for data from the Wikipedia API to be inserted.\n
				Available template variables are {{text}} (Short explanation of 1 or 2 sentences), {{title}}, {{url}} (of the Wikipedia page), {{thumbnailTemplate}} (inserts the Wikipedia Thumbnail Template defined below), and {{description}} (shorter, simpler description).
				`
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
			.setName("Wikipedia Thumbnail Template")
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
			.setName("Bold Search Term?")
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
