var http = require('http'),  
	sys  = require('sys'),
	fs = require('fs'),	
	path = require('path'),

	paperboy = require('./lib/paperboy/paperboy'),
	TwitterNode = require('./lib/twitter-node')
		.TwitterNode,
	io = require('./lib/socket.io/lib/socket.io'),

	twitter_account = require('./twitter_account.js');

var term = "cccamp11", // std tag
    PORT = 8004,
    WEBROOT = path.join(path.dirname(__filename), 'WEBROOT'),
    options = {
		host: 'search.twitter.com',
		port: 80,
		orig_path: '/search.json?q=',
		path: '',
		method: 'GET'
    };


if (process.argv[2] != undefined)
	term = process.argv[2];


server = http.createServer(function(req, res) {
		paperboy
		.deliver(WEBROOT, req, res)
});
server.listen(PORT);


io = io.listen(server);
io.sockets.on('connection', function (socket) {
	socket.on('start', function (url_term) {
		if (url_term != '') 
			term = url_term;

		getInitialTweets(socket);
		listenForNewTweets(socket);
	});
});


function getInitialTweets(socket) {
		var bodyarr = [];
		options.path = options.orig_path + term.replace(/#/g, '%23');
		http.get(options, function(res) {
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				bodyarr.push(chunk)
				})
			res.on('end', function() {
				var data = bodyarr.join('')
				var cmds = "";
				var tweets = eval("(" + data + ")");
				console.log(tweets);
				console.log(tweets.results.length + " tweets fetched");

				if (tweets.results.length >= 6) {
					for (var i = 0; i < 6; i++) {
						var tweet = tweets.results[i];

						cmds += "setTweet(" + i + ",'" + 
								formatText(tweet.text) + 
								"','" +	tweet.profile_image_url 
								+ "','" + 
								tweet.from_user + "'); ";
					}
				}
				cmds += "setHashtag('" + term + "');";
				socket.emit('cmds', cmds);
			})
		})
}

function setHashtag(tag) {
	$("h1").html(tag);
}


function formatText(text) {
	repl = new RegExp('#' + term, 'gi');
	text = text.replace(repl, "<strong>#" + term + "</strong>");

	repl = new RegExp('@' + term, 'gi');
	text = text.replace(repl, "<strong>#" + term + "</strong>");

	repl = new RegExp(term, 'gi');
	text = text.replace(repl, "<strong>" + term + "</strong>");

	text = text.replace(/"/g, "&quot;");
	text = text.replace(/\n/g, "");

	return text.replace(/'/g, "&rsquo;");
}


function listenForNewTweets(socket) {
	var twit = new TwitterNode({
				user: twitter_account.user,
				password: twitter_account.pw,
				track: [term],
		});

		twit.addListener('error', function(error) {
				console.log(error.message);
		})

		.addListener('tweet', function(tweet) {
				console.log("@" + tweet.user.screen_name + ": " + 
					tweet.text);
				cmds = "nextTweet(0, '" + formatText(tweet.text) + 
						"', '" + tweet.user.profile_image_url + 
						"', '" + tweet.user.screen_name + "');";
				socket.emit('new_tweet', cmds);
		})

		.addListener('limit', function(limit) {
				console.log("LIMIT: " + sys.inspect(limit));
		})

		.addListener('delete', function(del) {
				console.log("DELETE: " + sys.inspect(del));
		})

		.addListener('end', function(resp) {
				console.log("end of connection: " + resp.statusCode);
		})


		.stream();
}
