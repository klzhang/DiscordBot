const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("ytdl-core");
const request = require("request");
const fs = require("fs");
const getYouTubeID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");

var config = JSON.parse(fs.readFileSync('./auth.json', 'utf-8'));

const yt_api_key = config.youtube_api_key;
const discord_token = config.token;
const prefix = config.prefix;

client.on("ready", () => {
  console.log("I am ready!");
});

client.on("message", (message) => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const mess = message.content.toLowerCase();
	const args = message.content.split(' ').slice(1).join(" ");

	var command = mess.substring(1);
	if (command.startsWith("ping")) {
    	message.channel.send("Pong!");
	}
});

client.login(discord_token);