import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, RequestUrlParam, request } from 'obsidian';

interface WikipediaDataSettings {
	template: string;
    thumbnailTemplate: string;
	shouldBoldSearchTerm: boolean;
	language: string;
}

interface WikiData {
	title: string;
	text: string;
	description: string;
	url: string;
	thumbnailUrl: string;
}

const extractApiUrl = "wikipedia.org/api/rest_v1/page/summary/";

const DEFAULT_SETTINGS: WikipediaDataSettings = {
    template: `wikipedia:: [{{title}}]({{url}})\n> {{text}}`,
    thumbnailTemplate: `![thumbnail | 100]({{thumbnaillUrl}})`,
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

	parseResponse(json: any): WikiData | undefined {
		console.log(json);
		console.log(json.title);
		console.log("EVAN");
		if (json.title == "The page you requested doesn't exist") {
            return undefined;
		}
		if (json.hasOwnProperty("thumbnail")) {
            console.log("has thumbnail");
		}
        else {
            console.log("no thumbnail");
        }
		const wikiData: WikiData = {
			title: json.title,
			text: json.extract,
			description: json.description,
			url: json.content_urls.desktop.page,
			thumbnailUrl: (json.hasOwnProperty("thumbnail")) ? json.thumbnail.source : ""
        };
        console.log("Parse Response wiki data EVAN");
        console.log(wikiData);
        return wikiData;
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
    const formattedTemplate = template
        .replace("{{text}}", formattedText)
        .replace("{{title}}", wikiData.title)
        .replace("{{url}}", wikiData.url)
        .replace("{{thumbnailUrl}}", wikiData.thumbnailUrl);
    return formattedTemplate;
    }

	async getWikiData(title: string): Promise<WikiData | undefined> {
		const url = this.getApiUrl() + encodeURIComponent(title);
		const requestParam: RequestUrlParam = {
			url: url,
		};
        console.log("url");
        console.log(url);
        console.log("requestParam");
        console.log(requestParam);
		const resp = await request(requestParam)
			.then((r) => JSON.parse(r))
			.catch(
				() =>
					new Notice(
					"Failed to get Wikipedia. Check your internet connection or language prefix."
					)
			);
		console.log("resp");
		console.log(resp);
		const wikiData = this.parseResponse(resp);
		return wikiData;
	}

	async pasteIntoEditor(editor: Editor, searchTerm: string) {
        let testing2 = this.getWikiData(searchTerm);
		console.log(testing2);
        console.log("type of");
        console.log(typeof testing2);
        let apiResp: WikiData = await this.getWikiData(searchTerm) as WikiData;
		if (!apiResp) {
			this.handleNotFound(searchTerm);
			return;
		}
		editor.replaceSelection(this.formatExtractInsert(apiResp, searchTerm));
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
		console.log("Loading Wikipedia data plugin");
		await this.loadSettings();
		
        this.addCommand({
            id: "get-data-for-active-note-title",
            name: "Get Wikipedia Data for Active Note Title",
            editorCallback: (editor: Editor) =>
              this.getWikipediaDataForActiveFile(editor),
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
			.setDesc(`Choose Wikipedia language prefix to use (ex. en for English)`)
			.addText((textField) => {
				textField
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Wikipedia Extract Template")
			.setDesc(
				`Set markdown template for extract to be inserted.\n
				Available template variables are {{text}}, {{searchTerm}} and {{url}}.
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
