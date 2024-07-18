// this is the function that reads data from memory 

import OpenAI from 'openai';
import fs from 'fs';
import { get } from 'http';

const execute = async (name) => {
    // check of memory.json exists and if not create it
    if (!fs.existsSync('memory.json')) {
        fs.writeFileSync('memory.json', '[]');
    }
    // extract data named name from memory.json file
    let memory = fs.readFileSync('memory.json');
    let memory_json = JSON.parse(memory);
    // find the data named name in the array
    let data = memory_json.find(x => x[name]);
    if (!data) {
        return `No data found for ${name}`;
    }
    console.log(`${name} read from memory`);
    return data;
}

const details = {
    "name": "read_memdata",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "The name of the data"
            }
        },
        "required": ["name"]
    },
    "description": "This gets data named name",
};
export { execute, details };