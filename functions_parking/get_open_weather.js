import fs from "fs";
import path from "path";

const execute = async (city) => {
  // get key from env. see https://home.openweathermap.org/api_keys
  const key = process.env.WEATHER_API_KEY;
  let state = "";
  let country = ""
  let url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${key}`
  fetch(url)
    .then(function (resp) { return resp.json() }) // Convert data to json
    .then(function (data) {
      console.log(data);
    })
  const response = await fetch(url);
  if (response.status !== 200) {
    return { error: "Error getting weather" }
  }
  let data = response.json();
  console.log("WEATHER:" + JSON.stringify(response))
  return data;

}
const details = {
  "name": "get_open_weather",
  "parameters": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "The name of city or country"
      },
      "country": {
        "type": "string",
        "description": "Country name"
      }
    },
    "required": ["city"]
  },
  "description": "Get the weather of a city"

};

export { execute, details };