import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, RequestUrlParam, request } from 'obsidian';

interface WikipediaDataSettings {
	language: string;
	shouldBoldSearchTerm: boolean;
	wikipediaTemplates: WikipediaTemplate[];
	thumbnailTemplate: string;
	useParagraphTemplate: boolean;
    paragraphTemplate: string;
}

interface WikipediaTemplate {
	key: number,
	name: string;
	description: string;
	value: string;
}

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

const defaultWikipediaTemplateOne: WikipediaTemplate = {
	key: 1,
	name: "Wikipedia template #1",
	description: `Set the template to be inserted with the main command - 'Apply Template #1 for Active Note Title'.`,
	value: `| {{thumbnailTemplate}} | {{summary}} |\n|-|-|\n| | wikipedia:: [{{title}}]({{url}}) |\n> [!summary]- Wikipedia Synopsis\n{{introText}}\n`
}

const defaultWikipediaTemplateTwo: WikipediaTemplate = {
	key: 2,
	name: "Wikipedia template #2",
	description: `Set the template to be inserted with the second command - 'Apply Template #2 for Active Note Title'.`,
	value: `| {{thumbnailTemplate}} | {{summary}} |\n|-|-|\n| | wikipedia:: [{{title}}]({{url}}) |\n> [!summary]- Wikipedia Synopsis\n{{introText}}\n`
}

const defaultWikipediaTemplateThree: WikipediaTemplate = {
	key: 3,
	name: "Wikipedia template #3",
	description: `Set the template to be inserted with the third command - 'Apply Template #3 for Active Note Title'.`,
	value: `| {{thumbnailTemplate}} | {{summary}} |\n|-|-|\n| | wikipedia:: [{{title}}]({{url}}) |\n> [!summary]- Wikipedia Synopsis\n{{introText}}\n`
}

const DEFAULT_SETTINGS: WikipediaDataSettings = {
	language: "en",
	shouldBoldSearchTerm: true,
	wikipediaTemplates: [defaultWikipediaTemplateOne, defaultWikipediaTemplateTwo, defaultWikipediaTemplateThree],
	thumbnailTemplate: `![img \\|150]({{thumbnailUrl}})`,
	useParagraphTemplate: true,
	paragraphTemplate: `> {{paragraphText}}\n>\n`,
}

export default class WikipediaData extends Plugin {
	settings: WikipediaDataSettings;

	getLanguage(): string {
		return this.settings.language ? this.settings.language : "en";
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
	formatMediaWikiActionApiIntroText(mediaWikiActionApiResponse: MediaWikiActionApiResponse, searchTerm: string): string {
		const text = mediaWikiActionApiResponse.fullText;
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
		// Handle paragraphTemplate edge case where there is an unwanted trailing '>'
		if (formattedText.charAt(formattedText.length - 1) === ">") {
			formattedText = formattedText.slice(0, formattedText.length - 2)
		}
		return formattedText;
	}

	// Build final template to be inserted into note and apply template variables.
	formatTemplate(mediaWikiApiResponse: MediaWikiApiResponse, wikimediaApiResponse: WikimediaApiResponse, mediaWikiActionApiResponse: MediaWikiActionApiResponse, searchTerm: string, wikipediaTemplateNum: number): string {
		const formattedSummary = this.formatWikimediaApiSummary(wikimediaApiResponse, searchTerm);
		const formattedIntroText = this.formatMediaWikiActionApiIntroText(mediaWikiActionApiResponse, searchTerm);
		const template = this.settings.wikipediaTemplates[wikipediaTemplateNum - 1].value;
		let thumbnailTemplate = "";
		// If no thumbnailUrl, don't insert thumbnailTemplate
		if (wikimediaApiResponse.thumbnailUrl !== "" ) {
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
			.replace("{{key}}", mediaWikiApiResponse.key)
		return formattedTemplate;
	}

	parseWikimediaApiResponse(json: any): WikimediaApiResponse | undefined {
		const parsedWikimediaApiResponse: WikimediaApiResponse = {
			type: json.type,
			title: json.title,
			summary: json.extract,
			description: json.description,
			url: json.content_urls.desktop.page,
			thumbnailUrl: (json.hasOwnProperty("thumbnail")) ? json.thumbnail.source : ""
        };
        return parsedWikimediaApiResponse;
	}

	parseMediaWikiApiResponse(json: any): MediaWikiApiResponse | undefined {;
		const parsedMediaWikiApiResponse: MediaWikiApiResponse = {
			resultCount: json.pages.length,
			id: json.pages[0].id,
			key: json.pages[0].key,
			title: json.pages[0].title,
			description: json.pages[0].description,
			thumbnailUrl: json.pages[0].thumbnailUrl
        };
        return parsedMediaWikiApiResponse;
	}

	parseMediaWikiActionApiResponse(json: any, id: number): MediaWikiActionApiResponse | undefined {
		const parsedMediaWikiActionApiResponse: MediaWikiActionApiResponse = {
			fullText: json.query.pages[id.toString()].extract
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
		// TODO: Fix typing here that needs as WikiSearch and as WikimediaData.
		let mediaWikiApiResponse: MediaWikiApiResponse = await this.getMediaWikiApiResponse(searchTerm) as MediaWikiApiResponse;
        let wikimediaApiResponse: WikimediaApiResponse = await this.getWikimediaApiResponse(mediaWikiApiResponse.title) as WikimediaApiResponse;
        let mediaWikiActionApiResponse: MediaWikiActionApiResponse = await this.getMediaWikiActionApiResponse(mediaWikiApiResponse.id) as MediaWikiActionApiResponse;
		if (!mediaWikiApiResponse) {
			this.handleNotFound(searchTerm);
			return;
		}
		else if (wikimediaApiResponse.type.contains("missingtitle") || mediaWikiApiResponse.resultCount == 0 ) {
			this.handleNotFound(searchTerm);
			return;
		}
		else if (wikimediaApiResponse.type == "disambiguation" || mediaWikiApiResponse.description == "Topics referred to by the same term") {
			this.handleDisambiguation(searchTerm, wikimediaApiResponse.url);
			return;
		}
		else {
			editor.replaceSelection(this.formatTemplate(mediaWikiApiResponse, wikimediaApiResponse, mediaWikiActionApiResponse, searchTerm, wikipediaTemplateNum));
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
			.setDesc(`Choose Wikipedia language prefix to use for API (e.g, 'en' for English)`)
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

		this.containerEl.createEl("h1", { text: "Templates" });

		const desc = document.createDocumentFragment();
		desc.append(
				"Define the templates for what data from Wikipedia will be inserted into your active Obsidian note.",
				desc.createEl("br"),
				desc.createEl("br"),
				"If you just need one template corresponding to one command, you don't need to worry about the extra numbered templates below (Wikipedia template #2...). The extra numbered templates apply only if you want multiple unique templates in order to apply them in different situations. Each numbered template corresponds to the extra numbered plugin commands. So, e.g., 'Wikipedia template #2' gets applied via the 'Apply Template #2 for Active Note Title' command, etc.",
				desc.createEl("br"),
				desc.createEl("br"),
				desc.createEl("strong", { text: "Available template variables are:" }),
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{title}}" }),
				" - Wikipedia page title. E.g, 'Ludwig Wittgenstein'.",
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{url}}" }),
				" - URL of the Wikipedia page",
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{description}}" }),
				" - Short, simple description of the article. Usually just a short fragment. E.g, 'Austrian philosopher and logician (1889–1951)'.",
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{summary}}" }),
				" - Medium length explanation of the article in 1 or a few sentences. E.g, 'Ludwig Josef Johann Wittgenstein was an Austrian philosopher who worked primarily in logic, the philosophy of mathematics, the philosophy of mind, and the philosophy of language.'.",
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{introText}}" }),
				" - Longer explanation, sometimes multiple paragraphs - the first intro section of a Wikipedia article.",
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{id}}" }),
				" - page id of the Wikipedia page. E.g, '17741'.",
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{key}}" }),
				" - Key of the Wikipedia page. E.g, 'Ludwig_Wittgenstein'.",
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{thumbnailTemplate}}" }),
				" - Inserts the Wikipedia 'Thumbnail template' defined below.",
				desc.createEl("br"),
				desc.createEl("strong", { text: "{{thumbnailUrl}}" }),
				" - Inserts the url of the article's thumbnail image (if it has one). (Normally one would only use this variable inside the 'Thumbnail template' below, although you can use it directly in the 'Wikipedia templates' as well."
		);

		new Setting(this.containerEl).setDesc(desc);
		
		new Setting(containerEl)
			.setName(this.plugin.settings.wikipediaTemplates[0].name)
			.setDesc(this.plugin.settings.wikipediaTemplates[0].description)
			.addTextArea((textarea) => {
				textarea
				.setValue(this.plugin.settings.wikipediaTemplates[0].value)
				.onChange(async (value) => {
					this.plugin.settings.wikipediaTemplates[0].value = value;
					await this.plugin.saveSettings();
				})
				textarea.inputEl.rows = 10;
				textarea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName(this.plugin.settings.wikipediaTemplates[1].name)
			.setDesc(this.plugin.settings.wikipediaTemplates[1].description)
			.addTextArea((textarea) => {
				textarea
				.setValue(this.plugin.settings.wikipediaTemplates[1].value)
				.onChange(async (value) => {
					this.plugin.settings.wikipediaTemplates[1].value = value;
					await this.plugin.saveSettings();
				})
				textarea.inputEl.rows = 10;
				textarea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName(this.plugin.settings.wikipediaTemplates[2].name)
			.setDesc(this.plugin.settings.wikipediaTemplates[2].description)
			.addTextArea((textarea) => {
				textarea
				.setValue(this.plugin.settings.wikipediaTemplates[2].value)
				.onChange(async (value) => {
					this.plugin.settings.wikipediaTemplates[2].value = value;
					await this.plugin.saveSettings();
				})
				textarea.inputEl.rows = 10;
				textarea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Thumbnail template")
			.setDesc(
				`Set the thumbnail template for what will be inserted with the 'thumbnailTemplate' variable within the above Wikipedia templates. If Wikipedia does not return a thumbnail image, this template will not be inserted. Use the '{{thumbnailUrl}}' variable here.`
			)
			.addTextArea((textarea) => {
				textarea
				.setValue(this.plugin.settings.thumbnailTemplate)
				.onChange(async (value) => {
					this.plugin.settings.thumbnailTemplate = value;
					await this.plugin.saveSettings();
				})
				textarea.inputEl.rows = 5;
				textarea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Use paragraph template?")
			.setDesc(
				"If set to true, you can customize how each paragraph from the 'introText' template variable is formatted in the 'Paragraph template' below."
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
				`Set the paragraph template for how each paragraph in the 'introText' template variable will be displayed when inserted in the Wikipedia templates above. Use the '{{paragraphText}} variable here.`
			)
			.addTextArea((textarea) => {
				textarea
				.setValue(this.plugin.settings.paragraphTemplate)
				.onChange(async (value) => {
					this.plugin.settings.paragraphTemplate = value;
					await this.plugin.saveSettings();
				})
				textarea.inputEl.rows = 5;
				textarea.inputEl.cols = 40;
			});

	}
}
