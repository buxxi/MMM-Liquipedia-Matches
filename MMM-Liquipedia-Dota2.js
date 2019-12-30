Module.register("MMM-Liquipedia-Dota2",{
	defaults: {
		matchUpdateInterval : 60*60*1000, //Once every hour should be a good enough default
		displayCount : 5,
		requiredProfiles: 0,
		sourceUrl : "https://liquipedia.net/dota2/api.php?action=parse&format=json&page=Liquipedia:Upcoming_and_ongoing_matches"
	},

	start: function() {
		var self = this;

		self.sendSocketNotification("LOAD_MATCHES", self.config);

		setInterval(function() {
			self.sendSocketNotification("LOAD_MATCHES", self.config);
		}, self.config.matchUpdateInterval);
	},

	notificationReceived: function(notification, payload, sender) {
		if (notification == "ALL_MODULES_STARTED" && MM.getModules().withClass("clock").length != 1) {
			this.sendNotification("SHOW_ALERT", { 
				title : this.name + ": Configuration Error",
				message : "This module needs the clock module to used since it listens for the CLOCK_MINUTE notification"
			});
		}
		if (notification == "CLOCK_MINUTE") {
			this.updateDom();
		}
	},

	getTemplate: function () {
		return "MMM-Liquipedia-Dota2.njk";
	},

	getTemplateData: function () {
		var self = this;
		if (self.matches == undefined) {
			return { matches : [] };
		}
		return {
			matches : self.matches.matches.filter(self.profileFilter(self.config.requiredProfiles)).slice(0, self.config.displayCount).map(function(match) {
				return {
					team1 : match.team1,
					team2 : match.team2,
					tournament : match.tournament,
					starts : self.timeRemaining(new Date(match.date))
				}
			})
		}
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification == "DOTA2_MATCHES" && payload.url == this.config.sourceUrl) {
			this.matches = { matches : payload.data };
			this.updateDom();
		} else if (notification == "DOTA2_MATCHES_ERROR" && payload.url == this.config.sourceUrl) {
			this.sendNotification("SHOW_ALERT", { 
				type : "notification",
				title : this.name + ": Request Error",
				message : "Got " + payload.statusCode + " while requesting " + payload.url,
				timer : 5000
			});
		}
	},

	timeRemaining : function(date) {
		var now = new Date();
		var diff = Math.floor((date.getTime() - now.getTime()) / 60000);
		if (diff < 0) {
			return "live";
		} else if (diff < 60) {
			return diff + " min";
		} else {
			return Math.floor(diff / 60) + " h";
		}
	},

	profileFilter : function(requiredProfiles) {
		return function(match) {
			var profiles = (match.team1.hasProfile ? 1 : 0) + (match.team2.hasProfile ? 1 : 0);
			return profiles >= requiredProfiles && match.team1.name && match.team2.name;
		};
	}
});
