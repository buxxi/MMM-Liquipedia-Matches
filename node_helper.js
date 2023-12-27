const NodeHelper = require("node_helper");
const fetch = require("node-fetch");
const jsdom = require("jsdom").JSDOM;
const moment = require("moment");

const RATE_LIMIT_MILLISECONDS = 30000;

module.exports = NodeHelper.create({
	start: function() {
		console.log("Starting node helper for: " + this.name);
		this.lastRequest = 0;
	},

	socketNotificationReceived: async function(notification, payload) {
		var self = this;

		if (notification === "LOAD_LIQUIPEDIA_MATCHES") {
			let url = payload.sourceUrl;
			let game = payload.game;

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
				"User-Agent" : "MagicMirror/MMM-Liquipedia-Dota2/1.0; (https://github.com/buxxi/MMM-Liquipedia-Dota2)"
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

	parseMatches: function(data) {
		var dom = new jsdom(data);
		var tables = dom.window.document.querySelectorAll("div[data-toggle-area-content='1'] table");
	
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
			var teams = table.querySelectorAll(".team-template-text");
			var date = moment.unix(table.querySelector(".match-countdown .timer-object").dataset.timestamp);
		
			var tournament = table.querySelector(".match-countdown~div a").title;

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
