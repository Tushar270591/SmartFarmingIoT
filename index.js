/*
 * Copyright 2015-2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

//
// Instantiate the AWS SDK and configuration objects.  The AWS SDK for
// JavaScript (aws-sdk) is used for Cognito Identity/Authentication, and
// the AWS IoT SDK for JavaScript (aws-iot-device-sdk) is used for the
// WebSocket connection to AWS IoT and device shadow APIs.
//
var AWS = require('aws-sdk');
var AWSIoTData = require('aws-iot-device-sdk');
var AWSConfiguration = require('./aws-configuration.js');
var analyticsData = [];
var lightData = {
    'timestamp': [],
    'value': []
};
var moistureData = {
    'timestamp': [],
    'value': []
};

console.log('Loaded AWS SDK for JavaScript and AWS IoT SDK for Node.js');

//
// Initialize our configuration.
//
AWS.config.region = AWSConfiguration.region;

AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: AWSConfiguration.poolId
});

//
// Keep track of whether or not we've registered the shadows used by this
// example.
//
var shadowsRegistered = false;

//
// Create the AWS IoT shadows object.  Note that the credentials must be
// initialized with empty strings; when we successfully authenticate to
// the Cognito Identity Pool, the credentials will be dynamically updated.
//
const shadows = AWSIoTData.thingShadow({
    //
    // Set the AWS region we will operate in.
    //
    region: AWS.config.region,
    //
    //Set the AWS IoT Host Endpoint
    //
    host: AWSConfiguration.host,
    //
    // Use a random client ID.
    //
    clientId: 'temperature-control-browser-' + (Math.floor((Math.random() * 100000) + 1)),
    //
    // Connect via secure WebSocket
    //
    protocol: 'wss',
    //
    // Set the maximum reconnect time to 8 seconds; this is a browser application
    // so we don't want to leave the user waiting too long for reconnection after
    // re-connecting to the network/re-opening their laptop/etc...
    //
    maximumReconnectTimeMs: 8000,
    //
    // Enable console debugging information (optional)
    //
    debug: true,
    //
    // IMPORTANT: the AWS access key ID, secret key, and sesion token must be
    // initialized with empty strings.
    //
    accessKeyId: '',
    secretKey: '',
    sessionToken: ''
});

//
// Update divs whenever we receive delta events from the shadows.
//
shadows.on('delta', function(name, stateObject) {
    document.getElementById("moisture-data").innerHTML = Math.floor(stateObject.state.moisture);
    document.getElementById("light-data").innerHTML = Math.floor(stateObject.state.light);
});

//
// Update divs whenever we receive status events from the shadows.
//
shadows.on('status', function(name, statusType, clientToken, stateObject) {
    if (statusType === 'rejected') {
        //
        // If an operation is rejected it is likely due to a version conflict;
        // request the latest version so that we synchronize with the shadow
        // The most notable exception to this is if the thing shadow has not
        // yet been created or has been deleted.
        //
        if (stateObject.code !== 404) {
            console.log('resync with thing shadow');
            var opClientToken = shadows.get(name);
            if (opClientToken === null) {
                console.log('operation in progress');
            }
        }
    } else { // statusType === 'accepted'
        //   var enabled = stateObject.state.desired.enabled ? 'enabled' : 'disabled';
        //   document.getElementById('temperature-control-div').innerHTML = '<p>setpoint: ' + stateObject.state.desired.setPoint + '</p>' +
        //       '<p>    mode: ' + enabled + '</p>';
    }
});

//
// Attempt to authenticate to the Cognito Identity Pool.  Note that this
// example only supports use of a pool which allows unauthenticated
// identities.
//
var cognitoIdentity = new AWS.CognitoIdentity();
AWS.config.credentials.get(function(err, data) {
    if (!err) {
        console.log('retrieved identity: ' + AWS.config.credentials.identityId);
        var params = {
            IdentityId: AWS.config.credentials.identityId
        };
        cognitoIdentity.getCredentialsForIdentity(params, function(err, data) {
            if (!err) {
                //
                // Update our latest AWS credentials; the MQTT client will use these
                // during its next reconnect attempt.
                //
                shadows.updateWebSocketCredentials(data.Credentials.AccessKeyId,
                    data.Credentials.SecretKey,
                    data.Credentials.SessionToken);
            } else {
                console.log('error retrieving credentials: ' + err);
                alert('error retrieving credentials: ' + err);
            }
        });
    } else {
        console.log('error retrieving identity:' + err);
        alert('error retrieving identity: ' + err);
    }
});

//
// Connect handler; update div visibility and fetch latest shadow documents.
// Register shadows on the first connect event.
//
window.shadowConnectHandler = function() {
    console.log('connect');
    document.getElementById("connecting-div").style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'block';
    getSoilMoistureData();

    //
    // We only register our shadows once.
    //

    //
    // After connecting, wait for a few seconds and then ask for the
    // current state of the shadows.
    //
    setTimeout(function() {
        var opClientToken = shadows.get('ESP32');
        if (opClientToken === null) {
            console.log('operation in progress');
        }
    }, 3000);
};

//
// Reconnect handler; update div visibility.
//
window.shadowReconnectHandler = function() {
    if (!shadowsRegistered) {
        shadows.register('ESP32', {
            persistentSubscribe: true
        });
        shadowsRegistered = true;
    }
    console.log('reconnect');
    document.getElementById("connecting-div").style.display = 'flex';
    document.getElementById('dashboard-container').style.display = 'none';
};

//
// Install connect/reconnect event handlers.
//
shadows.on('connect', window.shadowConnectHandler);
shadows.on('reconnect', window.shadowReconnectHandler);

//
// Initialize divs.
//
document.getElementById('connecting-div').style.display = 'flex';
document.getElementById('dashboard-container').style.display = 'none';
document.getElementById('moistureChart').style.display = 'none';
document.getElementById('lightChart').style.display = 'none';

function getSoilMoistureData() {
    const Http = new XMLHttpRequest();

    const url = 'https://9b115q12m2.execute-api.eu-west-1.amazonaws.com/test/test';
    Http.open("GET", url);
    Http.setRequestHeader("Content-Type", "application/json");
    Http.send();
    Http.onreadystatechange = (e) => {
        if (Http.responseText) {
            analyticsData = JSON.parse(Http.responseText);
            console.log(analyticsData);
            initializeCharts();
        }
    }
}

function initializeCharts() {
    for (var i = 0; i <= analyticsData.length; i++) {
        if (analyticsData && analyticsData[i] && analyticsData[i].data) {
            if (analyticsData[i].data.light > 0) {
                var y = analyticsData[i].data.light;
                var x = analyticsData[i].timestamp;
                // lightData.push({'x':x,'y':y});
                // lightData.push(y);
                x = i;
                lightData.timestamp.push(x);
                lightData.value.push(y);
            }
            if (analyticsData[i].data.moisture > 0) {
                y = analyticsData[i].data.moisture
                x = analyticsData[i].timestamp;
                x = i;
                // moistureData.push({'x':x,'y':y});
                moistureData.timestamp.push(x);
                moistureData.value.push(y);
            }
        }
    }
    var ctx = document.getElementById('moistureChart');
    var lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: moistureData.timestamp,
            datasets: [{
                data: moistureData.value,
                label: "Soil Moisture",
                borderColor: "#3e95cd",
                fill: false
            }]
        },
        options: {
            title: {
                display: true,
                text: 'Soil Moisture Level(in %)'
            },
            scales: {
                yAxes: [{
                    display: true,
                    ticks: {
                        suggestedMax: 100
                    }
                }]
            }
        }
    });
    ctx = document.getElementById('lightChart');
    var lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: lightData.timestamp,
            datasets: [{
                data: lightData.value,
                label: "Light Intensity",
                borderColor: "#3e95cd",
                fill: false
            }]
        },
        options: {
            title: {
                display: true,
                text: 'Light Intensity(in %)'
            },
            scales: {
                yAxes: [{
                    display: true,
                    ticks: {
                        suggestedMax: 100
                    }
                }]
            }
        }
    });
}