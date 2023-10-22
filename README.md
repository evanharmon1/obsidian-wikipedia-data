# Obsidian Wikipedia Data Plugin
This is a plugin for [Obsidian](https://obsidian.md) that queries [WikiMedia's REST API](https://en.wikipedia.org/api/rest_v1/) to add data like an image url, description, text summary, and article url to an Obsidian note. The plugin provides a command that queries Wikipedia based on your active note's title and inserts text based on a template that you can customize. The main caveat is that the your note's title must resolve to a Wikipedia article name. 
- Adds a command "Get Wikipedia Data for Active Note Title" which queries Wikipedia and inserts data based on the templates defined in settings.
## Development Rationale
This plugin was inspired by and based on 2 great plugins - [obsidian-wikipedia](https://github.com/jmilldotdev/obsidian-wikipedia) and [obsidian-wikipedia-search](https://github.com/StrangeGirlMurph/obsidian-wikipedia-search). I wanted a handful of customizations (e.g. getting an image thumbnail) and also wanted a practical use case to learn how to make an Obsidian plugin. I also determined that using [WikiMedia's REST API](https://en.wikipedia.org/api/rest_v1/) worked better for what I wanted than the [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page) that both of those plugins use. Most notably, WikiMedia's API can return a "summary" that is a good medium length between the shorter "description" and often much longer introductory text "extracts" which can often take up over a page. Further, the former's "summary" value suffers from the occassional omission of line breaks discussed [here](https://phabricator.wikimedia.org/T201946).
## How to use
1. Put your cursor where you want the template to be inserted in your note.
2. Run the "Get Wikipedia Data for Active Note Title" to insert the template.
You can customize the template in the plugin's settings to change the format and variables you want from the Wikipedia API.
There is currently little affordance for handling when your active note doesn't resolve to a Wikipedia article. My primary use case for this plugin is to have Obsidian notes that loosely represent the same concept that a give Wikipedia article does.
## Bug Reports, Feature Requests, & Pull Requests
All are welcome and I'll do what I can to respond.
## Potential Future Features
- [ ] More flexible templating
    - [ ] E.g., maybe multiple commands and templates that you can bind to a hotkey. So you can still have a one-key/command workflow to handle 2 or 3 use cases instead of needing a menu system to choose a template.
- [ ] Add the Wikipedia API that gives the article intro text if wanting more text than MediaWiki's shorter summary text.
- [ ] Handle non-exact article titles better. As it is, your article note has to be a title that the API can resolve to an article.
