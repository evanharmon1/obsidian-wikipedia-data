import { App, PluginSettingTab, Setting } from "obsidian";
import WikipediaData from "./main";

export interface WikipediaDataSettings {
	language: string;
	shouldBoldSearchTerm: boolean;
	wikipediaTemplates: WikipediaTemplate[];
	thumbnailTemplate: string;
	useParagraphTemplate: boolean;
	paragraphTemplate: string;
}

interface WikipediaTemplate {
	key: number;
	name: string;
	description: string;
	value: string;
}

const defaultWikipediaTemplateOne: WikipediaTemplate = {
	key: 1,
	name: "Wikipedia template #1",
	description: `Set the template to be inserted with the main command - 'Apply Template #1 for Active Note Title'.`,
	value: `| {{thumbnailTemplate}} | {{summary}} |\n|-|-|\n| | wikipedia:: [{{title}}]({{url}}) |\n`,
};

const defaultWikipediaTemplateTwo: WikipediaTemplate = {
	key: 2,
	name: "Wikipedia template #2",
	description: `Set the template to be inserted with the second command - 'Apply Template #2 for Active Note Title'.`,
	value: `> [!summary]- Wikipedia Synopsis\n{{introText}}\n`,
};

const defaultWikipediaTemplateThree: WikipediaTemplate = {
	key: 3,
	name: "Wikipedia template #3",
	description: `Set the template to be inserted with the third command - 'Apply Template #3 for Active Note Title'.`,
	value: `| {{thumbnailTemplate}} | {{summary}} |\n|-|-|\n| | wikipedia:: [{{title}}]({{url}}) |\n> [!summary]- Wikipedia Synopsis\n{{introText}}\n`,
};

export const DEFAULT_SETTINGS: WikipediaDataSettings = {
	language: "en",
	shouldBoldSearchTerm: true,
	wikipediaTemplates: [
		defaultWikipediaTemplateOne,
		defaultWikipediaTemplateTwo,
		defaultWikipediaTemplateThree,
	],
	thumbnailTemplate: `![img \\|150]({{thumbnailUrl}})`,
	useParagraphTemplate: true,
	paragraphTemplate: `> {{paragraphText}}\n>\n`,
};

export class WikipediaDataSettingTab extends PluginSettingTab {
	plugin: WikipediaData;

	constructor(app: App, plugin: WikipediaData) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Wikipedia language prefix")
			.setDesc(`Choose Wikipedia language prefix to use for API (e.g, 'en' for English)`)
			.addText((textField) => {
				textField.setValue(this.plugin.settings.language).onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Bold search term?")
			.setDesc("If set to true, the first instance of the search term will be **bolded**")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.shouldBoldSearchTerm).onChange(async (value) => {
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
					});
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
					});
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
					});
				textarea.inputEl.rows = 10;
				textarea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Thumbnail template")
			.setDesc(
				`Set the thumbnail template for what will be inserted with the 'thumbnailTemplate' variable within the above Wikipedia templates. If Wikipedia does not return a thumbnail image, this template will not be inserted. Use the '{{thumbnailUrl}}' variable here.`
			)
			.addTextArea((textarea) => {
				textarea.setValue(this.plugin.settings.thumbnailTemplate).onChange(async (value) => {
					this.plugin.settings.thumbnailTemplate = value;
					await this.plugin.saveSettings();
				});
				textarea.inputEl.rows = 5;
				textarea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Use paragraph template?")
			.setDesc(
				"If set to true, you can customize how each paragraph from the 'introText' template variable is formatted in the 'Paragraph template' below."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useParagraphTemplate).onChange(async (value) => {
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
				textarea.setValue(this.plugin.settings.paragraphTemplate).onChange(async (value) => {
					this.plugin.settings.paragraphTemplate = value;
					await this.plugin.saveSettings();
				});
				textarea.inputEl.rows = 5;
				textarea.inputEl.cols = 40;
			});
	}
}
