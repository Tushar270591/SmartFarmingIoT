#include "secrets.h"
#include <WiFiClientSecure.h>
#include <MQTTClient.h>
#include <ArduinoJson.h>
#include "WiFi.h"

// The MQTT topics that this device should publish/subscribe
#define AWS_IOT_PUBLISH_TOPIC   "$aws/things/ESP32/shadow/update"
#define AWS_IOT_SUBSCRIBE_TOPIC "$aws/things/ESP32/shadow/update/accepted"
#define SOIL_MOISTURE_PIN 34
#define LDR_PIN 35
#define RELAY_PIN 23
#define MS_TO_S_FACTOR 1000000  /* Conversion factor for micro seconds to seconds */
#define SLEEP_DURATION  10   /* Time ESP32 will go to sleep (in seconds) */


WiFiClientSecure net = WiFiClientSecure();
MQTTClient client = MQTTClient(256);
int dryValueSoil = 0;
int wetValueSoil = 2000;
int friendlyDryValueSoil = 0;
int friendlyWetValueSoil = 100;

//method to print the reason of wakeup
void print_reason_for_wakeup(){
  esp_sleep_wakeup_cause_t wakeup_reason;

  //get the cause of wakeup
  wakeup_reason = esp_sleep_get_wakeup_cause();

  switch(wakeup_reason)
  {
    case ESP_SLEEP_WAKEUP_TIMER : Serial.println("Wakeup caused by timer"); break;
    default : Serial.printf("Wakeup was not caused by deep sleep: %d\n",wakeup_reason); break;
  }
}
void connectAWS()
{
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.println("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED){
    delay(500);
    Serial.print(".");
  }

  // Configure WiFiClientSecure to use the AWS IoT device credentials
  net.setCACert(AWS_CERT_CA);
  net.setCertificate(AWS_CERT_CRT);
  net.setPrivateKey(AWS_CERT_PRIVATE);

  // Connect to the MQTT broker on the AWS endpoint we defined earlier
  client.begin(AWS_IOT_ENDPOINT, 8883, net);

  // Create a message handler
  client.onMessage(messageHandler);

  Serial.print("Connecting to AWS IOT");

  while (!client.connect(THINGNAME)) {
    Serial.print(".");
    delay(100);
  }

  if(!client.connected()){
    Serial.println("AWS IoT Timeout!");
    return;
  }

  // Subscribe to a topic
  client.subscribe(AWS_IOT_SUBSCRIBE_TOPIC);

  Serial.println("AWS IoT Connected!");
}

void publishMessage()
{

  StaticJsonDocument<200> doc;
  doc["timestamp"] = millis();
  doc["state"]["desired"]["moisture"] = getMoisturePercentage();
  doc["state"]["desired"]["light"] = getLightPercentage();

  char jsonBuffer[1024];
  serializeJson(doc, jsonBuffer); // print to client

  client.publish(AWS_IOT_PUBLISH_TOPIC, jsonBuffer);
}

void messageHandler(String &topic, String &payload) {
  Serial.println("incoming: " + topic + " - " + payload);

}

void setup() {
  Serial.begin(9600);
  print_reason_for_wakeup();
  
  //Setting ESP32 to wake up at scheduled intervals
  esp_sleep_enable_timer_wakeup(SLEEP_DURATION * MS_TO_S_FACTOR);
  pinMode(RELAY_PIN, OUTPUT);
  connectAWS();
}
float getMoisturePercentage(void)
{
  float moisture_percentage;
  int sensor_analog;
  sensor_analog = analogRead(SOIL_MOISTURE_PIN);
  moisture_percentage = ( ( (sensor_analog/4096.00) * 100 ) );
  moisture_percentage = (float)moisture_percentage;
  return moisture_percentage;
}

float getLightPercentage(void)
{
  int ldrRawVal;
  float percentage;
  ldrRawVal = analogRead(LDR_PIN);    
  percentage = ((float)((ldrRawVal*100)/4096));
//  percentage = 100 - percentage;
  return percentage;
}

void loop() {
  Serial.println("moisture: ");
  float moisture = getMoisturePercentage();
  if(moisture > 40){
    digitalWrite(RELAY_PIN, HIGH);
    }else{
      digitalWrite(RELAY_PIN, LOW);
      esp_deep_sleep_start();
    }
    publishMessage();
  Serial.println(getMoisturePercentage());
  Serial.println("light: ");
  Serial.println(getLightPercentage());
  client.loop();
  delay(2000);
}
