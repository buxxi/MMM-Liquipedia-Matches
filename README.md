# MMM-Liquipedia-Matches
[Magic Mirror](https://magicmirror.builders/) Module - A module for Magic Mirror that displays live and upcoming e-sport matches fetched from Liquipedia.

![Screenshot][screenshot]

## Install
1. Clone repository into ``../modules/`` inside your MagicMirror folder.
2. Run ``npm install`` inside the ``MMM-Liquipedia-Matches`` folder.
3. Add the module to the Magic Mirror config.
```
{
  module: "MMM-Liquipedia-Matches",
  config: {}
},
```
4. Done!

## Configuration parameters
- ``game`` : Which game should it display for. Tested with ``dota2``, ``counterstrike`` and ``leagueoflegends``. Default is ``dota2`` to keep backwards compatibility.
- ``matchUpdateInterval`` : How often it should fetch new matches in seconds, anything lower than 30 seconds is throttled since it could lead to an ip-ban, default is 60 minutes.
- ``displayCount`` : the amount of matches to display, default is 5
- ``sourceUrl`` : The API-url to use, could possibly be changed to other games on Liquipedia too?
- ``requiredProfiles``: the amount of teams in the match that needs to have a profile page on Liquipedia, 0-2, default is 0
- ``requiredTeams``: an array of team names to display matches for instead of using requiredProfiles, capitalization and spaces not required, default is empty
- ``language`` : The language to use for time formatting, defaults to MagicMirror default

## Team logos
By default no team logos will be displayed since they need to be fetched manually (can't hotlink the images to Liquipedia).
To make a logo visible:
1. Create a directory named ``public/logos/${game}`` in the root of this plugin (``${game}`` should have the same value as the configuration parameter)
2. Get/Create a logo that is preferably a square or is wider than its height in png format
3. Place it in the ``public/logos/${game}`` directory and name it ``teamsuperawesome5.png`` if the teams name is ``Team: SuperAwesome5`` (removing all non alphanumeric characters and making it lower case)

I also created a script for making a one time download from Liquipedia, cropping and inverting dark logos:
Run the following commands inside the `MMM-Liquipedia-Matches`: 
- `npm install`
- `node fetch_logos.js dota2`.

 [screenshot]: https://github.com/buxxi/MMM-Liquipedia-Matches/blob/master/screenshot.png