const NodeHelper = require("node_helper");
const fetch = require("node-fetch");
const jsdom = require("jsdom").JSDOM;
const moment = require("moment");

const RATE_LIMIT_MILLISECONDS = 30000;
const QUERY_PAGES_URL = "https://liquipedia.net/${game}/api.php?action=query&prop=links|info&titles=${titles}&format=json";
const MATCHES_PAGE_URL = "https://liquipedia.net/${game}/api.php?action=parse&format=json&page=${title}"
const USER_AGENT = "MagicMirror/MMM-Liquipedia-Matches/1.0; (https://github.com/buxxi/MMM-Liquipedia-Matches)";
const POSSIBLE_TITLES = ["Liquipedia:Upcoming_and_ongoing_matches", "Liquipedia:Matches"];

module.exports = NodeHelper.create({
	start: function() {
		console.log("Starting node helper for: " + this.name);
		this.lastRequest = 0;
		this.cachedSourceUrls = {};
	},

	socketNotificationReceived: async function(notification, payload) {
		var self = this;

		if (notification === "LOAD_LIQUIPEDIA_MATCHES") {
			let game = payload.game;
			let url = await self.resolveSourceUrl(payload.sourceUrl, game);	

			try {
				let matches = await self.loadMatches(url, game);
				self.sendSocketNotification("LIQUIPEDIA_MATCHES", {
					game: game,
					data: matches
				});
			} catch (err) {
				console.log(err);
				self.sendSocketNotification("LIQUIPEDIA_MATCHES_ERROR", { statusCode : err.message, url : url, game: game });	
			};
		}
	},

	resolveSourceUrl: async function(sourceUrl, game) {
		let self = this;

		if (game in self.cachedSourceUrls) {
			return self.cachedSourceUrls[game];
		}

		if (!!sourceUrl) {
			return sourceUrl;
		}

		let url = QUERY_PAGES_URL.replace("${game}", game).replace("${titles}", POSSIBLE_TITLES.join("|"));

		let response = await fetch(url, {
			method : "GET",
			headers : {
				"User-Agent" : USER_AGENT
			}
		});
		
		if (response.status != 200) {
			throw new Error(response.status + ": " + response.statusText);
		}

		let data = await response.json();
		sourceUrl = self.parseSourceUrl(Object.values(data.query.pages), game);
		self.cachedSourceUrls[game] = sourceUrl;
		return sourceUrl;
	},

	loadMatches: async function(url, game) {
		var self = this;

		var diff = (new Date().getTime() - self.lastRequest);
		if (diff < RATE_LIMIT_MILLISECONDS) {
			console.log("Rate limiting check reached, waiting additional " + (RATE_LIMIT_MILLISECONDS - diff) + " ms before making a new request");
			await self.wait(RATE_LIMIT_MILLISECONDS - diff);
			return await self.loadMatches(url, game);
		}
		self.lastRequest = new Date().getTime();

		let response = await fetch(url, {
			method : "GET",
			headers : {
				"User-Agent" : USER_AGENT
			}
		});
		
		if (response.status != 200) {
			throw new Error(response.status + ": " + response.statusText);
		}

		let data = await response.json();

		return self.parseMatches(data.parse.text['*']);
	},

	wait: function (ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},

	parseSourceUrl: function(pages, game) {
		let linksToOtherPage = (page) => {
			let pageTitles = pages.map(page => page.title);
			let linkTitles = page.links ? page.links.map(link => link.title) : [];
			return pageTitles.some(page => linkTitles.includes(page));
		}

		let filteredPages = pages
			.filter(page => !!page.pageid) //Page must exist
			.filter(page => !linksToOtherPage(page)) //If page links to the other page it's deprecated
		
		if (filteredPages.length !== 1) {
			console.log("Could not find a unique source page, got: " + filteredPages.length + ", using the latest touched one");
		}
		
		let page = filteredPages.reduce((prev, current) => (prev && prev.touched > current.touched) ? prev : current);

		return MATCHES_PAGE_URL.replace("${game}", game).replace("${title}", page.title);
	},

	parseMatches: function(data) {
		var dom = new jsdom(data);
		var tables = dom.window.document.querySelectorAll(".infobox_matches_content");
	
		function teamName(div) {
			if (!div) {
				return undefined;
			}
			var teamName = div.innerText;
			var a = div.querySelector("a");
			if (!a) {
				return teamName;
			}
			teamName = a.title;
			teamName = teamName.replace(' (page does not exist)','');
	
			return teamName;
		}

		function hasProfile(div) {
			if (!div) {
				return false;
			}
			return !div.querySelector("a.new");
		}

		function logoFileName(div) {
			let name = teamName(div);
			if (!name) {
				return undefined;
			}
			return name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".png";
		}
	
		var result = [];
	
		for (table of tables) {
			let hasResult = !!table.querySelector("tr[class^='recent-matches-']");
			if (hasResult) {
				continue;
			}
			let teams = table.querySelectorAll(".team-template-text");
			let date = moment.unix(table.querySelector(".match-countdown .timer-object").dataset.timestamp);
		
			let tournament = table.querySelector(".league-icon-small-image a").title;

			result.push({
				team1 : {
					name: teamName(teams[0]),
					hasProfile: hasProfile(teams[0]),
					logo: logoFileName(teams[0])
				},
				team2 : {
					name: teamName(teams[1]),
					hasProfile: hasProfile(teams[1]),
					logo: logoFileName(teams[1])
				},
				date : date.toISOString(),
				tournament : tournament
			});
		}

		return result;
	}
});
