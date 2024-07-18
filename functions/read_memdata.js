import OpenAI from 'openai';
import fs from 'fs';
import { get } from 'http';

const execute = async (name) => {
    // check of memory.json exists and if not create it
    if (!fs.existsSync('memory.json')) {
        fs.writeFileSync('memory.json', '[]');
    }
    //read memory.json into local memory named memory
    let memory = fs.readFileSync('memory.json');
    // search array for object(s) with "name"

    memory = JSON.parse(memory);
    let data = memory.find(obj => obj.name === name);
    // search for data into memory
    if(data != null){
        console.log(`got fact ${name} : ${data}`);
        return data;
    } else {
        return "none"
    }
    
}
const details = {
    "name": "read_memdata",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "The name of the data to search for"
            }
        },
        "required": ["name"]
    },
    "description": "This retrieves data from datastore",
};
export { execute, details };