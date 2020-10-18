const NodeHelper = require("node_helper");
const request = require("request");
const jsdom = require("jsdom").JSDOM;
const moment = require("moment");
const tls = require('tls');

const RATE_LIMIT_MILLISECONDS = 30000;

module.exports = NodeHelper.create({
	start: function() {
		console.log("Starting node helper for: " + this.name);
		this.lastRequest = 0;
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		if (notification === "LOAD_MATCHES") {
			self.loadMatches(payload.sourceUrl);
		}
	},

	loadMatches: function(url) {
		var self = this;

		var diff = (new Date().getTime() - self.lastRequest);
		if (diff < RATE_LIMIT_MILLISECONDS) {
			console.log("Rate limiting check reached, waiting additional " + (RATE_LIMIT_MILLISECONDS - diff) + " ms before making a new request");
			setTimeout(function() {
				self.loadMatches(url);
			}, (RATE_LIMIT_MILLISECONDS - diff));
			return;
		}
		self.lastRequest = new Date().getTime();

		request({
			url : url,
			method : "GET",
			gzip : true,
			headers : {
				"User-Agent" : "MagicMirror/MMM-Liquipedia-Dota2/1.0; (https://github.com/buxxi/MMM-Liquipedia-Dota2)"
			},
		}, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				self.sendSocketNotification("DOTA2_MATCHES", {
					url: url,
					data: self.parseMatches(JSON.parse(response.body).parse.text['*'])
				});
			} else {
				if (response) {
					self.sendSocketNotification("DOTA2_MATCHES_ERROR", { statusCode : response.statusCode, url : url });
				} else {
					self.sendSocketNotification("DOTA2_MATCHES_ERROR", { statusCode : error.toString(), url : url });
				}
			}
		});    
	},

	parseMatches: function(data) {
		var dom = new jsdom(data);
		var tables = dom.window.document.querySelectorAll("table");
	
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
			return !div.querySelector("a.new");
		}

		function logoFileName(div) {
			let name = teamName(div);
			if (!name) {
				return undefined;
			}
			return name.toLowerCase().replace(/[^a-z0-9]/, "") + ".png";
		}
	
		var result = [];
	
		for (table of tables) {
			var teams = table.querySelectorAll(".team-template-text");
			var logos = table.querySelectorAll(".team-template-image img");
			var date = moment.utc(table.querySelector(".match-countdown").textContent, "MMMM DD, YYYY - HH:mm [UTC]");
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
