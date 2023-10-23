import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, RequestUrlParam, request } from 'obsidian';

interface WikipediaDataSettings {
	language: string;
	shouldBoldSearchTerm: boolean;
	template: string;
	thumbnailTemplate: string;
	useParagraphTemplate: boolean;
    paragraphTemplate: string;
}

// Object for response from wikimediaApiUrlBase
interface WikimediaData {
	type: string;
	title: string;
	description: string;
	summary: string;
	url: string;
	thumbnailUrl: string;
}

// Object for response from mediaWikiApiUrlBase
interface WikiSearch {
	resultCount: number;
	id: number;
	key: string;
	title: string;
	description: string;
	thumbnailUrl: string;
}

// Object for response from mediaWikiActionApiUrlBase
interface WikiText {
	fullText: string;
}

const wikimediaApiUrlBase = "wikipedia.org/api/rest_v1/";
const mediaWikiApiUrlBase = "wikipedia.org/w/rest.php/v1/";
const mediaWikiActionApiUrlBase = "wikipedia.org/w/api.php";

const DEFAULT_SETTINGS: WikipediaDataSettings = {
	language: "en",
	shouldBoldSearchTerm: true,
    template: `| {{thumbnailTemplate}} | {{summary}} |\n|-|-|\n| | wikipedia:: [{{title}}]({{url}}) |\n> [!summary]- Wikipedia Synopsis\n{{introText}}\n`,
	thumbnailTemplate: `![img \\|150]({{thumbnailUrl}})`,
	useParagraphTemplate: true,
    paragraphTemplate: `> {{paragraphText}}`,
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

	getMediaWikiActionApiUrl(): string {
		return `https://${this.getLanguage()}.` + mediaWikiActionApiUrlBase + `?format=json&action=query&prop=extracts&explaintext=1&redirects&origin=*&pageids=`
	}

	handleNotFound(searchTerm: string) {
		new Notice(`${searchTerm} not found on Wikipedia.`);
	}

	handleDisambiguation(searchTerm: string, disambiguationUrl: string) {
		// TODO: Use Obsidian DOM API instead of innerHTML?
		// Create DOM element to put a URL in the Obisidan Notice for the user to be able to open that Wikipedia disambiguation page.
		let linkElement = document.createElement("a");
		linkElement.innerHTML = `${searchTerm} Disambiguation Page\n`;
		linkElement.href = `${disambiguationUrl}`;
		let fragment = new DocumentFragment;
		fragment.appendChild(linkElement);
		new Notice(`${searchTerm} returned a disambiguation page.`, 10000)
		new Notice(fragment, 10000);
	}

	// Remove the occassional \n chars to make WikimediaData.summary always be one line.
    formatWikimediaDataSummary(wikimediaData: WikimediaData, searchTerm: string): string {
		const regex = /\n/g;
		let formattedSummary: string = wikimediaData.summary.trim().replace(regex, " ");
		if (this.settings.shouldBoldSearchTerm) {
			const pattern = new RegExp(searchTerm, "i");
			formattedSummary = formattedSummary.replace(pattern, `**${searchTerm}**`);
		}
		return formattedSummary;
	}

	// Split WikiText.fullText into paragraphs, extract just the intro section, and apply paragraphTemplate to each paragraph.
	formatWikiIntroText(wikiText: WikiText, searchTerm: string): string {
		const text = wikiText.fullText;
		let formattedText: string = "";
		if (this.settings.useParagraphTemplate) {
		  const split = text.split("==")[0].trim().split("\n");
		  formattedText = split
			.map((paragraph) =>
			  this.settings.paragraphTemplate.replace(
				"{{paragraphText}}",
				paragraph
			  )
			)
			.join("")
			.trim();
		} else {
		  formattedText = text.split("==")[0].trim();
		}
		if (this.settings.shouldBoldSearchTerm) {
		  const pattern = new RegExp(searchTerm, "i");
		  formattedText = formattedText.replace(pattern, `**${searchTerm}**`);
		}
		return formattedText;
	  }
	// Build final template to be inserted into note and apply template variables.
	formatTemplate(wikiSearch: WikiSearch, wikimediaData: WikimediaData, wikiText: WikiText, searchTerm: string): string {
		const formattedWikimediaDataSummary = this.formatWikimediaDataSummary(wikimediaData, searchTerm);
		const introText = this.formatWikiIntroText(wikiText, searchTerm);
		const template = this.settings.template;
		let thumbnailTemplate = "";
		// If no thumbnailUrl, don't insert thumbnailTemplate
		if (wikimediaData.thumbnailUrl !== "" ) {
			thumbnailTemplate = this.settings.thumbnailTemplate;
		}
		const formattedTemplate = template
			.replace("{{title}}", wikimediaData.title)
			.replace("{{url}}", wikimediaData.url)
			.replace("{{thumbnailTemplate}}", thumbnailTemplate)
			.replace("{{thumbnailUrl}}", wikimediaData.thumbnailUrl)
			.replace("{{description}}", wikimediaData.description)
			.replace("{{summary}}", formattedWikimediaDataSummary)
			.replace("{{introText}}", introText)
			.replace("{{id}}", wikiSearch.id.toString())
			.replace("{{key}}", wikiSearch.key)
		return formattedTemplate;
	}

	parseDataResponse(json: any): WikimediaData | undefined {
		const wikimediaData: WikimediaData = {
			type: json.type,
			title: json.title,
			summary: json.extract,
			description: json.description,
			url: json.content_urls.desktop.page,
			thumbnailUrl: (json.hasOwnProperty("thumbnail")) ? json.thumbnail.source : ""
        };
        return wikimediaData;
	}

	parseSearchResponse(json: any): WikiSearch | undefined {;
		const wikiSearch: WikiSearch = {
			resultCount: json.pages.length,
			id: json.pages[0].id,
			key: json.pages[0].key,
			title: json.pages[0].title,
			description: json.pages[0].description,
			thumbnailUrl: json.pages[0].thumbnailUrl
        };
        return wikiSearch;
	}

	parseTextResponse(json: any, id: number): WikiText | undefined {
		const wikiText: WikiText = {
			fullText: json.query.pages[id.toString()].extract
        };
        return wikiText;
	}

	async getWikimediaData(title: string): Promise<WikimediaData | undefined> {
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
		const wikimediaData = this.parseDataResponse(resp);
		return wikimediaData;
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

	async getWikiText(id: number): Promise<WikiText | undefined> {
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
		const wikiText = this.parseTextResponse(resp, id);
		return wikiText;
	}

	async pasteIntoEditor(editor: Editor, searchTerm: string) {
		// TODO: Fix typing here that needs as WikiSearch and as WikimediaData.
		let wikiSearch: WikiSearch = await this.getWikiSearch(searchTerm) as WikiSearch;
        let wikimediaData: WikimediaData = await this.getWikimediaData(wikiSearch.title) as WikimediaData;
        let wikiText: WikiText = await this.getWikiText(wikiSearch.id) as WikiText;
		if (!wikiSearch) {
			this.handleNotFound(searchTerm);
			return;
		}
		else if (wikimediaData.type.contains("missingtitle") || wikiSearch.resultCount == 0 ) {
			this.handleNotFound(searchTerm);
			return;
		}
		else if (wikimediaData.type == "disambiguation" || wikiSearch.description == "Topics referred to by the same term") {
			this.handleDisambiguation(searchTerm, wikimediaData.url);
			return;
		}
		else {
			editor.replaceSelection(this.formatTemplate(wikiSearch, wikimediaData, wikiText, searchTerm));
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

		new Setting(containerEl)
			.setName("Wikipedia template")
			// TODO: I should probably not bother with nesting templates and just have one template that handles the thumbnail part.
			.setDesc(
				`Set the template for what data from Wikipedia will be inserted.\n
				Available template variables are:\n{{title}}\n{{url}} (of the Wikipedia page)\n{{summary}} (Short textual explanation of the article in 1 or a few sentences)\n{{description}} (shorter, simpler description of the article)\n{{introText}} (The first intro section of a Wikipedia article - usually longer than the summary, sometimes up to a few paragraphs)\n{{id}} (article page id)\n{{key}}\n{{thumbnailTemplate}} (inserts the Wikipedia Thumbnail Template defined below)\n{{thumbnailUrl}} (although normally would just be used inside the thumbnailTemplate below).`
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
			.setName("Thumbnail template")
			.setDesc(
				`Set the thumbnail template for what will be inserted in the \`thumbnailTemplate\` variable within the Wikipedia template above. If Wikipedia does not return a thumbnail image, this template will not be inserted.\nUse the \`{{thumbnailUrl}}\` variable here.`
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
			.setName("Use paragraph template?")
			.setDesc(
				"If set to true, you can customize how each paragraph from the introText template variable is formatted."
			)
			.addToggle((toggle) =>
				toggle
				.setValue(this.plugin.settings.useParagraphTemplate)
				.onChange(async (value) => {
					this.plugin.settings.useParagraphTemplate = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Paragraph template")
			.setDesc(
				`Set the template for how each paragraph in the \`introText\` template variable will be displayed when inserted in the Wikipedia template above.\nUse the \`{{paragraphText}}\` variable here.`
			)
			.addTextArea((textarea) =>
				textarea
				.setValue(this.plugin.settings.paragraphTemplate)
				.onChange(async (value) => {
					this.plugin.settings.paragraphTemplate = value;
					await this.plugin.saveSettings();
				})
			);

	}
}
