'use strict'
const AWS = require('aws-sdk');

AWS.config.update({ region: "eu-west-1" });

exports.handler = async(event, context) => {
    const ddb = new AWS.DynamoDB({ apiVersion: "2012-10-08" });
    const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

    // const params = {
    //   TableName: "SensorData",
    //   Key: {
    //     timestamp: 1311849
    //   }
    // }

    // try {
    //   const data = await documentClient.get(params).promise();
    //   console.log(data);
    // } catch (err) {
    //   console.log(err);
    // }

    // var docClient = new AWS.DynamoDB.DocumentClient();

    var params = {
        TableName: "YOUR_TABLE_NAME",
        FilterExpression: "#timestamp > :timestamp",
        ExpressionAttributeNames: {
            "#timestamp": "timestamp",
        },
        ExpressionAttributeValues: { ":timestamp": 0 }

    };
    const awsRequest = await docClient.scan(params);
    const result = await awsRequest.promise();
    console.log(result.Items); // <<--- Your results are here
    return result.Items;


}