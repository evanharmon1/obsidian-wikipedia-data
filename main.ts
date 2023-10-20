import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface WikipediaDataSettings {
	template: string;
	shouldBoldSearchTerm: boolean;
	language: string;
}

interface WikiData {
	title: string;
	text: string;
	url: string;
	image: string;
}

const extractApiUrl = "wikipedia.org/api/rest_v1/page/summary/";

const DEFAULT_SETTINGS: WikipediaDataSettings = {
	template: `{{text}}\n> [Wikipedia]({{url}})`,
	shouldBoldSearchTerm: true,
	language: "en",
}

export default class WikipediaData extends Plugin {
	settings: WikipediaDataSettings;

	getLanguage(): string {
		return this.settings.language ? this.settings.language : "en";
	}

	getUrl(title: string): string {
	return `https://${this.getLanguage()}.wikipedia.org/wiki/${encodeURI(
		title
	)}`;
	}
	
	getApiUrl(): string {
	return `https://${this.getLanguage()}.` + extractApiUrl;
	}

	async getWikipediaText(title: string): Promise<WikipediaExtract | undefined> {
		const url = this.getApiUrl() + encodeURIComponent(title);
		const requestParam: RequestParam = {
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
		const extract = this.parseResponse(resp);
		return extract;
	}

	async onload() {
		console.log("Loading Wikipedia data plugin");
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new WikipediaDataSettingTab(this.app, this));

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

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
