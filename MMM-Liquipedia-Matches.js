Module.register("MMM-Liquipedia-Matches",{
	defaults: {
		matchUpdateInterval : 60*60*1000, //Once every hour should be a good enough default
		displayCount : 5,
		requiredProfiles: 0,
		language: config.language,
		game: "dota2",
		sourceUrl : null,
		requiredTeams: []
	},

	start: function() {
		var self = this;
		moment.locale(self.config.language);

		self.sendSocketNotification("LOAD_LIQUIPEDIA_MATCHES", self.config);

		setInterval(function() {
			self.sendSocketNotification("LOAD_LIQUIPEDIA_MATCHES", self.config);
		}, self.config.matchUpdateInterval);
	},

	notificationReceived: function(notification, payload, sender) {
		if (notification == "ALL_MODULES_STARTED" && MM.getModules().withClass("clock").length != 1) {
			this.sendNotification("SHOW_ALERT", { 
				title : this.name + ": " + this.translate("CONFIG_ERROR_TITLE"),
				message : this.translate("CONFIG_ERROR_MESSAGE")
			});
		}
		if (notification == "CLOCK_MINUTE") {
			this.updateDom();
		}
	},

	getTemplate: function () {
		return "MMM-Liquipedia-Matches.njk";
	},

	getScripts: function() {
		return ["moment.js"];
	},

	getStyles: function() {
		return ["MMM-Liquipedia-Matches.css"];
	},

	getTranslations: function() {
		return {
				sv: "translations/sv.json",
				en: "translations/en.json"
		};
	},

	getTemplateData: function () {
		var self = this;
		if (self.matches == undefined) {
			return { matches : [] };
		}
		return {
			matches : self.matches.matches.filter(self.matchFilter(config)).slice(0, self.config.displayCount).map(function(match) {
				let matchDate = new Date(match.date);
				return {
					team1 : match.team1,
					team2 : match.team2,
					tournament : match.tournament,
					starts : self.timeRemaining(matchDate),
					live : new Date().getTime() > matchDate.getTime()
				}
			}),

			logoPath: '/modules/' + this.name + '/public/logos/' + self.config.game + '/'
		}
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification == "LIQUIPEDIA_MATCHES" && payload.game == this.config.game) {
			this.matches = { matches : payload.data };
			this.updateDom();
		} else if (notification == "LIQUIPEDIA_MATCHES_ERROR" && payload.game == this.config.game) {
			this.sendNotification("SHOW_ALERT", { 
				type : "notification",
				title : this.name + ": " + this.translate("REQUEST_ERROR_TITLE"),
				message : this.translate("REQUEST_ERROR_MESSAGE", {
					statusCode : payload.statusCode,
					url : payload.url,
				}),
				timer : 5000
			});
		}
	},

	timeRemaining : function(date) {
		let momentDate = moment(date);

		return momentDate.fromNow();
	},

	matchFilter : function() {
		let self = this;
		if (self.config.requiredTeams.length > 0) {
			return self.teamsFilter(self.config.requiredTeams.map(team => self.normalize(team)));
		} else {
			return self.profileFilter(self.config.requiredProfiles);
		}
	},

	teamsFilter : function(requiredTeams) {
		let self = this;
		return function(match) {
			return requiredTeams.indexOf(self.normalize(match.team1.name)) != -1 || requiredTeams.indexOf(self.normalize(match.team2.name)) != -1;
		};
	},

	profileFilter : function(requiredProfiles) {
		return function(match) {
			var profiles = (match.team1.hasProfile ? 1 : 0) + (match.team2.hasProfile ? 1 : 0);
			return profiles >= requiredProfiles && match.team1.name && match.team2.name;
		};
	},

	normalize : function(name) {
		if (!name) {
			return "";
		}
		return name.toLowerCase().replace(/[^a-z0-9]/, "");
	}
});
