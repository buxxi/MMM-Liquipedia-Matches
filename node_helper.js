const NodeHelper = require("node_helper");
const request = require("request");
const jsdom = require("jsdom").JSDOM;
const moment = require("moment");

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
			}
		}, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				self.sendSocketNotification("DOTA2_MATCHES", {
					url: url,
					data: self.parseMatches(JSON.parse(response.body).parse.text['*'])
				});
			} else {
				self.sendSocketNotification("DOTA2_MATCHES_ERROR", { statusCode : response.statusCode, url : url });
			}
		});    
	},

	parseMatches: function(data) {
		var dom = new jsdom(data);
		var tables = dom.window.document.querySelectorAll("table");
	
		function teamName(div) {
			var teamName = div.innerText;
			var a = div.querySelector("a");
			if (!a) {
				return teamName;
			}
			teamName = a.title;
			teamName = teamName.replace(' (page does not exist)','');
	
			return teamName;
		}
	
		var result = [];
	
		for (table of tables) {
			var teams = table.querySelectorAll(".team-template-text");
			var date = moment.utc(table.querySelector(".match-countdown").textContent, "MMMM DD, YYYY - HH:mm [UTC]");
			var tournament = table.querySelector(".match-countdown~div a").title;

			result.push({
				team1 : teamName(teams[0]),
				team2 : teamName(teams[1]),
				date : date.toISOString(),
				tournament : tournament
			});
		}

		return result;
	}
});
