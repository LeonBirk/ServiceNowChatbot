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

bot.dialog('createIncident', [
    // Step 1
    function (session) {
        builder.Prompts.text(session, 'I have understood that you want to create a new Incident, is that correct?');
    },
    // Step 2
    function (session, results) {
        if(results.response === 'no'){
            session.endDialog('Ok! So how can I help you?');
        }else {
            builder.Prompts.text(session, 'Okay! So let\'s start with a keyword. What is the application, product or service that is causing a problem for you?');
        }
    },
    function(session, results) {
    session.dialogData.keyword= results.response;
    var categoryArray = [];
    for (var i=0; i < categories.list.length; i++){
        if(categories.list[i] === session.dialogData.keyword){
            categoryArray.push(categories.list[i]);
        }
    }
    session.send('I have understood that your problem concerns \"'+ session.dialogData.keyword +'\".');
    builder.Prompts.text(session, 'Please specify one of the following categories:' + categoryArray[0] + ', ' + categoryArray[1]);
    }
]);

bot.dialog('/', function (session) {
    if(session.message.text.includes("open"&&"incident")){
        session.beginDialog('createIncident');
    } else
    if(session.message.text.includes("INC")){
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
        switch(state){
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
        session.send('Requested ID: ' + respJSON.result[0].number + '\n Status: ' + state + '\n Urgency: '+ respJSON.result[0].urgency + '\n Short Description: ' + respJSON.result[0].short_description);
    }
}

request(options, callback);
    } else if (session.message.text.includes("my incidents")){
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
        for (var i = 0; i<respJSON.result.length; i++){
            session.send("Incident ID number " + (i+1) + " is: " + respJSON.result[i].number + ", short description is: "+ respJSON.result[i].short_description);
        }
        session.send("If you want more information on one of those incidents, ask me about its ID.")
    }
    }
    request(options, callback);
    }
    else if (session.message.text.includes("order sales laptop")){
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

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpoint at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}
