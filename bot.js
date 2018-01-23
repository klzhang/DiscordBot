const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("ytdl-core");
const request = require("request");
const fs = require("fs");
const getYouTubeID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");

var config = JSON.parse(fs.readFileSync('./auth.json', 'utf-8'));

const yt_api_key = config.youtube_api_key;
const music_bopper_role = config.role;
const prefix = config.prefix;
const discord_token = config.token;

var queue = [];
var namequeue = [];
var isPlaying = false;
var dispatcher = null;
var voiceChannel = null;
var skipReq = 0;
var skippers = [];
var streamOptions = null;
var currentVolume = 0.20;
var output = "";

client.on('message', function(message) {
	if (message.author.bot) return;
	// if (!message.member.roles.has(music_bopper_role)) return;
	const mess = message.content.toLowerCase();
	const args = message.content.split(' ').slice(1).join(" ");
	if (mess.startsWith(prefix)) {
		var command = mess.substring(1);
		if (command.startsWith("play")) {
			commandPlay(message, args);
		} else if (command.startsWith("hello")) {
			var name = message.guild.members.get(message.author.id).nickname;
			if (name === null) {
				name = message.author.username;
			}
			message.channel.send("Hello, " + name + "!");
		} else if (command.startsWith("pause")) {
			if (dispatcher != null && !dispatcher.paused) {
				isPlaying = false;
				dispatcher.pause();
				message.channel.send("Paused.");
			} else {
				message.channel.send("Nothing to pause...")
			}
		} else if (command.startsWith("resume")) {
			if (dispatcher != null && dispatcher.paused) {
				isPlaying = true;
				dispatcher.resume();
				message.channel.send("Resuming...");
			} else {
				message.channel.send("Nothing to resume...")
			}
		} else if (command.startsWith("volume")) {
			var argsNum = parseFloat(args);
			if (typeof argsNum === 'number' && argsNum <= 1) {
				currentVolume = argsNum;
				if (streamOptions != null) {
					streamOptions['volume'] = currentVolume;
				}
				message.channel.send("Set the current volume to: " + argsNum);
			} 
		} else if (command.startsWith("skip")) {
			if (dispatcher != null) {
				dispatcher.end();
				message.channel.send("Skipped.");
			}
		} else if (command.startsWith("queue")) {
			if (queue.length == 0) {
				message.channel.send("The queue is currently empty.");
				return;
			}
			var status = isPlaying? "playing" : "not playing";
			output += "Status: " + status + "\n";
			var nums = Math.min(queue.length, 6);

			for( var i = 0; i < namequeue.length; i++){

				if(i === 0){
					output += "Now Playing" + ": **" + namequeue[i] + "**\n";
				}
				else{
					output += i + ": **" + namequeue[i] + "**\n";
				}

			}

			message.channel.send(output);

			output = "";
			/**addToOutput(nums, 0, function() {
				message.channel.send(output);
				output = "";
			}); **/
		}
	}

});

client.on('ready', function() {
	console.log("This is: " + client.user.username);
	console.log("I am ready!");
});

// **************DEBUG********************

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

// ***************************************

client.on('guildMemberAdd', function(member) {
	var channel = member.guild.channels.find('name', 'member-log');
	if (!channel) return;
	channel.send('Welcome to the server, ${member}');
});

// Error: the order is not preserved in the queue because the fetching is not a set time, need to fix somehow...
function addToOutput(numToDo, itemsDone, callback) {
	if (itemsDone === numToDo) {
		callback();
		return;
	} else {
		console.time('starting fetch');
		fetchVideoInfo(queue[itemsDone].id, function (err, videoInfo) {
			console.timeEnd('starting fetch');
			var index = itemsDone;
			if (itemsDone === 0) {
				index = "Now Playing"
			}
			output += index + ": **" + videoInfo.title + "**\n";
			addToOutput(numToDo, itemsDone + 1, callback);
		});
	}
}

function commandPlay(message, args) {
// Check to see if the caller is in a voice channel that the bot can play to
	if (message.member.voiceChannel || voiceChannel != null) {
		// Block of code for adding song to queue
		if (dispatcher != null) {
			if (!dispatcher.speaking) isPlaying = false;
		}
		if (queue.length > 0 || isPlaying) {
			getID(args, function(id) {
				add_to_queue(id, message);                    
				fetchVideoInfo(id, function(err, videoInfo) {
					if (err) throw new Error(err);
					message.channel.send(" added to queue: **" + videoInfo.title + "**");
					namequeue.push(videoInfo.title);
				});
			});
		} else {
			// Play song immediately
			isPlaying = true;
			getID(args, function(id) {
				queue.push({id: id, message: message});
				playMusic(id, message);
				fetchVideoInfo(id, function(err, videoInfo) {
					if (err) throw new Error(err);
					message.channel.send(" now playing: **" + videoInfo.title + "**");
					namequeue.push(videoInfo.title);
				});
			});
		}
	} else {
		message.reply(" you need to be in a voice channel!");
	}
}

function playMusic(id, message) {
	voiceChannel = message.member.voiceChannel;
	streamOptions = { seek: 0, volume: currentVolume };

	voiceChannel.join().then(function (connection) {
		stream = ytdl("http://wwww.youtube.com/watch?v=" + id, {
			filter: 'audioonly'
		});

		dispatcher = connection.playStream(stream, streamOptions);
		dispatcher.on('end', function() {
			queue.shift();
			namequeue.shift();
			if (queue.length === 0) {
				queue = [];
				isPlaying = false;
			} else {
				var first = queue[0];
				playMusic(first.id, first.message);
				fetchVideoInfo(first.id, function(err, videoInfo) {
					if (err) throw new Error(err);
					message.channel.send(" now playing: **" + videoInfo.title + "**");
				});
			}
		});
	});
}

// Checks to see if str is a youtube link:
// 		if yes: using callback function (typically involving playmusic) to play the link
//      else: using function search_video to search google api for youtube video
function getID(str, cb) {
	if (isYoutube(str)) {
		cb(getYouTubeID(str));
	} else {
		search_video(str, function(id) {
			cb(id);
		});
	}
}

// Called when queue length > 0 or there is a song playing
function add_to_queue(strID, message) {
	if (isYoutube(strID)) {
		queue.push({id: getYouTubeID(strID), message: message});
	} else {
		queue.push({id: strID, message: message});
	}
}

// JSON request to google api to search for a video using our youtube data api key
function search_video(query, callback) {
	request("https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=" + encodeURIComponent(query) + "&key=" + yt_api_key, function(error, response, body) {
		var json = JSON.parse(body);
		if (!json.items[0]) callback("3_-a9nVZYjk");
		else {
			callback(json.items[0].id.videoId);
		}
	});
}

// checks link to see if it is a youtube link
function isYoutube(str) {
	return str.toLowerCase().indexOf("youtube.com") > -1;
}

client.login(discord_token);