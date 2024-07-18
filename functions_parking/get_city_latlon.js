import fs from "fs";
import path from "path";

const execute = async (city) => {

  // get key from env. see https://home.openweathermap.org/api_keys
  const key = process.env.WEATHER_API_KEY;
  let state = "";
  let country = ""
  let limit = 1;
  const url = `http://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=${limit}&appid=${key}`
  const response = await fetch(url);
  let data = await response.json();
  console.log("Lat,Loncle:" + JSON.stringify(data))
  let lat = data[0]["lat"];
  let lon = data[0]["lon"];
  return { city: city, lat: lat, lon: lon }

}

const details = {
  "name": "get_city_latlon",
  "parameters": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "The name of the city"
      },
      "country": {
        "type": "string",
        "description": "Country name"
      }
    },
    "required": ["city"]
  },
  "description": "Given city get the lat, lon location",
};

export { execute, details };