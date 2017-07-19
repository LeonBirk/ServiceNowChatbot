"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var path = require('path');
var request = require('request');
var headers = {
    'Accept': 'application/json'
};

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);
bot.localePath(path.join(__dirname, './locale'));
var categories = require('./categories.json');

bot.dialog('/', function (session) {
    if (session.message.text.includes("open") && session.message.text.includes("incident")) {
        session.beginDialog('createIncident');
    } else if (session.message.text.includes("INC"))
    {
        session.send("Getting Incident data...");
        var incidentID = session.message.text;
        //session.send('You requested information on the Incident with the ID ' + session.message.text);
        var urlString = 'https://dev27563.service-now.com/api/now/table/incident?sysparm_query=number=' + incidentID;
        var options = {
            url: urlString,
            headers: headers,
            auth: {
                'user': 'admin',
                'pass': 'EF3tGqL5T!'
            }
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                var respJSON = JSON.parse(body);
                //session.send(body)
                var state = "empty";
                state = respJSON.result[0].state;
                switch (state) {
                    case "1":
                        state = "New";
                        break;
                    case "2":
                        state = "In Progress";
                        break;
                    case "3":
                        state = "On Hold";
                        break;
                    case "4":
                        state = "Resolved";
                        break;
                    case "5":
                        state = "Closed";
                        break;
                    case "6":
                        state = "Canceled";
                        break;
                    default:
                        state = "undefined";
                }
                session.send('Requested ID: ' + respJSON.result[0].number + '\n Status: ' + state + '\n Urgency: ' + respJSON.result[0].urgency + '\n Short Description: ' + respJSON.result[0].short_description);
            }
        }

        request(options, callback);
    } else if (session.message.text.includes("my incidents"))
    {
        session.send("Getting your personal incidents... from Github!");
        var urlString = 'https://dev27563.service-now.com/api/now/table/incident?sysparm_query=caller_id=681ccaf9c0a8016400b98a06818d57c7';
        var options = {
            url: urlString,
            headers: headers,
            auth: {
                'user': 'admin',
                'pass': 'EF3tGqL5T!'
            }
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                var respJSON = JSON.parse(body);
                //session.send(body);
                var incidentCount = respJSON.result.length;
                session.send("You currently have " + incidentCount + " incidents.")
                for (var i = 0; i < respJSON.result.length; i++) {
                    session.send("Incident ID number " + (i + 1) + " is: " + respJSON.result[i].number + ", short description is: " + respJSON.result[i].short_description);
                }
                session.send("If you want more information on one of those incidents, ask me about its ID.")
            }
        }

        request(options, callback);
    }
    else if (session.message.text.includes("order sales laptop"))
    {
        session.send("Adding to cart: Sales Laptop...");
        var body = {'sysparm_quantity': '1'};
        var urlString = 'https://dev27563.service-now.com/api/sn_sc/servicecatalog/items/e212a942c0a80165008313c59764eea1/add_to_cart';
        var options = {
            url: urlString,
            method: 'POST',
            json: true,
            data: body,
            headers: headers,
            auth: {
                'user': 'admin',
                'pass': 'EF3tGqL5T!'
            }
        };

        function callback(error, response, body) {
            session.send(body);
            if (!error && response.statusCode == 200) {
                var respJSON = JSON.parse(body);
                session.send(body);
            }
        }

        request(options, callback);
    }
    else {
        session.send("I'm afraid I didn't understand. You can either list your incidents through the keyphrase: ''my incidents'' or search for a specific incident through ID.");
    }

});

// Waterfall dialogue that gets the information needed to create a ticket in ServiceNow and uploads it
bot.dialog('createIncident', [
    // Verifies entry into Conversation
    function (session) {
        builder.Prompts.text(session, 'I have understood that you want to create a new Incident, is that correct?');
    },
    // if the response is negative, returns to default dialog; if positive: ask for a keyword (possible keywords listed in categories.json
    function (session, results) {
        if (results.response === 'no') {
            session.endDialog('Ok! So how can I help you?');
        } else {
            builder.Prompts.text(session, 'Okay! So let\'s start with a keyword. What is the application, product or service that is causing a problem for you?');
        }
    },
    // Returns a list of choices for the selected category
    function (session, results) {
        session.dialogData.keyword = results.response;
        session.send(session.dialogData.keyword + " huh? I always struggle with that, too.");
        var choices = categories[session.dialogData.keyword];
        builder.Prompts.choice(session, 'Please specify one of the following categories:', choices);
    },
    // Asks for a short description
    function (session, results) {
        session.dialogData.category = results.response.entity;
        builder.Prompts.text(session, 'Your choice was: ' + session.dialogData.category + '. So let\'s move on with a short description. What\'s wrong exactly? In just a few words.');
    },
    // Asks for a description
    function (session, results) {
        session.dialogData.short_description = results.response;
        builder.Prompts.text(session, 'Now that doesn\'t sound too bad. I am sure we\'ll resolve this quickly. Is there anything you would want to add in a more elaborate description?');
    },
    // Asks for a phone number
    function (session, results) {
        session.dialogData.description = results.response;
        builder.Prompts.text(session, 'Ok, now I\'m positive that this will be done in an instant! Just let me know under which phone number you would want to be contacted.');
    },
    // Asks for verification of data, sends HTTP-request if positive
    function (session, results) {
        session.dialogData.phone_nr = results.response;
        var choices = ['yes', 'no'];
        builder.Prompts.choice(session, 'Looks good! So you want to submit a Ticket about ' + session.dialogData.keyword + ', the underlying category is ' + session.dialogData.category +
            ' with a short description of \'' + session.dialogData.short_description + '\'. And for further information, we can reach you under ' +
            session.dialogData.phone_nr + '. Am I correct?', choices);
    },
    function (session, results) {
        var confirmation = results.response.entity.toString();
        if (confirmation == 'no') {
            session.send('OK NOW I AM UPSET! Ask someone else. >:(')
        }
        else if (confirmation == 'yes') {
            session.send('Nice! I will get to work. Don\'t worry, I will get back to you when there are any news.');
            var body = {"short_description": session.dialogData.short_description.toString()};
            var urlString = 'https://dev27563.service-now.com/api/now/table/incident';
            var options = {
                url: urlString,
                method: 'POST',
                json: true,
                data: body,
                headers: headers,
                auth: {
                    'user': 'admin',
                    'pass': 'EF3tGqL5T!'
                }
            };

            function callback(error, response, body) {
                //var respJSON = JSON.parse(body);
                for(var property in body) {
                    session.send(property + "=" + body[property]);
                }
                if (!error && response.statusCode == 200) {

                    session.send("Positive response: " + body);
                }
            }

            request(options, callback);
        } else {
            session.send('I am confuuuuused. :(')
        }
        session.endDialog();

    }

]);

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function () {
        console.log('test bot endpoint at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());
} else {
    module.exports = {default: connector.listen()}
}
