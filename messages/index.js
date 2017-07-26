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
var hardware = {};
var isThatCorrect = ['yes', 'no'];

bot.dialog('/', function (session) {
    if (session.message.text.includes("open") && session.message.text.includes("incident") && session.message.text.includes('new')) {
        session.beginDialog('createIncident');
    }
    else if (session.message.text.includes("INC")) {
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
                    case "6":
                        state = "Resolved";
                        break;
                    case "7":
                        state = "Closed";
                        break;
                    case "8":
                        state = "Canceled";
                        break;
                    default:
                        state = "undefined";
                }
                session.send('Requested ID: ' + respJSON.result[0].number + '\n Status: ' + state + '\n Urgency: ' + respJSON.result[0].urgency + '\n Short Description: ' + respJSON.result[0].short_description);
            }
        }

        request(options, callback);
    } else if (session.message.text.includes("my incidents")) {
        session.send("Getting your personal incidents...");
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
                session.send("You currently have " + incidentCount + " incidents.");
                for (var i = 0; i < respJSON.result.length; i++) {
                    session.send("Incident ID number " + (i + 1) + " is: " + respJSON.result[i].number + ", short description is: " + respJSON.result[i].short_description);
                }
                session.send("If you want more information on one of those incidents, ask me about its ID.")
            }
        }

        request(options, callback);
    }
    else if (session.message.text.includes("order sales laptop")) {
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
            if (!error && response.statusCode == 201) {
                var respJSON = JSON.parse(body);
                session.send(body);
            }
        }

        request(options, callback);
    }
    else if (session.message.text.includes("reopen incident")) {
        session.beginDialog('reopenIncident');
    }
    else if (session.message.text.includes("order hardware")) {
        session.beginDialog('orderHardware');
    }
    else {
        // TODO: make this a choice list, or at least format correctly
        session.send("I'm afraid I didn't understand. " +
            "I am currently somewhat lacking flexibility. The methods available for usage are: \r" +
            "''open new incident'' - Guides you through the process of creating an incident on your behalf.\n" +
            "''reopen incident'' - Gives you the list of your incidents eligible for reopening and let''s you do it directly in chat.\n" +
            "''order hardware'' - The devices available for you can be ordered through this option.\n" +
            "''my incidents'' - Displays the incidents currently associated to your account.");
    }
});

// Waterfall dialog that gets the information needed to create a ticket in ServiceNow and uploads it
bot.dialog('createIncident', [
    // Verifies entry into Conversation
    function (session) {

        // TODO: change the isThatCorrect prompts to Confirmation Prompts
        builder.Prompts.choice(session, 'I have understood that you want to create a new Incident, is that correct?', isThatCorrect, "button");
    },
    // if the response is negative, returns to default dialog; if positive: ask for a keyword (possible keywords listed in categories.json
    function (session, results) {
        var confirmation = results.response.entity.toString();
        if (confirmation === 'no') {
            session.endDialog('Ok! So how can I help you?');
        } else {
            builder.Prompts.choice(session, 'Okay! So let\'s start with a keyword. What is the application, product or service that is causing a problem for you?', categories);
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
        session.dialogData.subcategory = results.response.entity;
        builder.Prompts.text(session, 'Your choice was: ' + session.dialogData.subcategory + '. So let\'s move on with a short description. What\'s wrong exactly? In just a few words.');
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
        builder.Prompts.choice(session, 'Looks good! So you want to submit a Ticket about ' + session.dialogData.keyword + ', the underlying category is ' + session.dialogData.category +
            ' with a short description of \'' + session.dialogData.short_description + '\'. And for further information, we can reach you under ' +
            session.dialogData.phone_nr + '. Am I correct?', isThatCorrect);
    },
    function (session, results) {
        var confirmation = results.response.entity.toString();
        if (confirmation == 'no') {
            session.send('OK NOW I AM UPSET! Ask someone else. >:(')
        }
        else if (confirmation == 'yes') {
            session.send('Nice! I will get to work. Don\'t worry, I will get back to you when there are any news.');
            var data = {
                "caller_id": "javascript:gs.getUser().getFullName()",
                "category": session.dialogData.keyword.toString(),
                "subcategory": session.dialogData.subcategory.toString(),
                "short_description": session.dialogData.short_description.toString(),
                "description": session.dialogData.description.toString(),
                "u_phone": session.dialogData.phone_nr.toString()
            };
            var urlString = 'https://dev27563.service-now.com/api/now/table/incident?sysparm_input_display_value=true';
            var options = {
                url: urlString,
                method: 'POST',
                json: true,
                body: data,
                headers: headers,
                auth: {
                    'user': 'admin',
                    'pass': 'EF3tGqL5T!'
                }
            };

            function callback(error, response, body) {
                if (!error && response.statusCode == 201) {

                    session.send("Incident record created! The number is: " + body.result.number);
                }
            }

            request(options, callback);
        } else {
            session.send('I am confuuuuused. :(')
        }
        session.endDialog();

    }
]);

// Waterfall dialog that is triggered if a user wants to reopen an incident and guides him through the process
bot.dialog('reopenIncident', [
    function (session) {
        builder.Prompts.choice(session, 'I have understood you want to reopen an Incident, is that correct?', isThatCorrect);
    },
    function (session, results) {
        var confirmation = results.response.entity.toString();
        // User does not want to reopen an incident --> leave dialog and go back to default
        if (confirmation == 'no') {
            session.endDialog('Ok! So how else can I help you?');
        } else {
            // List the incidents available for reopening
            session.send('Okay, so these are the Incidents that have been closed recently. ' +
                'If the one you\'re looking for is among them, ask me about the INC number.' +
                ' If you want to see more Incidents, tell me \'more\'.');

            var urlString = 'https://dev27563.service-now.com/api/now/table/incident?sysparm_query=caller_id=javascript:gs.getUserID()^incident_state=7';
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
                    var incidentCount = respJSON.result.length;
                    // Different messages for Incident counts if lower than 2
                    if (respJSON.result.length > 1) {
                        session.send("You currently have " + incidentCount + " closed incidents.");
                        var incidents = [];
                        var incidentChoices = [];
                        for (var i = 0; i < respJSON.result.length; i++) {
                            incidentChoices[i] = respJSON.result[i].number;
                            incidents[i] = {name: respJSON.result[i].number, id: respJSON.result[i].sys_id};
                            session.send("Incident number " + (i + 1) + " has the ID: " + respJSON.result[i].number + ", its short description is: " + respJSON.result[i].short_description);
                        }
                        session.dialogData.incidents = incidents;
                        incidentChoices[incidentChoices.length] = 'more';
                        builder.Prompts.choice(session, 'So, which Incident is it going to be? Or do you want more choices?', incidentChoices);
                    } else {
                        session.send("You currently have " + incidentCount + " closed incident.");
                        var incidents = [];
                        var incidentChoices = [];
                        for (var i = 0; i < respJSON.result.length; i++) {
                            incidentChoices[i] = respJSON.result[i].number;
                            incidents[i] = {name: respJSON.result[i].number, id: respJSON.result[i].sys_id};
                            session.send("The Incident number is: \'" + respJSON.result[i].number + "\', its short description is: \'" + respJSON.result[i].short_description + "\'");
                        }
                        session.dialogData.incidents = incidents;
                        incidentChoices[incidentChoices.length] = 'more';
                        builder.Prompts.choice(session, 'So, do you want to reopen it? Or do you want more choices?', incidentChoices);
                    }
                }
            }

            request(options, callback);
        }

    },
    function (session, results) {
        //get sys_id from json, through looping the array of choices
        var incidentNumber = results.response.entity;
        var incidents = session.dialogData.incidents;
        var incident_sys_id;
        for (var i = 0; i < incidents.length; i++) {
            if (incidents[i].name === incidentNumber) {
                incident_sys_id = incidents[i].id;
            }
        }
        session.dialogData.sys_id_to_update = incident_sys_id;
        builder.Prompts.text(session, "Please provide a reason for reopening the incident, so we can further investigate the issue.");
    },

    function (session, results) {

        var description = results.response;
        // PUT request to update the correspoding incident
        var urlString = 'https://dev27563.service-now.com/api/now/table/incident/' + session.dialogData.sys_id_to_update;
        var data = {"incident_state": "2", "description": description.toString()};
        var options = {
            url: urlString,
            method: 'PUT',
            json: true,
            body: data,
            headers: headers,
            auth: {
                'user': 'admin',
                'pass': 'EF3tGqL5T!'
            }
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                session.endDialog("Incident reopened successfully!")
            }
        }

        request(options, callback);

    }
]);

// Waterfall dialog for ordering a hardware device
bot.dialog('orderHardware', [
    // Verifies entry into Conversation
    function (session) {
        builder.Prompts.choice(session, 'I have understood that you want to order a device, is that correct?', isThatCorrect, builder.ListStyle.button);
    },

    function (session, result) {
        if (result.response.entity.toString() == 'no') {
            session.endDialog('Ok, how else might I be of service to you?')
        } else {
            hardware = require('./hardware.json');
            builder.Prompts.choice(session, 'Okay, great! These are the categories of hardware devices available for you: ', hardware)
        }
    },

    function (session, result) {
        session.dialogData.hardwareCategory = result.response.entity;
        var choices = hardware[session.dialogData.hardwareCategory];
        builder.Prompts.choice(session, 'Nice! What type of device do you want to order?', choices)
    },

    function (session, result) {
        session.dialogData.hardwareSubcategory = result.response.entity;
        var temp = hardware[session.dialogData.hardwareCategory];
        var choices = temp[session.dialogData.hardwareSubcategory];
        builder.Prompts.choice(session, 'So which specific device is it going to be?', choices);
    },

    function (session, result){
        session.dialogData.hardwareDevice = result.response.entity;
        var keys = require('./hardware_sys_ids.json');
        session.dialogData.requestedSys_id = keys[session.dialogData.hardwareDevice];
        var data = {"sysparm_quantity":"1"};
        var urlString = 'https://dev27563.service-now.com/api/sn_sc/servicecatalog/items/' + session.dialogData.requestedSys_id + '/add_to_cart';
        var options = {
            url: urlString,
            method: 'POST',
            json: true,
            body: data,
            headers: headers,
            auth: {
                'user': 'admin',
                'pass': 'EF3tGqL5T!'
            }
        };
        function callback(error, response, body) {
            //session.send("Callback function is called.");
            if (!error && response.statusCode == 200) {
                session.send(session.dialogData.hardwareSubcategory.toString() + ": " +
                    "" +session.dialogData.hardwareDevice.toString() + " has been put into your personal cart.");
                var answer = body;
                session.send("You currently have " + answer.result.items.length + " items in your cart:");
                for (var i = 0; i < answer.result.items.length; i++) {
                    session.send(answer.result.items[i].item_name + " for " + answer.result.items[i].localized_price)
                }
                builder.Prompts.choice(session, "The subtotal is " + answer.result.subtotal + ". Are you ready to proceed to checkout?", isThatCorrect);

            }
        }

        request(options, callback);

    },
    function (session, result){
        if (result.response.entity.toString() == 'no') {
            session.beginDialog('orderHardware');
        } else {
           session.send("Your cart items will be ordered now.")
        }
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
