var _ = require('underscore')

var config = require('./config')
var ddp = require('ddp');
var irc = require('irc');

var Twitter = require('twitter');

var initialized = false;
var aspectcount = 0;


var twitterclient = new Twitter({
  consumer_key: config.twitter_consumer_key,
  consumer_secret: config.twitter_consumer_secret,
  access_token_key: config.twitter_access_token_key,
  access_token_secret: config.twitter_access_token_secret,
});

var twitter_interval = 10 * 1000;
var last_tweet_id = 1;
setInterval(function(){
    console.log("Refreshing Twitter...")
    twitterclient.get('statuses/user_timeline', {
        screen_name: "ThursdayKnights",
        exclude_replies: true,
        trim_user: true,
        include_rts: false,
        since_id: last_tweet_id,
    }, function(error, params, response){
        if(error) {
            console.log("Twitter API error");
            console.log(error);
            console.log(params);
        } else {
            console.log("Found " + params.length + " new tweets");
            if (params.length > 0) {
                if (last_tweet_id != 1 && last_tweet_id != params[0].id) {
                    // Found a new tweet. Announce it!
                    announce_tweet(params[0].text, params[0].entities)
                    //console.log(params[0]);
                    //console.log(params[0].entities.media);
                    //console.log(params[0].extended_entities.media);
                }
                last_tweet_id = params[0].id;
                console.log("New most recent tweet id: " + last_tweet_id);
            }
        }

    });
}, twitter_interval);

var announce_tweet = function(text, entities) {
    text = strip_twitter_crap(text);

    if(entities.media.length > 0) {
        text += " http://" + entities.media[0].display_url;
    } else {
        text += " http://"
    }

    ircclient.say('#thursdayknights', "Tweet: " + text);
}

var strip_twitter_crap = function(text) {
    // Remove hashtags
    text = text.replace(/(?:^|\s)#[^\s]+/g, '');

    // Remove links
    text = text.replace(/https?:[^\s]+/g, '');

    // Remove resulting double spaces
    text = text.replace("  ", " ");

    return text;
}


var ddpclient = new ddp({
    host: config.aspects_host,
    port: config.aspects_port,
    /* optional: */
    auto_reconnect: true,
    auto_reconnect_timer: 500,
    use_ssl: false,
    maintain_collections: true // Set to false to maintain your own collections.
});

/*
 * Connect to the Meteor Server
 */
ddpclient.connect(function(error) {
    initialized = false;
    // If auto_reconnect is true, this callback will be invoked each time
    // a server connection is re-established
    if (error) {
        console.log('DDP connection error!');
        return;
    }

    console.log('DDP connected!');

    ddpclient.subscribe(
        'aspects',                // name of Meteor Publish function to subscribe to
        [],                       // any parameters used by the Publish function
        function () {             // callback when the subscription is complete
            console.log('Aspects:');
            console.log(ddpclient.collections.aspects);
            aspectcount = _.size(ddpclient.collections.aspects);
            initialized = true;
            console.log('Aspects initialized! Current count: ' + aspectcount)
        }
    );
});

ddpclient.on('message', function (msg) {
    console.log("ddp message: " + msg);
});

ddpclient.on('added', function(collection, id){
    if(collection == 'aspects' && initialized == true) {
        newcount = _.size(ddpclient.collections.aspects)
        if (newcount > aspectcount) {
            aspectcount = _.size(ddpclient.collections.aspects);
            var aspect = ddpclient.collections.aspects[id];
            console.log("New aspect: " + aspect.name);
            //ircclient.say('#thursdayknights', "New " + aspect.type + " aspect: " + aspect.name);
        }
    }
});

var ircclient = new irc.Client('irc.twitch.tv', config.login, {
    port: 80,
    channels: ['#thursdayknights'],
    floodProtection: true,
    // debug: true,
    showErrors: true,
    sasl: false,
    userName: config.login,
    password: config.pass,
});
var users = {}

ircclient.addListener('error', function(message) {
    console.log('IRC Bot error: ', message);
});

ircclient.addListener('registered', function(message) {
    console.log('IRC Bot connected!');
});

// ircclient.addListener('raw', function(message) {
//     console.log('raw: ', message);
// });

var commands = {
    aspects: function(args){
        var aspects = ddpclient.collections.aspects;
        Object.keys(aspects).forEach(function(key) {
            var item = aspects[key];
            if(item.type == args) {
                //ircclient.say('#thursdayknights', "Aspect: " + item.name)
            }
        });
    },
}

var parse_bot_command = function(message){
    var re = /!([^\s]+)\s*(.*)/;
    var matches = message.match(re);
    console.log('Command identified: ' + message)
    console.log('Regex matches: ', matches);

    if (matches) {
        if(commands[matches[1]]) {
            commands[matches[1]](matches[2]);
        }
    }
};

ircclient.addListener('message#', function (from, to, message) {
    if (to == '#thursdayknights') {
        console.log(from + ' => ' + to + ': ' + message);
        if (message.substring(0,1) == '!') {
            parse_bot_command(message);
        }
    }
});

ircclient.addListener('names', function (channel, nicks) {
    console.log('Nicks in ' + channel + ': ', nicks);
    users[channel] = nicks;
    console.log('Cached users:', users);
});

ircclient.addListener('names', function (channel, nick, message) {
    console.log('Joined ' + channel + ': ', nick, message);
});

ircclient.addListener('+mode', function (channel, by, mode, who, message) {
    console.log('Mode added in ' + channel + ': ', who, mode, message);
});

ircclient.addListener('-mode', function (channel, by, mode, who, message) {
    console.log('Mode removed in ' + channel + ': ', who, mode, message);
});









